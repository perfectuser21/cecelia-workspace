// Session status route - monitors Windows Chrome login sessions via CDP
import { Router, Request, Response } from 'express';
import * as http from 'http';

const router = Router();

// Windows Runner 配置
const WINDOWS_IP = '100.98.253.95';
const RUNNER_PORT = 3000;
const API_KEY = 'runner-secure-key-ax2024-9f8e7d6c5b4a';

// 平台配置 - CDP 端口
const PLATFORMS: { [key: string]: PlatformConfig } = {
  douyin: {
    name: '抖音',
    cdpPort: 19222,
    loginUrls: ['creator.douyin.com'],
    logoutPatterns: ['login', 'passport', 'sso']
  },
  kuaishou: {
    name: '快手',
    cdpPort: 19223,
    loginUrls: ['cp.kuaishou.com'],
    logoutPatterns: ['login', 'passport', 'account']
  },
  xiaohongshu: {
    name: '小红书',
    cdpPort: 19224,
    loginUrls: ['creator.xiaohongshu.com'],
    logoutPatterns: ['login', 'passport']
  },
  'toutiao-main': {
    name: '头条主号',
    cdpPort: 19225,
    loginUrls: ['mp.toutiao.com'],
    logoutPatterns: ['login', 'passport', 'sso']
  },
  'toutiao-sub': {
    name: '头条副号',
    cdpPort: 19226,
    loginUrls: ['mp.toutiao.com'],
    logoutPatterns: ['login', 'passport', 'sso']
  },
  weibo: {
    name: '微博',
    cdpPort: 19227,
    loginUrls: ['weibo.com'],
    logoutPatterns: ['login', 'passport']
  },
  shipinhao: {
    name: '视频号',
    cdpPort: 19228,
    loginUrls: ['channels.weixin.qq.com'],
    logoutPatterns: ['login', 'auth']
  },
  gongzhonghao: {
    name: '公众号',
    cdpPort: 19229,
    loginUrls: ['mp.weixin.qq.com'],
    logoutPatterns: ['login', 'auth', 'scanloginqrcode']
  },
  zhihu: {
    name: '知乎',
    cdpPort: 19230,
    loginUrls: ['zhihu.com/creator'],
    logoutPatterns: ['signin', 'login']
  }
};

interface PlatformConfig {
  name: string;
  cdpPort: number;
  loginUrls: string[];  // 登录后应该在的 URL
  logoutPatterns: string[];  // URL 中包含这些表示已掉线
}

interface PlatformStatus {
  name: string;
  status: 'online' | 'offline' | 'unknown';
  currentUrl?: string;
  lastCheck: string;
  error?: string;
}

// 内存缓存状态
let statusCache: { [key: string]: PlatformStatus } = {};
let lastFullCheck: string | null = null;

// 检查单个平台的 Chrome 状态
async function checkPlatformStatus(platformId: string, config: PlatformConfig): Promise<PlatformStatus> {
  const result: PlatformStatus = {
    name: config.name,
    status: 'unknown',
    lastCheck: new Date().toISOString()
  };

  try {
    // 通过 CDP 获取浏览器信息
    const cdpInfo = await fetchCdpInfo(config.cdpPort);

    if (!cdpInfo || cdpInfo.length === 0) {
      result.status = 'offline';
      result.error = 'Chrome 未运行';
      return result;
    }

    // 找到主页面（非 devtools 和 extension 页面）
    const mainPage = cdpInfo.find((page: any) =>
      page.type === 'page' &&
      !page.url.startsWith('devtools://') &&
      !page.url.startsWith('chrome-extension://')
    );

    if (!mainPage) {
      result.status = 'unknown';
      result.error = '未找到主页面';
      return result;
    }

    result.currentUrl = mainPage.url;

    // 判断登录状态
    const url = mainPage.url.toLowerCase();

    // 检查是否在登录页面（已掉线）
    const isLogoutPage = config.logoutPatterns.some(pattern => url.includes(pattern));
    if (isLogoutPage) {
      result.status = 'offline';
      return result;
    }

    // 检查是否在正常的创作者页面（已登录）
    const isLoginPage = config.loginUrls.some(pattern => url.includes(pattern));
    if (isLoginPage) {
      result.status = 'online';
      return result;
    }

    // 其他情况标记为未知
    result.status = 'unknown';

  } catch (error: any) {
    result.status = 'offline';
    result.error = error.message;
  }

  return result;
}

// 获取 CDP 页面信息
function fetchCdpInfo(port: number): Promise<any[]> {
  return new Promise((resolve, reject) => {
    const req = http.request({
      hostname: WINDOWS_IP,
      port: port,
      path: '/json',
      method: 'GET',
      timeout: 5000
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(body));
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Connection timeout'));
    });
    req.end();
  });
}

// 检查 Windows Runner 健康状态
async function checkRunnerHealth(): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.request({
      hostname: WINDOWS_IP,
      port: RUNNER_PORT,
      path: '/health',
      method: 'GET',
      timeout: 5000,
      headers: { 'X-API-Key': API_KEY }
    }, (res) => {
      resolve(res.statusCode === 200);
    });

    req.on('error', () => resolve(false));
    req.on('timeout', () => {
      req.destroy();
      resolve(false);
    });
    req.end();
  });
}

// GET /status - 获取所有平台状态
router.get('/status', async (req: Request, res: Response) => {
  try {
    // 检查 Runner 健康状态
    const runnerHealthy = await checkRunnerHealth();

    res.json({
      success: true,
      runner_status: runnerHealthy ? 'online' : 'offline',
      last_check: lastFullCheck,
      platforms: statusCache
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /check - 手动触发检查所有平台
router.post('/check', async (req: Request, res: Response) => {
  try {
    const results: { [key: string]: PlatformStatus } = {};

    // 并发检查所有平台
    const checks = Object.entries(PLATFORMS).map(async ([id, config]) => {
      const status = await checkPlatformStatus(id, config);
      results[id] = status;
    });

    await Promise.all(checks);

    // 更新缓存
    statusCache = results;
    lastFullCheck = new Date().toISOString();

    res.json({
      success: true,
      message: '检查完成',
      last_check: lastFullCheck,
      platforms: results
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /check/:platform - 检查单个平台
router.get('/check/:platform', async (req: Request, res: Response) => {
  try {
    const { platform } = req.params;
    const config = PLATFORMS[platform];

    if (!config) {
      return res.status(404).json({
        success: false,
        error: `未知平台: ${platform}`
      });
    }

    const status = await checkPlatformStatus(platform, config);
    statusCache[platform] = status;

    res.json({
      success: true,
      platform,
      ...status
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /runner - 获取 Runner 状态
router.get('/runner', async (req: Request, res: Response) => {
  try {
    const healthy = await checkRunnerHealth();

    res.json({
      success: true,
      runner_ip: WINDOWS_IP,
      runner_port: RUNNER_PORT,
      status: healthy ? 'online' : 'offline'
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
