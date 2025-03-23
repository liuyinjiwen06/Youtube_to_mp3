const ytdl = require('ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const fs = require('fs-extra');
const path = require('path');

// 设置ffmpeg路径 (如果需要)
// ffmpeg.setFfmpegPath('/usr/bin/ffmpeg');

/**
 * 验证YouTube URL
 */
exports.validateYoutubeUrl = (url) => {
  return ytdl.validateURL(url);
};

/**
 * 获取视频信息
 */
exports.getVideoInfo = async (url) => {
  try {
    const info = await ytdl.getInfo(url);
    return {
      title: info.videoDetails.title,
      author: info.videoDetails.author.name,
      lengthSeconds: info.videoDetails.lengthSeconds,
      videoId: info.videoDetails.videoId
    };
  } catch (error) {
    console.error('获取视频信息失败:', error);
    throw new Error('无法获取视频信息');
  }
};

/**
 * 下载并转换视频音频为MP3
 */
exports.downloadAudio = (url, outputPath) => {
  return new Promise((resolve, reject) => {
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      filter: 'audioonly',
    });
    
    ffmpeg(audioStream)
      .audioBitrate(320)
      .toFormat('mp3')
      .save(outputPath)
      .on('end', () => {
        console.log(`音频已保存到: ${outputPath}`);
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('转换错误:', err);
        reject(err);
      });
  });
};

/**
 * 直接转换为MP3格式
 */
exports.convertToMp3 = (inputPath, outputPath) => {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .audioBitrate(320)
      .toFormat('mp3')
      .save(outputPath)
      .on('end', () => {
        console.log(`已转换为MP3: ${outputPath}`);
        fs.unlinkSync(inputPath); // 删除原始文件
        resolve(outputPath);
      })
      .on('error', (err) => {
        console.error('MP3转换错误:', err);
        reject(err);
      });
  });
}; 