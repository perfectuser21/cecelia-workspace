/**
 * VPS 端抓取脚本
 * 通过 CDP 远程控制 Windows 上的 Chrome
 * 所有抓取逻辑都在 VPS 端
 */

const puppeteer = require('puppeteer-core');
const http = require('http');

// Windows Runner 地址 (node 机器)
const WINDOWS_IP = '100.97.242.124';
const RUNNER_PORT = 3000;
const API_KEY = 'runner-secure-key-ax2024-9f8e7d6c5b4a';

// 平台配置 - 外部端口 = 内部端口 + 10000
const PLATFORMS = {
  'douyin': {
    name: '抖音',
    cdpPort: 19222,
    dataUrl: 'https://creator.douyin.com/creator-micro/data-center/content',
    extract: extractDouyin
  },
  'kuaishou': {
    name: '快手',
    cdpPort: 19223,
    dataUrl: 'https://cp.kuaishou.com/article/manage/video',
    extract: extractKuaishou
  },
  'xiaohongshu': {
    name: '小红书',
    cdpPort: 19224,
    dataUrl: 'https://creator.xiaohongshu.com/creator/notes',
    extract: extractXiaohongshu
  },
  'toutiao-main': {
    name: '头条主号',
    cdpPort: 19225,
    dataUrl: 'https://mp.toutiao.com/profile_v4/graphic/articles',
    extract: extractToutiao
  },
  'toutiao-sub': {
    name: '头条副号',
    cdpPort: 19226,
    dataUrl: 'https://mp.toutiao.com/profile_v4/graphic/articles',
    extract: extractToutiao
  },
  'weibo': {
    name: '微博',
    cdpPort: 19227,
    dataUrl: 'https://weibo.com/u/page/like',
    extract: extractWeibo
  },
  'shipinhao': {
    name: '视频号',
    cdpPort: 19228,
    dataUrl: 'https://channels.weixin.qq.com/platform/post/list',
    extract: extractShipinhao
  },
  'gongzhonghao': {
    name: '公众号',
    cdpPort: 19229,
    dataUrl: 'https://mp.weixin.qq.com/cgi-bin/appmsg',
    extract: extractGongzhonghao
  },
  'zhihu': {
    name: '知乎',
    cdpPort: 19230,
    dataUrl: 'https://www.zhihu.com/creator/manage/creation/all',
    extract: extractZhihu
  }
};

// ============ 提取函数 ============

async function extractDouyin(page) {
  await new Promise(r => setTimeout(r, 3000));

  // 点击投稿列表
  await page.evaluate(() => {
    const spans = Array.from(document.querySelectorAll('span'));
    for (const span of spans) {
      if (span.textContent.includes('投稿列表')) {
        span.click();
        break;
      }
    }
  });
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const rows = document.querySelectorAll('tbody tr');

    rows.forEach((row, i) => {
      if (i >= 20) return;
      const cells = row.querySelectorAll('td');
      if (cells.length >= 4) {
        const title = cells[0]?.innerText?.trim()?.substring(0, 100) || '';
        const views = cells[1]?.innerText?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') || '0';
        const likes = cells[2]?.innerText?.match(/[\d,]+/)?.[0]?.replace(/,/g, '') || '0';

        if (title.length > 5) {
          items.push({
            platform: 'douyin',
            content_type: '视频',
            title,
            views: parseInt(views) || 0,
            likes: parseInt(likes) || 0,
            comments: 0, shares: 0, favorites: 0
          });
        }
      }
    });

    // 账号信息
    const text = document.body.innerText;
    const account = {
      followers: text.match(/粉丝\s*([\d,.万]+)/)?.[1] || '',
      likes: text.match(/获赞\s*([\d,.万]+)/)?.[1] || ''
    };

    return { account, items, count: items.length };
  });
}

async function extractKuaishou(page) {
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const rows = document.querySelectorAll('tbody tr, [class*="video-item"]');

    rows.forEach((row, i) => {
      if (i >= 20) return;
      const text = row.innerText || '';
      const title = text.split('\n')[0]?.substring(0, 100) || '';
      const views = text.match(/播放[：:\s]*([\d,.万]+)/)?.[1] || '0';

      if (title.length > 5) {
        items.push({
          platform: 'kuaishou',
          content_type: '视频',
          title,
          views: parseInt(views.replace(/[,.万]/g, '')) || 0,
          likes: 0, comments: 0, shares: 0, favorites: 0
        });
      }
    });

    return { items, count: items.length };
  });
}

async function extractXiaohongshu(page) {
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const rows = document.querySelectorAll('tbody tr, [class*="note-item"]');

    rows.forEach((row, i) => {
      if (i >= 20) return;
      const text = row.innerText || '';
      const lines = text.split('\n').filter(l => l.trim());
      const title = lines[0]?.substring(0, 100) || '';
      const views = text.match(/曝光[：:\s]*([\d,.万]+)/)?.[1] || '0';
      const likes = text.match(/点赞[：:\s]*([\d,.万]+)/)?.[1] || '0';

      if (title.length > 3) {
        items.push({
          platform: 'xiaohongshu',
          content_type: '图文',
          title,
          views: parseInt(views.replace(/[,.万]/g, '')) || 0,
          likes: parseInt(likes.replace(/[,.万]/g, '')) || 0,
          comments: 0, shares: 0, favorites: 0
        });
      }
    });

    const text = document.body.innerText;
    const account = {
      followers: text.match(/粉丝数\n(\d+)/)?.[1] || '',
      likes: text.match(/获赞与收藏\n(\d+)/)?.[1] || ''
    };

    return { account, items, count: items.length };
  });
}

async function extractToutiao(page) {
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const rows = document.querySelectorAll('tbody tr, [class*="article-item"]');

    rows.forEach((row, i) => {
      if (i >= 20) return;
      const text = row.innerText || '';
      const title = text.split('\n')[0]?.substring(0, 100) || '';
      const views = text.match(/展现[：:\s]*([\d,.万]+)/)?.[1] ||
                    text.match(/阅读[：:\s]*([\d,.万]+)/)?.[1] || '0';

      if (title.length > 5) {
        items.push({
          platform: 'toutiao',
          content_type: '文章',
          title,
          views: parseInt(views.replace(/[,.万]/g, '')) || 0,
          likes: 0, comments: 0, shares: 0, favorites: 0
        });
      }
    });

    return { items, count: items.length };
  });
}

async function extractWeibo(page) {
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const posts = document.querySelectorAll('[class*="card"], [class*="Feed"]');

    posts.forEach((post, i) => {
      if (i >= 20) return;
      const text = post.innerText || '';
      const title = text.substring(0, 100);

      if (title.length > 10) {
        items.push({
          platform: 'weibo',
          content_type: '微博',
          title,
          views: 0, likes: 0, comments: 0, shares: 0, favorites: 0
        });
      }
    });

    return { items, count: items.length };
  });
}

async function extractShipinhao(page) {
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const posts = document.querySelectorAll('[class*="post"], [class*="video-item"]');

    posts.forEach((post, i) => {
      if (i >= 20) return;
      const text = post.innerText || '';
      const title = text.split('\n')[0]?.substring(0, 100) || '';

      if (title.length > 3) {
        items.push({
          platform: 'shipinhao',
          content_type: '视频',
          title,
          views: 0, likes: 0, comments: 0, shares: 0, favorites: 0
        });
      }
    });

    const text = document.body.innerText;
    const account = {
      videos: text.match(/视频(\d+)/)?.[1] || '',
      followers: text.match(/关注者(\d+)/)?.[1] || ''
    };

    return { account, items, count: items.length };
  });
}

async function extractGongzhonghao(page) {
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const articles = document.querySelectorAll('[class*="article"], [class*="appmsg"]');

    articles.forEach((article, i) => {
      if (i >= 20) return;
      const text = article.innerText || '';
      const title = text.split('\n')[0]?.substring(0, 100) || '';
      const views = text.match(/阅读\s*(\d+)/)?.[1] || '0';

      if (title.length > 3) {
        items.push({
          platform: 'gongzhonghao',
          content_type: '文章',
          title,
          views: parseInt(views) || 0,
          likes: 0, comments: 0, shares: 0, favorites: 0
        });
      }
    });

    const text = document.body.innerText;
    const account = {
      users: text.match(/总用户数\n(\d+)/)?.[1] || ''
    };

    return { account, items, count: items.length };
  });
}

async function extractZhihu(page) {
  await new Promise(r => setTimeout(r, 3000));

  return await page.evaluate(() => {
    const items = [];
    const contents = document.querySelectorAll('[class*="ContentItem"], [class*="article"]');

    contents.forEach((content, i) => {
      if (i >= 20) return;
      const text = content.innerText || '';
      const title = text.split('\n')[0]?.substring(0, 100) || '';
      const views = text.match(/阅读\s*(\d+)/)?.[1] || '0';

      if (title.length > 5) {
        items.push({
          platform: 'zhihu',
          content_type: '文章',
          title,
          views: parseInt(views) || 0,
          likes: 0, comments: 0, shares: 0, favorites: 0
        });
      }
    });

    const text = document.body.innerText;
    const account = {
      level: text.match(/Lv\s*(\d+)/)?.[1] || '',
      score: text.match(/创作分\s*([\d,]+)/)?.[1] || ''
    };

    return { account, items, count: items.length };
  });
}

// ============ 主函数 ============

async function startChrome(platform) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({ platform });
    const req = http.request({
      hostname: WINDOWS_IP,
      port: RUNNER_PORT,
      path: '/start',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': API_KEY
      }
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
    req.write(data);
    req.end();
  });
}

async function scrape(platformId) {
  const platform = PLATFORMS[platformId];
  if (!platform) {
    console.error(`Unknown platform: ${platformId}`);
    return null;
  }

  console.error(`[${platform.name}] 启动 Chrome...`);

  // 启动 Windows 上的 Chrome
  const startResult = await startChrome(platformId);
  if (!startResult.success) {
    console.error(`Failed to start Chrome: ${startResult.error}`);
    return null;
  }

  console.error(`[${platform.name}] CDP 端口: ${platform.cdpPort}`);

  // 等待 Chrome 就绪
  await new Promise(r => setTimeout(r, 2000));

  // 连接到 Chrome - 使用转发端口 (内部端口+10000)
  let wsEndpoint = startResult.wsEndpoint;
  if (wsEndpoint) {
    // 替换 localhost 为 ROG IP，内部端口替换为外部端口
    wsEndpoint = wsEndpoint
      .replace('localhost', WINDOWS_IP)
      .replace(/:(\d{4})\//, (_, port) => `:${parseInt(port) + 10000}/`);
  } else {
    wsEndpoint = `ws://${WINDOWS_IP}:${platform.cdpPort}/devtools/browser`;
  }
  console.error(`[${platform.name}] WebSocket: ${wsEndpoint}`);

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: { width: 1920, height: 1080 }
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    console.error(`[${platform.name}] 导航到: ${platform.dataUrl}`);
    await page.goto(platform.dataUrl, { waitUntil: 'networkidle2', timeout: 60000 });

    console.error(`[${platform.name}] 提取数据...`);
    const data = await platform.extract(page);

    // 为每个 item 添加必需字段
    const now = new Date().toISOString();
    if (data.items) {
      data.items = data.items.map(item => ({
        ...item,
        publish_time: item.publish_time || now,
        status: item.status || 'published'
      }));
    }

    console.error(`[${platform.name}] 提取到 ${data.count} 条数据`);

    // 不关闭浏览器，保持登录状态
    browser.disconnect();

    return {
      success: true,
      platform: platform.name,
      ...data
    };
  } catch (error) {
    console.error(`[${platform.name}] 错误:`, error.message);
    return {
      success: false,
      platform: platform.name,
      error: error.message
    };
  }
}

// CLI 入口
const arg = process.argv[2];
if (arg && PLATFORMS[arg]) {
  scrape(arg).then(result => {
    console.log(JSON.stringify(result, null, 2));
  });
} else if (arg === 'all') {
  (async () => {
    for (const p of Object.keys(PLATFORMS)) {
      const result = await scrape(p);
      console.log(`${p}: ${result?.success ? '✓' : '✗'} ${result?.count || 0} items`);
    }
  })();
} else {
  console.error('Usage: node vps_scraper.js <platform|all>');
  console.error('Platforms:', Object.keys(PLATFORMS).join(', '));
}

module.exports = { scrape, PLATFORMS };
