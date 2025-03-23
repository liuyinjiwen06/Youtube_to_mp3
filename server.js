const express = require('express');
const ytdlp = require('yt-dlp-exec');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

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
    
    // 处理YouTube Shorts链接
    if (url.includes('/shorts/')) {
      const videoId = url.split('/shorts/')[1].split('?')[0];
      url = `https://www.youtube.com/watch?v=${videoId}`;
      console.log('转换Shorts链接为:', url);
    }
    
    console.log('正在获取视频信息...');
    
    // 生成唯一ID和文件路径
    const fileId = uuidv4();
    const tempAudioPath = path.join(tmpDir, `${fileId}.m4a`);
    const outputPath = path.join(tmpDir, `${fileId}.mp3`);
    
    // 使用yt-dlp获取视频信息
    const videoInfo = await ytdlp(url, {
      skipDownload: true,
      dumpSingleJson: true
    });
    
    const videoTitle = videoInfo.title.replace(/[^\w\s]/gi, '');
    console.log('视频标题:', videoTitle);
    
    // 使用yt-dlp下载音频
    console.log('开始下载音频...');
    await ytdlp(url, {
      output: tempAudioPath,
      extractAudio: true,
      audioFormat: 'm4a',
      audioQuality: 0 // 最佳质量
    });
    
    console.log('下载完成，开始转换为MP3...');
    
    // 使用ffmpeg转换为MP3
    ffmpeg(tempAudioPath)
      .audioBitrate(320)
      .toFormat('mp3')
      .save(outputPath)
      .on('end', () => {
        // 删除临时文件
        fs.unlink(tempAudioPath, (err) => {
          if (err) console.error('删除临时文件失败:', err);
        });
        
        console.log('转换完成:', outputPath);
        res.json({
          success: true,
          downloadUrl: `/downloads/${fileId}.mp3`,
          title: videoTitle,
          message: '转换成功'
        });
      })
      .on('error', (err) => {
        console.error('FFmpeg转换错误:', err);
        res.status(500).json({ message: '视频处理失败: ' + err.message });
      });
      
  } catch (error) {
    console.error('转换过程中发生错误:', error);
    res.status(500).json({ 
      message: '服务器错误，请稍后再试', 
      error: error.message 
    });
  }
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
}); 