const express = require('express');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const downloadManager = require('./downloadManager'); // 引入下载管理器

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(express.json());
app.use(express.static('public')); // 静态文件目录
app.use('/downloads', express.static('tmp')); // 临时文件目录

// 确保临时目录存在
const tmpDir = path.join(__dirname, 'tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir);
}

// 转换接口
app.post('/api/convert', async (req, res) => {
  try {
    let { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: '请提供YouTube链接' });
    }
    
    console.log('收到下载请求:', url);
    
    // 生成唯一ID和文件路径
    const fileId = uuidv4();
    const tempAudioPath = path.join(tmpDir, `${fileId}.m4a`);
    const outputPath = path.join(tmpDir, `${fileId}.mp3`);
    
    // 获取视频信息
    const videoInfo = await downloadManager.getVideoInfo(url);
    const videoTitle = videoInfo.title.replace(/[^\w\s]/gi, '');
    console.log('视频标题:', videoTitle);
    
    // 下载并转换音频
    console.log('开始下载和转换...');
    await downloadManager.downloadAudio(url, tempAudioPath, outputPath);
    
    // 在发送响应前添加日志
    console.log('准备发送成功响应:', {
      success: true,
      downloadUrl: `/downloads/${fileId}.mp3`,
      title: videoTitle
    });
    
    // 返回下载链接和视频信息
    res.json({
      success: true,
      downloadUrl: `/downloads/${fileId}.mp3`,
      title: videoTitle,
      message: '转换成功',
      videoInfo: {
        title: videoInfo.title,
        duration: videoInfo.duration,
        uploader: videoInfo.uploader
      }
    });
    
    console.log('响应已发送');  // 确认响应已发送
    
  } catch (error) {
    console.error('转换过程中发生错误:', error);
    res.status(500).json({ 
      message: '服务器错误，请稍后再试', 
      error: error.message 
    });
  }
});

// 添加统计信息接口
app.get('/api/stats', (req, res) => {
  res.json(downloadManager.getStats());
});

// 添加健康度监控API
app.get('/api/health', (req, res) => {
  res.json(downloadManager.getStats());
});

// 添加重置统计API（可选，需要保护）
app.post('/api/reset-stats', (req, res) => {
  // 简单的API密钥保护（生产环境应使用更安全的方法）
  const apiKey = req.body.apiKey;
  if (apiKey !== 'your-secret-api-key') {
    return res.status(403).json({ message: '未授权' });
  }
  
  downloadManager.resetStats();
  res.json({ message: '统计数据已重置' });
});

// 简易文件清理（每12小时运行一次）
setInterval(() => {
  fs.readdir(tmpDir, (err, files) => {
    if (err) return console.error('读取临时目录失败:', err);
    
    const now = Date.now();
    files.forEach(file => {
      const filePath = path.join(tmpDir, file);
      fs.stat(filePath, (err, stats) => {
        if (err) return console.error(`无法获取文件信息: ${file}`, err);
        
        // 如果文件超过24小时
        if (now - stats.mtime.getTime() > 24 * 60 * 60 * 1000) {
          fs.unlink(filePath, err => {
            if (err) return console.error(`删除文件失败: ${file}`, err);
            console.log(`已删除旧文件: ${file}`);
          });
        }
      });
    });
  });
}, 12 * 60 * 60 * 1000);

// 提供主页
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`服务器运行在端口: ${PORT}`);
  console.log(`多库冗余下载策略已启用`);
}); 