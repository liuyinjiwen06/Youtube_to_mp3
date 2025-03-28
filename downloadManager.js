/**
 * YouTube下载管理器 - 多库冗余策略
 * 带动态健康度评估系统，智能选择最可靠的下载工具
 */

const ytdlp = require('yt-dlp-exec');
const ytdl = require('ytdl-core');
const youtubeDl = require('youtube-dl-exec');
const fs = require('fs');
const path = require('path');
const { pipeline } = require('stream/promises');
const ffmpeg = require('fluent-ffmpeg');

// 健康度评分系统配置
const HEALTH_CONFIG = {
  SUCCESS_BONUS: 5,      // 成功时增加的分数
  FAILURE_PENALTY: 20,   // 失败时减少的分数
  RECOVERY_RATE: 5,      // 每小时恢复的分数
  RECOVERY_INTERVAL: 60 * 60 * 1000, // 恢复间隔(1小时)
  RANDOM_THRESHOLD: 20,  // 随机选择阈值
  RANDOM_CHANCE: 0.2,    // 选择次优选项的概率
  HEALTH_FILE: path.join(__dirname, 'health_scores.json'), // 健康度数据文件
  MAX_SCORE: 100,        // 最高分数
  MIN_SCORE: 0           // 最低分数
};

// 下载工具配置
const TOOLS = {
  'yt-dlp': {
    name: 'yt-dlp',
    health: 100,
    lastUsed: Date.now(),
    download: downloadWithYtDlp
  },
  'ytdl-core': {
    name: 'ytdl-core',
    health: 100,
    lastUsed: Date.now(),
    download: downloadWithYtdlCore
  },
  'youtube-dl': {
    name: 'youtube-dl',
    health: 100,
    lastUsed: Date.now(),
    download: downloadWithYoutubeDl
  }
};

// 下载统计
const stats = {
  total: 0,
  success: 0,
  failure: 0,
  byTool: {
    'yt-dlp': { attempts: 0, success: 0, failure: 0 },
    'ytdl-core': { attempts: 0, success: 0, failure: 0 },
    'youtube-dl': { attempts: 0, success: 0, failure: 0 }
  },
  lastReset: Date.now()
};

// 初始化：加载健康度数据
function initHealthSystem() {
  try {
    if (fs.existsSync(HEALTH_CONFIG.HEALTH_FILE)) {
      const data = JSON.parse(fs.readFileSync(HEALTH_CONFIG.HEALTH_FILE, 'utf8'));
      
      // 更新工具健康度
      Object.keys(data.tools).forEach(tool => {
        if (TOOLS[tool]) {
          TOOLS[tool].health = data.tools[tool].health;
          TOOLS[tool].lastUsed = data.tools[tool].lastUsed;
        }
      });
      
      // 更新统计数据
      if (data.stats) {
        stats.total = data.stats.total || 0;
        stats.success = data.stats.success || 0;
        stats.failure = data.stats.failure || 0;
        
        Object.keys(data.stats.byTool || {}).forEach(tool => {
          if (stats.byTool[tool]) {
            stats.byTool[tool] = data.stats.byTool[tool];
          }
        });
        
        stats.lastReset = data.stats.lastReset || Date.now();
      }
      
      console.log('已加载健康度数据');
    } else {
      console.log('未找到健康度数据文件，使用默认值');
      saveHealthData(); // 创建初始文件
    }
  } catch (error) {
    console.error('加载健康度数据失败:', error.message);
    // 继续使用默认值
  }
  
  // 启动健康度恢复定时器
  startHealthRecovery();
}

// 保存健康度数据到文件
function saveHealthData() {
  try {
    const toolsData = {};
    Object.keys(TOOLS).forEach(tool => {
      toolsData[tool] = {
        health: TOOLS[tool].health,
        lastUsed: TOOLS[tool].lastUsed
      };
    });
    
    const data = {
      tools: toolsData,
      stats: {
        total: stats.total,
        success: stats.success,
        failure: stats.failure,
        byTool: stats.byTool,
        lastReset: stats.lastReset
      },
      lastUpdated: Date.now()
    };
    
    fs.writeFileSync(HEALTH_CONFIG.HEALTH_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('保存健康度数据失败:', error.message);
  }
}

// 启动健康度恢复定时器
function startHealthRecovery() {
  // 每小时检查一次，为未使用的工具恢复健康度
  setInterval(() => {
    const now = Date.now();
    let updated = false;
    
    Object.keys(TOOLS).forEach(toolName => {
      const tool = TOOLS[toolName];
      const hoursSinceLastUse = (now - tool.lastUsed) / HEALTH_CONFIG.RECOVERY_INTERVAL;
      
      // 如果工具有一段时间未使用且健康度未满，则恢复健康度
      if (hoursSinceLastUse >= 1 && tool.health < HEALTH_CONFIG.MAX_SCORE) {
        // 计算应恢复的健康度
        const recoveryPoints = Math.floor(hoursSinceLastUse) * HEALTH_CONFIG.RECOVERY_RATE;
        tool.health = Math.min(tool.health + recoveryPoints, HEALTH_CONFIG.MAX_SCORE);
        updated = true;
        console.log(`${toolName} 健康度自动恢复 +${recoveryPoints}，当前: ${tool.health}`);
      }
    });
    
    // 如果有更新，保存数据
    if (updated) {
      saveHealthData();
    }
  }, HEALTH_CONFIG.RECOVERY_INTERVAL);
  
  console.log('健康度恢复系统已启动');
}

// 更新工具健康度
function updateToolHealth(toolName, success) {
  const tool = TOOLS[toolName];
  if (!tool) return;
  
  // 更新最后使用时间
  tool.lastUsed = Date.now();
  
  // 根据结果调整健康度
  if (success) {
    tool.health = Math.min(tool.health + HEALTH_CONFIG.SUCCESS_BONUS, HEALTH_CONFIG.MAX_SCORE);
    console.log(`${toolName} 下载成功，健康度 +${HEALTH_CONFIG.SUCCESS_BONUS}，当前: ${tool.health}`);
  } else {
    tool.health = Math.max(tool.health - HEALTH_CONFIG.FAILURE_PENALTY, HEALTH_CONFIG.MIN_SCORE);
    console.log(`${toolName} 下载失败，健康度 -${HEALTH_CONFIG.FAILURE_PENALTY}，当前: ${tool.health}`);
  }
  
  // 保存更新后的健康度数据
  saveHealthData();
}

// 智能选择下载工具
function selectDownloadTools() {
  // 按健康度排序工具
  const sortedTools = Object.values(TOOLS).sort((a, b) => b.health - a.health);
  
  // 创建工具顺序数组
  let toolOrder = [];
  
  // 检查前两个工具的健康度差距
  if (sortedTools.length >= 2 && 
      (sortedTools[0].health - sortedTools[1].health) < HEALTH_CONFIG.RANDOM_THRESHOLD) {
    // 健康度接近，有一定概率选择次优工具
    if (Math.random() < HEALTH_CONFIG.RANDOM_CHANCE) {
      // 交换前两个工具的顺序
      [sortedTools[0], sortedTools[1]] = [sortedTools[1], sortedTools[0]];
      console.log(`随机选择次优工具: ${sortedTools[0].name} (${sortedTools[0].health})`);
    }
  }
  
  // 构建最终的工具顺序
  toolOrder = sortedTools.map(tool => tool.name);
  
  console.log('当前工具健康度:', Object.values(TOOLS).map(t => `${t.name}: ${t.health}`).join(', '));
  console.log('选择的工具顺序:', toolOrder.join(' > '));
  
  return toolOrder;
}

/**
 * 获取视频信息
 * @param {string} url - YouTube视频URL
 * @returns {Promise<Object>} - 视频信息对象
 */
async function getVideoInfo(url) {
  console.log('正在获取视频信息...');
  
  // 处理YouTube Shorts链接
  if (url.includes('/shorts/')) {
    const videoId = url.split('/shorts/')[1].split('?')[0];
    url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('转换Shorts链接为:', url);
  }
  
  // 尝试使用yt-dlp获取视频信息
  try {
    const videoInfo = await ytdlp(url, {
      skipDownload: true,
      dumpSingleJson: true
    });
    
    return {
      title: videoInfo.title,
      duration: videoInfo.duration,
      uploader: videoInfo.uploader,
      thumbnailUrl: videoInfo.thumbnail,
      videoId: videoInfo.id
    };
  } catch (error) {
    console.error('使用yt-dlp获取视频信息失败:', error.message);
    
    // 尝试使用ytdl-core作为备选
    try {
      const info = await ytdl.getInfo(url);
      return {
        title: info.videoDetails.title,
        duration: parseInt(info.videoDetails.lengthSeconds),
        uploader: info.videoDetails.author.name,
        thumbnailUrl: info.videoDetails.thumbnails[0].url,
        videoId: info.videoDetails.videoId
      };
    } catch (ytdlError) {
      console.error('使用ytdl-core获取视频信息也失败:', ytdlError.message);
      throw new Error(`无法获取视频信息: ${error.message}`);
    }
  }
}

/**
 * 使用yt-dlp下载音频
 * @param {string} url - YouTube视频URL
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<boolean>} - 是否成功
 */
async function downloadWithYtDlp(url, outputPath) {
  stats.byTool['yt-dlp'].attempts++;
  console.log('尝试使用yt-dlp下载...');
  
  try {
    await ytdlp(url, {
      output: outputPath,
      extractAudio: true,
      audioFormat: 'm4a',
      audioQuality: 0, // 最佳质量
      noCheckCertificate: true,
      preferFreeFormats: true
    });
    
    console.log('yt-dlp下载成功');
    stats.byTool['yt-dlp'].success++;
    updateToolHealth('yt-dlp', true);
    return true;
  } catch (error) {
    console.error('yt-dlp下载失败:', error.message);
    stats.byTool['yt-dlp'].failure++;
    updateToolHealth('yt-dlp', false);
    return false;
  }
}

/**
 * 使用ytdl-core下载音频
 * @param {string} url - YouTube视频URL
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<boolean>} - 是否成功
 */
async function downloadWithYtdlCore(url, outputPath) {
  stats.byTool['ytdl-core'].attempts++;
  console.log('尝试使用ytdl-core下载...');
  
  try {
    // ytdl-core返回流，需要手动保存到文件
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly'
    });
    
    const writeStream = fs.createWriteStream(outputPath);
    await pipeline(audioStream, writeStream);
    
    console.log('ytdl-core下载成功');
    stats.byTool['ytdl-core'].success++;
    updateToolHealth('ytdl-core', true);
    return true;
  } catch (error) {
    console.error('ytdl-core下载失败:', error.message);
    stats.byTool['ytdl-core'].failure++;
    updateToolHealth('ytdl-core', false);
    
    // 清理可能部分下载的文件
    if (fs.existsSync(outputPath)) {
      fs.unlinkSync(outputPath);
    }
    
    return false;
  }
}

/**
 * 使用youtube-dl-exec下载音频
 * @param {string} url - YouTube视频URL
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<boolean>} - 是否成功
 */
async function downloadWithYoutubeDl(url, outputPath) {
  stats.byTool['youtube-dl'].attempts++;
  console.log('尝试使用youtube-dl-exec下载...');
  
  try {
    await youtubeDl(url, {
      extractAudio: true,
      audioFormat: 'm4a',
      audioQuality: 0,
      output: outputPath,
      noCheckCertificate: true
    });
    
    console.log('youtube-dl-exec下载成功');
    stats.byTool['youtube-dl'].success++;
    updateToolHealth('youtube-dl', true);
    return true;
  } catch (error) {
    console.error('youtube-dl-exec下载失败:', error.message);
    stats.byTool['youtube-dl'].failure++;
    updateToolHealth('youtube-dl', false);
    return false;
  }
}

/**
 * 转换音频为MP3格式
 * @param {string} inputPath - 输入文件路径
 * @param {string} outputPath - 输出文件路径
 * @returns {Promise<void>}
 */
function convertToMp3(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    console.log('开始转换为MP3...');
    
    ffmpeg(inputPath)
      .audioBitrate(320)
      .toFormat('mp3')
      .save(outputPath)
      .on('end', () => {
        console.log('MP3转换完成');
        resolve();
      })
      .on('error', (err) => {
        console.error('MP3转换失败:', err.message);
        reject(err);
      });
  });
}

/**
 * 主下载函数 - 智能选择下载工具
 * @param {string} url - YouTube视频URL
 * @param {string} tempPath - 临时文件路径
 * @param {string} outputPath - 最终输出文件路径
 * @returns {Promise<void>}
 */
async function downloadAudio(url, tempPath, outputPath) {
  stats.total++;
  
  // 处理YouTube Shorts链接
  if (url.includes('/shorts/')) {
    const videoId = url.split('/shorts/')[1].split('?')[0];
    url = `https://www.youtube.com/watch?v=${videoId}`;
    console.log('转换Shorts链接为:', url);
  }
  
  // 智能选择下载工具顺序
  const toolOrder = selectDownloadTools();
  
  // 按顺序尝试不同的下载工具
  let downloadSuccess = false;
  
  for (const toolName of toolOrder) {
    console.log(`尝试使用 ${toolName} 下载...`);
    downloadSuccess = await TOOLS[toolName].download(url, tempPath);
    
    if (downloadSuccess) {
      console.log(`${toolName} 下载成功`);
      break;
    } else {
      console.log(`${toolName} 下载失败，尝试下一个工具...`);
    }
  }
  
  // 如果所有下载方法都失败
  if (!downloadSuccess) {
    stats.failure++;
    saveHealthData();
    throw new Error('所有下载方法都失败了，无法获取音频');
  }
  
  // 下载成功，转换为MP3
  try {
    await convertToMp3(tempPath, outputPath);
    
    // 删除临时文件
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }
    
    stats.success++;
    saveHealthData();
    return true;
  } catch (error) {
    stats.failure++;
    saveHealthData();
    throw error;
  }
}

/**
 * 获取下载统计信息和健康度状态
 * @returns {Object} - 统计信息
 */
function getStats() {
  // 计算成功率
  const successRate = stats.total > 0 ? (stats.success / stats.total * 100).toFixed(2) : '0.00';
  
  // 计算每个工具的成功率
  const toolStats = {};
  Object.keys(stats.byTool).forEach(tool => {
    const toolData = stats.byTool[tool];
    const toolSuccessRate = toolData.attempts > 0 
      ? (toolData.success / toolData.attempts * 100).toFixed(2) 
      : '0.00';
    
    toolStats[tool] = {
      ...toolData,
      successRate: `${toolSuccessRate}%`,
      health: TOOLS[tool].health
    };
  });
  
  return {
    overall: {
      total: stats.total,
      success: stats.success,
      failure: stats.failure,
      successRate: `${successRate}%`,
      lastReset: new Date(stats.lastReset).toISOString()
    },
    tools: toolStats,
    healthSystem: {
      config: {
        successBonus: HEALTH_CONFIG.SUCCESS_BONUS,
        failurePenalty: HEALTH_CONFIG.FAILURE_PENALTY,
        recoveryRate: `${HEALTH_CONFIG.RECOVERY_RATE}/小时`
      },
      currentOrder: selectDownloadTools()
    },
    timestamp: new Date().toISOString()
  };
}

/**
 * 重置统计信息
 */
function resetStats() {
  stats.total = 0;
  stats.success = 0;
  stats.failure = 0;
  stats.lastReset = Date.now();
  
  Object.keys(stats.byTool).forEach(tool => {
    stats.byTool[tool] = { attempts: 0, success: 0, failure: 0 };
  });
  
  saveHealthData();
  console.log('统计数据已重置');
}

// 初始化健康度系统
initHealthSystem();

module.exports = {
  getVideoInfo,
  downloadAudio,
  getStats,
  resetStats
}; 