const cron = require('node-cron');
const fs = require('fs-extra');
const path = require('path');

const tmpDir = path.join(__dirname, '../../tmp');

/**
 * 设置定时任务
 */
exports.setupCronJobs = () => {
  // 每天午夜12点清理超过24小时的文件
  cron.schedule('0 0 * * *', () => {
    console.log('执行临时文件清理...');
    cleanTempFiles();
  });
  
  console.log('定时清理任务已设置');
};

/**
 * 清理临时文件
 */
const cleanTempFiles = async () => {
  try {
    const files = await fs.readdir(tmpDir);
    const now = Date.now();
    
    for (const file of files) {
      const filePath = path.join(tmpDir, file);
      const stats = await fs.stat(filePath);
      
      // 计算文件年龄（毫秒）
      const fileAge = now - stats.mtime.getTime();
      
      // 如果文件超过24小时（86400000毫秒）
      if (fileAge > 86400000) {
        await fs.unlink(filePath);
        console.log(`已删除旧文件: ${file}`);
      }
    }
    
    console.log('临时文件清理完成');
  } catch (error) {
    console.error('清理临时文件时出错:', error);
  }
}; 