/**
 * 简化版 Chrome 服务器
 * 只负责启动 Chrome 并返回 CDP 连接地址，所有逻辑在 VPS 端
 *
 * 用法：
 *   POST /start - 启动指定平台的 Chrome，返回 CDP URL
 *   POST /stop - 关闭 Chrome
 *   GET /health - 健康检查
 */

const express = require('express');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const http = require('http');

const app = express();
app.use(express.json());

// 配置
const CONFIG = {
  CHROME_PATH: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  PROFILES_DIR: 'C:\\automation\\profiles',
  API_KEY: 'runner-secure-key-ax2024-9f8e7d6c5b4a',
  BASE_PORT: 9222
};

// 平台列表
const PLATFORMS = {
  'douyin': { name: '抖音', port: 9222 },
  'kuaishou': { name: '快手', port: 9223 },
  'xiaohongshu': { name: '小红书', port: 9224 },
  'toutiao-main': { name: '头条主号', port: 9225 },
  'toutiao-sub': { name: '头条副号', port: 9226 },
  'weibo': { name: '微博', port: 9227 },
  'shipinhao': { name: '视频号', port: 9228 },
  'gongzhonghao': { name: '公众号', port: 9229 },
  'zhihu': { name: '知乎', port: 9230 }
};

// 正在运行的 Chrome 进程
const runningProcesses = {};

// API Key 验证
app.use((req, res, next) => {
  if (req.path === '/health') return next();
  const apiKey = req.headers['x-api-key'];
  if (apiKey !== CONFIG.API_KEY) {
    return res.status(401).json({ error: 'Invalid API key' });
  }
  next();
});

// 健康检查
app.get('/health', (req, res) => {
  const running = Object.keys(runningProcesses).filter(p => runningProcesses[p]);
  res.json({
    status: 'ok',
    runningBrowsers: running,
    platforms: Object.keys(PLATFORMS)
  });
});

// 启动 Chrome
app.post('/start', async (req, res) => {
  const { platform } = req.body;

  if (!PLATFORMS[platform]) {
    return res.status(400).json({ error: 'Unknown platform', platforms: Object.keys(PLATFORMS) });
  }

  const config = PLATFORMS[platform];
  const profileDir = path.join(CONFIG.PROFILES_DIR, platform);

  // 确保 profile 目录存在
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  // 如果已经在运行，返回现有的
  if (runningProcesses[platform]) {
    return res.json({
      success: true,
      platform: config.name,
      cdpPort: config.port,
      cdpUrl: `http://localhost:${config.port}`,
      wsEndpoint: await getWSEndpoint(config.port),
      message: 'Already running'
    });
  }

  // 启动 Chrome
  const args = [
    `--remote-debugging-port=${config.port}`,
    `--user-data-dir=${profileDir}`,
    '--no-first-run',
    '--no-default-browser-check',
    '--disable-background-networking',
    '--disable-sync',
    '--remote-allow-origins=*',  // 允许远程连接
    'about:blank'
  ];

  try {
    const chrome = spawn(CONFIG.CHROME_PATH, args, {
      detached: true,
      stdio: 'ignore'
    });

    chrome.unref();
    runningProcesses[platform] = chrome.pid;

    // 等待 Chrome 启动
    await new Promise(r => setTimeout(r, 2000));

    const wsEndpoint = await getWSEndpoint(config.port);

    res.json({
      success: true,
      platform: config.name,
      cdpPort: config.port,
      cdpUrl: `http://localhost:${config.port}`,
      wsEndpoint: wsEndpoint,
      pid: chrome.pid
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// 获取 WebSocket 端点
async function getWSEndpoint(port) {
  return new Promise((resolve) => {
    http.get(`http://localhost:${port}/json/version`, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const json = JSON.parse(data);
          resolve(json.webSocketDebuggerUrl);
        } catch (e) {
          resolve(null);
        }
      });
    }).on('error', () => resolve(null));
  });
}

// 停止 Chrome
app.post('/stop', (req, res) => {
  const { platform } = req.body;

  if (platform && runningProcesses[platform]) {
    try {
      process.kill(runningProcesses[platform]);
      delete runningProcesses[platform];
      res.json({ success: true, message: `Stopped ${platform}` });
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  } else if (!platform) {
    // 停止所有
    for (const p of Object.keys(runningProcesses)) {
      try {
        process.kill(runningProcesses[p]);
      } catch (e) {}
    }
    Object.keys(runningProcesses).forEach(k => delete runningProcesses[k]);
    res.json({ success: true, message: 'Stopped all' });
  } else {
    res.json({ success: false, message: 'Not running' });
  }
});

// 获取 CDP 信息
app.get('/cdp/:platform', async (req, res) => {
  const { platform } = req.params;
  const config = PLATFORMS[platform];

  if (!config) {
    return res.status(400).json({ error: 'Unknown platform' });
  }

  const wsEndpoint = await getWSEndpoint(config.port);

  res.json({
    platform: config.name,
    port: config.port,
    wsEndpoint: wsEndpoint,
    running: !!runningProcesses[platform]
  });
});

const PORT = 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Chrome Server running on http://0.0.0.0:${PORT}`);
  console.log('Platforms:', Object.keys(PLATFORMS).join(', '));
});
