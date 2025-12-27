FROM node:20-alpine

WORKDIR /app

# 安装构建依赖和 docker CLI
RUN apk add --no-cache python3 make g++ docker-cli

# 复制所有文件
COPY . .

# 安装 pnpm 和依赖
RUN npm install -g pnpm ts-node typescript && pnpm install

# 创建上传目录
RUN mkdir -p /app/data/uploads/original /app/data/uploads/processed /app/data/uploads/thumbnails /app/data/uploads/temp

EXPOSE 3000

# 使用 ts-node 跳过类型检查运行
CMD ["npx", "ts-node", "--transpile-only", "src/server.ts"]
