FROM node:16

# 安装ffmpeg
RUN apt-get update && apt-get install -y ffmpeg

WORKDIR /app

# 复制应用程序文件
COPY . .

# 安装依赖
RUN cd client && npm install && npm run build
RUN cd server && npm install

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=5000

# 暴露端口
EXPOSE 5000

# 启动命令
CMD ["node", "server/server.js"] 