#!/usr/bin/env node
// 简单的 Webhook 服务，接收请求后触发 zenithjoyai.com 部署
// 运行: node deploy-webhook.js
// 或者用 pm2: pm2 start deploy-webhook.js --name deploy-webhook

const http = require('http');
const { exec } = require('child_process');
const path = require('path');

const PORT = 9999;
const DEPLOY_SCRIPT = path.join(__dirname, 'deploy-zenithjoyai.sh');
const SECRET = process.env.DEPLOY_SECRET || 'zenithjoyai-deploy-2024';

const server = http.createServer((req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  if (req.method !== 'POST' || req.url !== '/deploy') {
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not found' }));
    return;
  }

  // 验证密钥
  const auth = req.headers.authorization;
  if (auth !== `Bearer ${SECRET}`) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Unauthorized' }));
    return;
  }

  console.log(`[${new Date().toISOString()}] Deploy triggered`);

  // 立即返回，异步执行部署
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ success: true, message: 'Deploy triggered' }));

  // 异步执行部署脚本
  exec(`bash ${DEPLOY_SCRIPT}`, (error, stdout, stderr) => {
    if (error) {
      console.error(`[${new Date().toISOString()}] Deploy failed:`, error.message);
      console.error(stderr);
    } else {
      console.log(`[${new Date().toISOString()}] Deploy completed successfully`);
      console.log(stdout);
    }
  });
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`Deploy webhook listening on http://127.0.0.1:${PORT}/deploy`);
  console.log(`Use: curl -X POST -H "Authorization: Bearer ${SECRET}" http://127.0.0.1:${PORT}/deploy`);
});
