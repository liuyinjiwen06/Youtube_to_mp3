const path = require('path');
const fs = require('fs-extra');
const { v4: uuidv4 } = require('uuid');
const { validateYoutubeUrl, downloadAudio, convertToMp3, getVideoInfo } = require('../services/youtubeService');

// 确保临时目录存在
const tmpDir = path.join(__dirname, '../../tmp');
fs.ensureDirSync(tmpDir);

exports.convertVideo = async (req, res) => {
  try {
    const { url } = req.body;
    
    if (!url) {
      return res.status(400).json({ message: '请提供YouTube链接' });
    }
    
    // 验证URL
    if (!validateYoutubeUrl(url)) {
      return res.status(400).json({ message: '无效的YouTube链接' });
    }
    
    // 获取视频信息
    const videoInfo = await getVideoInfo(url);
    const videoTitle = videoInfo.title.replace(/[^\w\s]/gi, ''); // 移除特殊字符
    
    // 生成唯一ID和文件路径
    const fileId = uuidv4();
    const outputPath = path.join(tmpDir, `${fileId}.mp3`);
    
    // 下载并转换
    await downloadAudio(url, outputPath);
    
    // 返回下载链接
    const downloadUrl = `/downloads/${fileId}.mp3`;
    
    res.json({
      success: true,
      downloadUrl,
      title: videoTitle,
      message: '转换成功'
    });
    
  } catch (error) {
    console.error('转换错误:', error);
    res.status(500).json({ message: '服务器错误，请稍后再试' });
  }
}; 