const express = require('express');
const cors = require('cors');
const path = require('path');
const { setupCronJobs } = require('./utils/cronJobs');
const convertRoutes = require('./routes/convert');

const app = express();
const PORT = process.env.PORT || 5000;

// 中间件
app.use(cors());
app.use(express.json());

// 静态文件
app.use('/downloads', express.static(path.join(__dirname, '../tmp')));

// 路由
app.use('/api', convertRoutes);

// 前端静态文件 (生产环境)
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/build')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/build/index.html'));
  });
}

// 启动定时任务清理临时文件
setupCronJobs();

app.listen(PORT, () => {
  console.log(`服务器运行在端口: ${PORT}`);
}); 