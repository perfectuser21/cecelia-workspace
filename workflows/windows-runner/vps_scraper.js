/**
 * VPS 端抓取脚本
 * 通过 CDP 远程控制 Windows 上的 Chrome
 * 所有抓取逻辑都在 VPS 端
 */

const puppeteer = require('puppeteer-core');
const http = require('http');

// Windows Runner 地址
const WINDOWS_IP = '100.97.242.124';  // 新 Windows 机器
const RUNNER_PORT = 3000;
const API_KEY = 'runner-secure-key-ax2024-9f8e7d6c5b4a';

// 平台配置 - 外部端口 = 内部端口 + 10000
const PLATFORMS = {
  'douyin': {
    name: '抖音',
    cdpPort: 19222,
    dataUrl: 'https://creator.douyin.com/creator-micro/content/manage',
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
    dataUrl: 'https://creator.xiaohongshu.com/new/note-manager',
    extract: extractXiaohongshu
  },
  'toutiao-main': {
    name: '头条主号',
    cdpPort: 19225,
    dataUrl: 'https://mp.toutiao.com/profile_v4/manage/content/all',
    extract: extractToutiao
  },
  'toutiao-sub': {
    name: '头条副号',
    cdpPort: 19226,
    dataUrl: 'https://mp.toutiao.com/profile_v4/manage/content/all',
    extract: extractToutiao
  },
  'weibo': {
    name: '微博',
    cdpPort: 19227,
    dataUrl: 'https://me.weibo.com',
    extract: extractWeibo
  },
  'shipinhao': {
    name: '视频号',
    cdpPort: 19228,
    dataUrl: null,  // 不导航，直接使用当前页面
    extract: extractShipinhao
  },
  'shipinhao_old': {
    name: '视频号',
    cdpPort: 19228,
    dataUrl: 'https://channels.weixin.qq.com/platform/post/list',
    extract: extractShipinhao
  },
  'gongzhonghao': {
    name: '公众号',
    cdpPort: 19229,
    dataUrl: null,  // 不导航，使用当前页面
    extract: extractGongzhonghao
  },
  'zhihu': {
    name: '知乎',
    cdpPort: 19230,
    dataUrl: null,  // 不导航，使用当前页面
    extract: extractZhihu
  }
};

// ============ 辅助函数 ============

// 滚动页面加载更多内容
async function scrollToLoadMore(page, maxScrolls = 10, scrollDelay = 1500) {
  let previousHeight = 0;
  let scrollCount = 0;

  while (scrollCount < maxScrolls) {
    const currentHeight = await page.evaluate(() => document.body.scrollHeight);

    if (currentHeight === previousHeight) {
      // 没有新内容加载，停止滚动
      break;
    }

    previousHeight = currentHeight;
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, scrollDelay));
    scrollCount++;
  }

  // 滚回顶部
  await page.evaluate(() => window.scrollTo(0, 0));
  await new Promise(r => setTimeout(r, 500));

  return scrollCount;
}

// 解析中文日期 (支持多种格式)
function parseChineseDate(dateStr) {
  if (!dateStr) return null;

  const now = new Date();
  const year = now.getFullYear();

  // 格式: 2025年12月25日 15:45
  let match = dateStr.match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
  if (match) {
    return new Date(match[1], match[2] - 1, match[3], match[4], match[5]);
  }

  // 格式: 12月25日 15:45 (当年)
  match = dateStr.match(/(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);
  if (match) {
    return new Date(year, match[1] - 1, match[2], match[3], match[4]);
  }

  // 格式: 12-25 15:38
  match = dateStr.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (match) {
    return new Date(year, match[1] - 1, match[2], match[3], match[4]);
  }

  // 格式: 2020-07-29 18:26
  match = dateStr.match(/(\d{4})-(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
  if (match) {
    return new Date(match[1], match[2] - 1, match[3], match[4], match[5]);
  }

  // 格式: X天前, X小时前
  match = dateStr.match(/(\d+)\s*(天|小时|分钟)前/);
  if (match) {
    const num = parseInt(match[1]);
    const unit = match[2];
    const d = new Date();
    if (unit === '天') d.setDate(d.getDate() - num);
    else if (unit === '小时') d.setHours(d.getHours() - num);
    else if (unit === '分钟') d.setMinutes(d.getMinutes() - num);
    return d;
  }

  return null;
}

// 检查日期是否在最近N天内
function isWithinDays(date, days = 30) {
  if (!date) return false;
  const now = new Date();
  const diffTime = now.getTime() - date.getTime();
  const diffDays = diffTime / (1000 * 60 * 60 * 24);
  return diffDays <= days && diffDays >= 0;
}

// ============ 提取函数 ============

async function extractDouyin(page) {
  await new Promise(r => setTimeout(r, 3000));

  // 滚动加载更多作品（新页面是卡片式无限滚动）
  let prevHeight = 0;
  for (let i = 0; i < 50; i++) {
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await new Promise(r => setTimeout(r, 1000));
    const height = await page.evaluate(() => document.body.scrollHeight);
    if (height === prevHeight) {
      await new Promise(r => setTimeout(r, 2000));
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      if (newHeight === height) break;
    }
    prevHeight = height;
  }

  await new Promise(r => setTimeout(r, 2000));

  const rawItems = await page.evaluate(() => {
    const items = [];
    const text = document.body.innerText;
    const lines = text.split("\n").map(l => l.trim()).filter(l => l);

    for (let i = 0; i < lines.length; i++) {
      const dateMatch = lines[i].match(/(\d{4})年(\d{1,2})月(\d{1,2})日\s*(\d{1,2}):(\d{2})/);

      if (dateMatch) {
        let title = "";
        for (let j = i - 1; j >= Math.max(0, i - 10); j--) {
          const line = lines[j];
          if (line && line.length > 10 &&
              !line.includes("编辑作品") && !line.includes("设置权限") &&
              !line.includes("删除作品") && !line.includes("置顶") &&
              !line.includes("取消置顶") && !line.includes("作品管理") &&
              !line.match(/^\d+[张秒%]?$/) && !line.match(/^[\d:]+$/)) {
            title = line.substring(0, 150);
            break;
          }
        }

        const metrics = { views: 0, likes: 0, comments: 0, shares: 0, favorites: 0 };
        for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
          const line = lines[j];
          if (line === "播放" && lines[j+1] && lines[j+1].match(/^[\d,]+$/)) {
            metrics.views = parseInt(lines[j+1].replace(/,/g, "")) || 0;
          }
          if (line === "点赞" && lines[j+1] && lines[j+1].match(/^[\d,]+$/)) {
            metrics.likes = parseInt(lines[j+1].replace(/,/g, "")) || 0;
          }
          if (line === "评论" && lines[j+1] && lines[j+1].match(/^[\d,]+$/)) {
            metrics.comments = parseInt(lines[j+1].replace(/,/g, "")) || 0;
          }
          if (line === "分享" && lines[j+1] && lines[j+1].match(/^[\d,]+$/)) {
            metrics.shares = parseInt(lines[j+1].replace(/,/g, "")) || 0;
          }
          if (line === "收藏" && lines[j+1] && lines[j+1].match(/^[\d,]+$/)) {
            metrics.favorites = parseInt(lines[j+1].replace(/,/g, "")) || 0;
          }
          if (lines[j].match(/\d{4}年\d{1,2}月\d{1,2}日/)) break;
        }

        if (title && title.length > 5) {
          const y = dateMatch[1];
          const m = dateMatch[2].padStart(2, "0");
          const d = dateMatch[3].padStart(2, "0");
          const h = dateMatch[4].padStart(2, "0");
          const min = dateMatch[5];
          const dateStr = y + "-" + m + "-" + d + "T" + h + ":" + min + ":00";

          // 优化: 统一的内容类型识别算法
          // 在日期附近10行内查找类型标识，按优先级匹配
          let contentType = "视频"; // 默认
          const searchRange = 10;

          for (let j = Math.max(0, i - searchRange); j < Math.min(lines.length, i + 3); j++) {
            const line = lines[j] || "";

            // 优先级1: 直播回放（最明确）
            if (line.includes("直播回放") || line.includes("直播")) {
              contentType = "直播";
              break;
            }

            // 优先级2: 图文（X张）
            if (line.match(/^\d+张$/)) {
              contentType = "图文";
              break;
            }

            // 优先级3: 视频（XX:XX 时长）
            if (line.match(/^\d{1,2}:\d{2}$/)) {
              contentType = "视频";
              break;
            }
          }

          items.push({
            platform: "douyin",
            content_type: contentType,
            title,
            dateStr,
            views: metrics.views,
            likes: metrics.likes,
            comments: metrics.comments,
            shares: metrics.shares,
            favorites: metrics.favorites
          });
        }
      }
    }

    const totalMatch = text.match(/共\s*(\d+)\s*个作品/);
    const account = {
      total: totalMatch ? totalMatch[1] : "",
      followers: text.match(/粉丝[：:\s]*([\d,.万]+)/)?.[1] || ""
    };

    return { account, items };
  });

  const seen = new Set();
  const items = rawItems.items.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);

    if (item.dateStr) {
      const date = new Date(item.dateStr + "+08:00");
      item.publish_time = date.toISOString();
      delete item.dateStr;
      const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }
    delete item.dateStr;
    return true;
  });

  return { account: rawItems.account, items, count: items.length };
}
async function extractKuaishou(page) {
  await new Promise(r => setTimeout(r, 3000));

  // 滚动加载更多
  await scrollToLoadMore(page, 15, 1500);

  const rawItems = await page.evaluate(() => {
    const items = [];
    const text = document.body.innerText;

    // 快手页面按内容块分割
    const contentBlocks = text.split(/(?=如果|很多|你有|同一|当|在|只要|做|别|不要|真正|一个)/);

    // 尝试从表格提取
    const rows = document.querySelectorAll('tbody tr, [class*="video-item"], [class*="content-item"]');
    rows.forEach((row) => {
      const rowText = row.innerText || '';
      const lines = rowText.split('\n').filter(l => l.trim());
      if (lines.length < 2) return;

      const title = lines[0]?.substring(0, 100) || '';
      // 查找日期
      const dateStr = lines.find(l => l.match(/\d{4}-\d{2}-\d{2}|\d+[天小时分钟]前|\d{1,2}月\d{1,2}日/)) || '';
      const views = rowText.match(/播放[：:\s]*([\d,.万]+)/)?.[1] || rowText.match(/(\d+\.?\d*万?)次播放/)?.[1] || '0';
      const likes = rowText.match(/点赞[：:\s]*([\d,.万]+)/)?.[1] || '0';

      const parseNum = (s) => {
        if (!s) return 0;
        s = s.replace(/,/g, '');
        if (s.includes('万')) return Math.round(parseFloat(s) * 10000);
        return parseInt(s) || 0;
      };

      if (title.length > 5) {
        items.push({
          platform: 'kuaishou',
          content_type: '视频',
          title,
          dateStr,
          views: parseNum(views),
          likes: parseNum(likes),
          comments: 0, shares: 0, favorites: 0
        });
      }
    });

    return { items };
  });

  // 过滤30天内
  const items = rawItems.items.filter(item => {
    const date = parseChineseDate(item.dateStr);
    delete item.dateStr;
    if (date) {
      item.publish_time = date.toISOString();
      return isWithinDays(date, 30);
    }
    return true;
  });

  return { items, count: items.length };
}

async function extractXiaohongshu(page) {
  console.log('[小红书] 开始抓取数据...');
  await new Promise(r => setTimeout(r, 3000));

  // 滚动加载更多
  console.log('[小红书] 滚动加载更多内容...');
  const scrollCount = await scrollToLoadMore(page, 15, 1500);
  console.log(`[小红书] 完成 ${scrollCount} 次滚动`);

  const rawItems = await page.evaluate(() => {
    const items = [];
    const text = document.body.innerText;
    console.log('[小红书] 页面文本长度:', text.length);

    // 方法1: 尝试使用 DOM 选择器（更可靠）
    try {
      const noteCards = document.querySelectorAll('[class*="note"], [class*="card"], [class*="item"]');
      console.log('[小红书] 找到候选卡片数:', noteCards.length);

      noteCards.forEach((card, idx) => {
        const cardText = card.innerText || '';

        // 提取标题（通常在最前面）
        const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);
        if (lines.length === 0) return;

        // 查找日期
        const dateMatch = cardText.match(/发布于\s*(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2})/);
        if (!dateMatch) return;

        // 提取标题（日期之前的第一行有意义的文本）
        let title = '';
        for (const line of lines) {
          if (line.length > 5 &&
              !line.includes('发布于') &&
              !line.includes('权限设置') &&
              !line.includes('编辑') &&
              !line.includes('删除') &&
              !line.includes('数据') &&
              !line.match(/^\d+$/)) {
            title = line.substring(0, 100);
            break;
          }
        }

        if (!title) return;

        // 提取指标（查找5个连续的纯数字行）
        const numbers = [];
        for (let i = 0; i < lines.length - 4; i++) {
          if (lines.slice(i, i+5).every(l => /^\d+$/.test(l))) {
            numbers.push(...lines.slice(i, i+5).map(n => parseInt(n)));
            break;
          }
        }

        // 如果找不到5个连续数字，尝试单独提取
        if (numbers.length === 0) {
          const allNumbers = cardText.match(/\n(\d+)\n/g);
          if (allNumbers && allNumbers.length >= 5) {
            numbers.push(...allNumbers.slice(0, 5).map(n => parseInt(n.trim())));
          }
        }

        items.push({
          platform: 'xiaohongshu',
          content_type: '图文',
          title,
          dateStr: dateMatch[1],
          views: numbers[0] || 0,
          likes: numbers[1] || 0,
          comments: numbers[2] || 0,
          shares: numbers[3] || 0,
          favorites: numbers[4] || 0
        });
      });

      console.log('[小红书] DOM方法提取到', items.length, '条笔记');
    } catch (e) {
      console.log('[小红书] DOM方法失败:', e.message);
    }

    // 方法2: 如果DOM方法失败，使用文本分割（兜底）
    if (items.length === 0) {
      console.log('[小红书] 使用文本分割方法（兜底）');
      const parts = text.split(/(?=发布于\s*\d{4}年)/);
      console.log('[小红书] 分割成', parts.length, '个部分');

      parts.forEach((part, i) => {
        if (!part.includes('发布于')) return;

        const dateMatch = part.match(/发布于\s*(\d{4}年\d{1,2}月\d{1,2}日\s*\d{1,2}:\d{2})/);
        if (!dateMatch) return;

        // 在当前部分查找标题（发布于之前的内容）
        const beforeDate = part.split(/发布于/)[0];
        const lines = beforeDate.split('\n').map(l => l.trim()).filter(l => l);

        let title = '';
        // 从后往前找标题（最接近"发布于"的有意义文本）
        for (let j = lines.length - 1; j >= 0; j--) {
          const line = lines[j];
          if (line.length > 5 &&
              !line.includes('权限设置') &&
              !line.includes('编辑') &&
              !line.includes('删除') &&
              !line.includes('数据') &&
              !line.match(/^\d+$/)) {
            title = line.substring(0, 100);
            break;
          }
        }

        if (!title && i > 0) {
          // 如果当前部分找不到，尝试前一个部分的末尾
          const prevPart = parts[i-1] || '';
          const prevLines = prevPart.split('\n').filter(l => l.trim());
          title = prevLines[prevLines.length - 1]?.substring(0, 100) || '';
        }

        // 提取指标
        const metricsMatch = part.match(/发布于.*?\n(\d+)\n(\d+)\n(\d+)\n(\d+)\n(\d+)/s);

        if (title && title.length > 5) {
          items.push({
            platform: 'xiaohongshu',
            content_type: '图文',
            title,
            dateStr: dateMatch[1],
            views: metricsMatch ? parseInt(metricsMatch[1]) || 0 : 0,
            likes: metricsMatch ? parseInt(metricsMatch[2]) || 0 : 0,
            comments: metricsMatch ? parseInt(metricsMatch[3]) || 0 : 0,
            shares: metricsMatch ? parseInt(metricsMatch[4]) || 0 : 0,
            favorites: metricsMatch ? parseInt(metricsMatch[5]) || 0 : 0
          });
        }
      });

      console.log('[小红书] 文本方法提取到', items.length, '条笔记');
    }

    // 提取账号信息
    const account = {
      followers: text.match(/粉丝数[^\d]*(\d+)/)?.[1] || '',
      likes: text.match(/获赞与收藏[^\d]*(\d+)/)?.[1] || ''
    };

    return { account, items };
  });

  console.log(`[小红书] 原始提取: ${rawItems.items.length} 条`);

  // 过滤30天内
  const items = rawItems.items.filter(item => {
    const date = parseChineseDate(item.dateStr);
    delete item.dateStr;
    if (date) {
      item.publish_time = date.toISOString();
      return isWithinDays(date, 30);
    }
    return true;
  });

  console.log(`[小红书] 过滤后: ${items.length} 条（30天内）`);

  if (items.length > 0) {
    console.log(`[小红书] 示例数据:`, JSON.stringify(items[0], null, 2));
  } else {
    console.warn('[小红书] 警告: 未提取到任何数据');
  }

  return { account: rawItems.account, items, count: items.length };
}

async function extractToutiao(page) {
  await new Promise(r => setTimeout(r, 3000));

  const allItems = [];
  let pageNum = 1;
  const maxPages = 30;
  let consecutiveEmptyPages = 0;

  while (pageNum <= maxPages) {
    console.log(`[头条] 正在抓取第 ${pageNum} 页...`);

    // 优化1: 减少等待时间（首页已经加载，后续页面更快）
    await new Promise(r => setTimeout(r, pageNum === 1 ? 1000 : 800));

    const pageItems = await page.evaluate(() => {
      const items = [];
      const text = document.body.innerText;
      const lines = text.split("\n").map(l => l.trim()).filter(l => l);

      // 2025年1月更新：适配新的页面结构
      // 日期格式：2025-12-22 15:49
      // 指标格式：展现 1895阅读 9点赞 1评论 0

      for (let i = 0; i < lines.length; i++) {
        // 匹配新日期格式：YYYY-MM-DD HH:MM
        const dateMatch = lines[i].match(/^(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2})$/);
        if (!dateMatch) continue;

        // 向上查找标题（在"展开"之前的长文本）
        let title = "";
        for (let j = i - 1; j >= Math.max(0, i - 20); j--) {
          const line = lines[j];
          // 跳过常见的非标题行
          if (!line || line.length < 10) continue;
          if (line === "展开") continue;
          if (line.includes("已发布") || line.includes("首发")) continue;
          if (line.includes("查看数据") || line.includes("查看评论")) continue;
          if (line.includes("修改") || line.includes("更多")) continue;
          if (line.includes("删除") || line.includes("置顶")) continue;
          if (line.match(/^[\d-:\s]+$/)) continue;
          if (line.match(/^展现\s*\d+/)) continue;

          // 找到标题（通常是最长的有意义文本）
          if (line.length > title.length) {
            title = line;
          }

          // 如果遇到上一条的指标行，停止向上搜索
          if (line.match(/展现\s*\d+.*阅读\s*\d+/)) break;
        }

        // 向下查找指标（新格式：展现 1895阅读 9点赞 1评论 0）
        let views = 0, likes = 0, comments = 0;
        for (let j = i + 1; j < Math.min(lines.length, i + 15); j++) {
          const line = lines[j];

          // 新格式：展现 1895阅读 9点赞 1评论 0
          const metricsMatch = line.match(/展现\s*([\d,.万]+).*阅读\s*([\d,.万]+).*点赞\s*([\d,.万]+).*评论\s*([\d,.万]+)/);
          if (metricsMatch) {
            const parseNum = (s) => {
              if (!s) return 0;
              s = s.replace(/,/g, '');
              if (s.includes('万')) return Math.round(parseFloat(s) * 10000);
              return parseInt(s) || 0;
            };
            views = parseNum(metricsMatch[1]);
            likes = parseNum(metricsMatch[3]);
            comments = parseNum(metricsMatch[4]);
            break;
          }

          // 遇到下一条的日期，停止搜索
          if (line.match(/^\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}$/)) break;
        }

        if (title && title.length > 5) {
          // 识别内容类型
          let contentType = "微头条";
          if (title.length > 100) {
            contentType = "文章";
          }
          // 检查是否有视频标识
          for (let j = i - 5; j < i + 5 && j < lines.length; j++) {
            if (j >= 0 && lines[j] && (lines[j].includes("视频") || lines[j].match(/^\d{1,2}:\d{2}$/))) {
              contentType = "视频";
              break;
            }
          }

          const dateStr = `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}T${dateMatch[4]}:${dateMatch[5]}:00`;

          items.push({
            platform: "toutiao",
            content_type: contentType,
            title: title.substring(0, 150),
            dateStr,
            views,
            likes,
            comments,
            shares: 0,
            favorites: 0
          });
        }
      }

      return items;
    });

    console.log(`[头条] 第 ${pageNum} 页提取到 ${pageItems.length} 条`);

    // 优化5: 检测数据质量（如果多数指标为0，打印警告）
    if (pageItems.length > 0) {
      const zeroMetrics = pageItems.filter(item => item.views === 0 && item.likes === 0).length;
      if (zeroMetrics > pageItems.length * 0.5) {
        console.log(`[头条] 警告: ${zeroMetrics}/${pageItems.length} 条数据指标为0，可能需要调整提取逻辑`);
      }
    }

    allItems.push(...pageItems);

    if (pageItems.length === 0) {
      consecutiveEmptyPages++;
      if (consecutiveEmptyPages >= 2) {
        console.log(`[头条] 连续 ${consecutiveEmptyPages} 页无数据，停止`);
        break;
      }
    } else {
      consecutiveEmptyPages = 0;

      // 优化6: 检查最后一条是否超出30天，如果是则提前停止
      const lastItem = pageItems[pageItems.length - 1];
      if (lastItem.dateStr) {
        const lastDate = new Date(lastItem.dateStr + '+08:00');
        const daysDiff = (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
        if (daysDiff > 30) {
          console.log(`[头条] 已超出30天范围（最后一条: ${daysDiff.toFixed(1)}天前），停止翻页`);
          break;
        }
      }
    }

    // 点击下一页（优化7: 简化翻页逻辑，去除冗余验证）
    const hasNextPage = await page.evaluate(() => {
      const items = document.querySelectorAll(".fake-pagination-item");
      const icons = Array.from(items).filter(item =>
        item.className.includes("icon") &&
        !item.className.includes("disabled") &&
        !item.className.includes("more")
      );
      const nextBtn = icons[icons.length - 1];
      if (nextBtn) {
        nextBtn.click();
        return true;
      }
      return false;
    });

    if (!hasNextPage) {
      console.log(`[头条] 没有更多页面`);
      break;
    }

    pageNum++;
  }

  // 去重 + 30天过滤
  const seen = new Set();
  const items = allItems.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);

    if (item.dateStr) {
      const date = new Date(item.dateStr + "+08:00");
      item.publish_time = date.toISOString();
      delete item.dateStr;
      const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30;
    }
    delete item.dateStr;
    return true;
  });

  const accountInfo = await page.evaluate(() => {
    const text = document.body.innerText;
    return {
      total: text.match(/共\s*(\d+)\s*条/)?.[1] || "",
      followers: text.match(/粉丝\s*([\d,.万]+)/)?.[1] || ""
    };
  });

  return { account: accountInfo, items, count: items.length };
}

async function extractWeibo(page) {
  await new Promise(r => setTimeout(r, 3000));

  const allItems = [];
  let uid = null;

  // 优化1: 直接从移动版获取 UID（减少一次导航）
  try {
    console.log(`[微博] 导航到移动版获取 UID...`);
    await page.goto("https://m.weibo.cn", { waitUntil: "networkidle2", timeout: 30000 });
    await new Promise(r => setTimeout(r, 2000));

    uid = await page.evaluate(() => {
      // 尝试多种方式获取 UID
      if (window.$CONFIG && window.$CONFIG.uid) {
        return window.$CONFIG.uid.toString();
      }
      if (window.CONFIG && window.CONFIG.uid) {
        return window.CONFIG.uid.toString();
      }
      // 从页面 URL 或 localStorage 中提取
      const storage = localStorage.getItem('weiboUser');
      if (storage) {
        try {
          const data = JSON.parse(storage);
          if (data.uid) return data.uid.toString();
        } catch (e) {}
      }
      return null;
    });

    console.log(`[微博] 找到 UID: ${uid}`);
  } catch (e) {
    console.log(`[微博] 获取 UID 错误: ${e.message}`);
  }

  // 2. 使用移动版 API 分页获取所有微博
  if (uid) {
    try {
      console.log(`[微博] 使用移动版 API 分页获取...`);

      // 导航到用户主页以建立 cookie 上下文
      await page.goto(`https://m.weibo.cn/u/${uid}`, { waitUntil: "networkidle2", timeout: 60000 });
      await new Promise(r => setTimeout(r, 2000));

      const containerId = `107603${uid}`;
      let sinceId = '';
      let pageNum = 0;
      const maxPages = 20;
      let consecutiveEmptyPages = 0;

      while (pageNum < maxPages) {
        pageNum++;
        let url = `https://m.weibo.cn/api/container/getIndex?type=uid&value=${uid}&containerid=${containerId}`;
        if (sinceId) {
          url += `&since_id=${sinceId}`;
        }

        // 优化5: API 失败重试机制
        let result = null;
        let retries = 0;
        while (retries <= 1) {
          result = await page.evaluate(async (apiUrl) => {
            try {
              const resp = await fetch(apiUrl, { credentials: 'include' });
              if (!resp.ok) return { error: `HTTP ${resp.status}` };
              return await resp.json();
            } catch (e) {
              return { error: e.message };
            }
          }, url);

          if (!result.error) break;
          retries++;
          if (retries <= 1) {
            console.log(`[微博] API 调用失败，重试 ${retries}/1...`);
            await new Promise(r => setTimeout(r, 1000));
          }
        }

        if (result.error || !result.data || !result.data.cards) {
          console.log(`[微博] 第 ${pageNum} 页获取失败: ${result.error || '无数据'}`);
          break;
        }

        // 提取帖子
        let count = 0;
        let oldestDate = null;

        result.data.cards.forEach(card => {
          const processPost = (mblog) => {
            if (!mblog) return;

            let title = mblog.text_raw || (mblog.text || "").replace(/<[^>]*>/g, "");
            title = title.replace(/\s+/g, " ").trim().substring(0, 150);
            if (title.length < 5) return;

            let contentType = "图文";
            if (mblog.page_info && mblog.page_info.type === "video") {
              contentType = "视频";
            } else if (mblog.isLongText) {
              contentType = "长文";
            }

            // 优化4: 改进日期解析
            let publishTime = null;
            if (mblog.created_at) {
              publishTime = parseWeiboDate(mblog.created_at);
            }
            if (!publishTime) {
              publishTime = new Date().toISOString();
            }

            allItems.push({
              platform: "weibo",
              content_type: contentType,
              title,
              publish_time: publishTime,
              dateObj: new Date(publishTime),
              views: mblog.reads_count || 0,
              likes: mblog.attitudes_count || 0,
              comments: mblog.comments_count || 0,
              shares: mblog.reposts_count || 0,
              favorites: 0
            });

            // 记录最旧的日期
            const itemDate = new Date(publishTime);
            if (!oldestDate || itemDate < oldestDate) {
              oldestDate = itemDate;
            }

            count++;
          };

          processPost(card.mblog);
          if (card.card_group) {
            card.card_group.forEach(sub => processPost(sub.mblog));
          }
        });

        console.log(`[微博] 第 ${pageNum} 页获取 ${count} 条`);

        // 优化3: 数据质量检测
        if (count > 0) {
          const recentItems = allItems.slice(-count);
          const zeroMetrics = recentItems.filter(item =>
            item.views === 0 && item.likes === 0 && item.comments === 0
          ).length;
          if (zeroMetrics > count * 0.5) {
            console.log(`[微博] 警告: ${zeroMetrics}/${count} 条数据指标为0，可能需要调整提取逻辑`);
          }
        }

        // 优化2: 智能提前停止
        if (count === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 2) {
            console.log(`[微博] 连续 ${consecutiveEmptyPages} 页无数据，停止`);
            break;
          }
        } else {
          consecutiveEmptyPages = 0;

          // 检查是否超出30天范围
          if (oldestDate) {
            const daysDiff = (Date.now() - oldestDate.getTime()) / (1000 * 60 * 60 * 24);
            if (daysDiff > 30) {
              console.log(`[微博] 已超出30天范围（最旧一条: ${daysDiff.toFixed(1)}天前），停止翻页`);
              break;
            }
          }
        }

        // 获取下一页的 since_id
        if (result.data.cardlistInfo && result.data.cardlistInfo.since_id) {
          sinceId = result.data.cardlistInfo.since_id;
        } else {
          break;
        }

        await new Promise(r => setTimeout(r, 800));
      }

      console.log(`[微博] API 共获取 ${allItems.length} 条`);
    } catch (e) {
      console.log(`[微博] API 错误: ${e.message}`);
    }
  }

  // 去重 + 30天过滤
  const seen = new Set();
  const items = allItems.filter(item => {
    if (seen.has(item.title)) return false;
    seen.add(item.title);

    if (item.dateObj) {
      const daysDiff = (Date.now() - item.dateObj.getTime()) / (1000 * 60 * 60 * 24);
      delete item.dateObj;
      return daysDiff <= 30 && daysDiff >= 0;
    }
    delete item.dateObj;
    return true;
  });

  console.log(`[微博] 30天内: ${items.length} 条`);

  return { items, count: items.length };
}

// 微博日期解析辅助函数
function parseWeiboDate(dateStr) {
  if (!dateStr) return null;

  try {
    // 尝试标准日期格式
    const standardDate = new Date(dateStr);
    if (!isNaN(standardDate.getTime())) {
      return standardDate.toISOString();
    }

    // 处理相对时间
    const now = new Date();

    // X分钟前
    let match = dateStr.match(/(\d+)\s*分钟前/);
    if (match) {
      const d = new Date(now.getTime() - parseInt(match[1]) * 60 * 1000);
      return d.toISOString();
    }

    // X小时前
    match = dateStr.match(/(\d+)\s*小时前/);
    if (match) {
      const d = new Date(now.getTime() - parseInt(match[1]) * 60 * 60 * 1000);
      return d.toISOString();
    }

    // 今天 HH:MM
    match = dateStr.match(/今天\s*(\d{1,2}):(\d{2})/);
    if (match) {
      const d = new Date(now);
      d.setHours(parseInt(match[1]), parseInt(match[2]), 0, 0);
      return d.toISOString();
    }

    // MM-DD HH:MM (当年)
    match = dateStr.match(/(\d{1,2})-(\d{1,2})\s+(\d{1,2}):(\d{2})/);
    if (match) {
      const d = new Date(now.getFullYear(), parseInt(match[1]) - 1, parseInt(match[2]), parseInt(match[3]), parseInt(match[4]));
      return d.toISOString();
    }

    return null;
  } catch (e) {
    return null;
  }
}

async function extractShipinhao(page) {
  console.error('[视频号] 开始抓取数据...');
  await new Promise(r => setTimeout(r, 3000));

  // 优化1: 更健壮的 iframe 查找
  let targetFrame = page;
  let retries = 0;
  const maxRetries = 5;

  while (retries < maxRetries) {
    const frames = page.frames();
    console.error(`[视频号] 尝试 ${retries + 1}/${maxRetries}: 找到 ${frames.length} 个 frame`);

    for (const frame of frames) {
      const url = frame.url();
      console.error(`[视频号] 检查 frame: ${url}`);
      // 支持多种 URL 模式
      if (url.includes("/micro/content/post") ||
          url.includes("/micro/") ||
          url.includes("channels.weixin.qq.com")) {

        // 检查 frame 是否有内容
        try {
          const textLength = await frame.evaluate(() => document.body.innerText.length);
          console.error(`[视频号] Frame 文本长度: ${textLength}`);

          if (textLength > 100) {
            targetFrame = frame;
            console.error(`[视频号] 使用 frame: ${url}`);
            break;
          } else {
            console.error(`[视频号] Frame 内容太少,等待加载...`);
          }
        } catch (e) {
          console.error(`[视频号] Frame 检查失败: ${e.message}`);
        }
      }
    }

    if (targetFrame !== page) break;

    retries++;
    if (retries < maxRetries) {
      console.error(`[视频号] 等待 2 秒后重试...`);
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  if (targetFrame === page) {
    console.error('[视频号] 警告: 未找到有效的 iframe,使用主页面');
  }

  // 优化2: 智能滚动加载 - 检测高度变化
  console.error('[视频号] 滚动加载更多内容...');
  let scrollCount = 0;
  try {
    scrollCount = await targetFrame.evaluate(() => {
      return new Promise((resolve) => {
        let scrolls = 0;
        let previousHeight = 0;
        let unchangedCount = 0;
        const maxScrolls = 20;

        const scrollInterval = setInterval(() => {
          const currentHeight = document.body.scrollHeight;

          // 检测高度是否变化
          if (currentHeight === previousHeight) {
            unchangedCount++;
            if (unchangedCount >= 3) {
              // 连续3次高度不变,停止滚动
              clearInterval(scrollInterval);
              resolve(scrolls);
              return;
            }
          } else {
            unchangedCount = 0;
            previousHeight = currentHeight;
          }

          window.scrollBy(0, 800);
          scrolls++;

          if (scrolls >= maxScrolls) {
            clearInterval(scrollInterval);
            resolve(scrolls);
          }
        }, 800);
      });
    });
  } catch(e) {
    console.error(`[视频号] 滚动失败: ${e.message}`);
  }

  console.error(`[视频号] 完成 ${scrollCount} 次滚动`);
  await new Promise(r => setTimeout(r, 2000));

  // 优化3: 改进数据提取 - DOM选择器 + 文本解析
  const rawItems = await targetFrame.evaluate(() => {
    const items = [];
    const text = document.body.innerText;

    // 方法1: 尝试使用 DOM 选择器
    try {
      const contentCards = document.querySelectorAll('[class*="post"], [class*="video"], [class*="item"], [class*="card"]');

      contentCards.forEach(card => {
        const cardText = card.innerText || '';

        // 查找日期
        const dateMatch = cardText.match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);
        if (!dateMatch) return;

        const lines = cardText.split('\n').map(l => l.trim()).filter(l => l);

        // 查找标题
        let title = '';
        for (const line of lines) {
          if (line.length > 5 &&
              !line.includes('置顶') && !line.includes('分享') &&
              !line.includes('删除') && !line.includes('管理') &&
              !line.includes('修改') && !line.includes('权限') &&
              !line.match(/^\d+$/) &&
              !line.match(/\d{4}年\d{1,2}月\d{1,2}日/)) {
            title = line.substring(0, 100);
            break;
          }
        }

        if (!title || title.length < 3) return;

        // 提取指标 (连续的5个数字)
        const nums = [];
        for (let i = 0; i < lines.length - 4; i++) {
          if (lines.slice(i, i+5).every(l => /^\d+$/.test(l))) {
            nums.push(...lines.slice(i, i+5).map(n => parseInt(n)));
            break;
          }
        }

        // 如果找不到5个连续数字,尝试单独提取
        if (nums.length === 0) {
          for (const line of lines) {
            if (/^\d+$/.test(line)) {
              nums.push(parseInt(line));
              if (nums.length >= 5) break;
            }
          }
        }

        const y = dateMatch[1];
        const m = dateMatch[2].padStart(2, '0');
        const d = dateMatch[3].padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        items.push({
          platform: 'shipinhao',
          content_type: '视频',
          title,
          dateStr,
          views: nums[0] || 0,
          likes: nums[1] || 0,
          comments: nums[2] || 0,
          shares: nums[3] || 0,
          favorites: nums[4] || 0
        });
      });
    } catch (e) {
      // DOM 方法失败,继续使用文本方法
    }

    // 方法2: 如果DOM方法失败或结果少,使用文本解析(兜底)
    if (items.length < 3) {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);

      let i = 0;
      while (i < lines.length) {
        const dateMatch = lines[i] && lines[i].match(/(\d{4})年(\d{1,2})月(\d{1,2})日/);

        if (dateMatch) {
          let title = '';
          for (let j = i - 1; j >= Math.max(0, i - 5); j--) {
            const line = lines[j];
            if (line && line.length > 5 &&
                !line.includes('置顶') && !line.includes('分享') &&
                !line.includes('删除') && !line.includes('管理') &&
                !line.includes('修改') && !line.includes('权限') &&
                !line.match(/^\d+$/)) {
              title = line.substring(0, 100);
              break;
            }
          }

          const nums = [];
          for (let j = i + 1; j < Math.min(lines.length, i + 10); j++) {
            if (/^\d+$/.test(lines[j])) {
              nums.push(parseInt(lines[j]));
              if (nums.length >= 5) break;
            }
            if (lines[j] && lines[j].match(/\d{4}年\d{1,2}月\d{1,2}日/)) break;
          }

          if (title && title.length > 3) {
            const y = dateMatch[1];
            const m = dateMatch[2].padStart(2, '0');
            const d = dateMatch[3].padStart(2, '0');
            const dateStr = `${y}-${m}-${d}`;

            // 检查是否已存在
            const exists = items.some(item => item.title === title);
            if (!exists) {
              items.push({
                platform: 'shipinhao',
                content_type: '视频',
                title,
                dateStr,
                views: nums[0] || 0,
                likes: nums[1] || 0,
                comments: nums[2] || 0,
                shares: nums[3] || 0,
                favorites: nums[4] || 0
              });
            }
          }

          i += 5;
        } else {
          i++;
        }
      }
    }

    // 优化4: 改进账号信息提取
    const videosMatch = text.match(/视频\s*\((\d+)\)/) ||  // 视频 (55)
                       text.match(/视频\s*（(\d+)）/) ||  // 视频 (55) 全角
                       text.match(/共\s*(\d+)\s*个视频/) ||
                       text.match(/(\d+)\s*个作品/);
    const followersMatch = text.match(/粉丝[：:\s]*([\d,.万]+)/) ||
                          text.match(/关注者[：:\s]*([\d,.万]+)/) ||
                          text.match(/订阅[：:\s]*([\d,.万]+)/);

    const account = {
      videos: videosMatch ? videosMatch[1] : '',
      followers: followersMatch ? followersMatch[1] : ''
    };

    return { account, items };
  });

  console.error(`[视频号] 原始提取: ${rawItems.items.length} 条`);

  // 过滤30天内 + 去重
  const seen = new Set();
  const items = rawItems.items.filter(item => {
    // 去重
    if (seen.has(item.title)) return false;
    seen.add(item.title);

    // 时间过滤
    if (item.dateStr) {
      const date = new Date(item.dateStr + 'T00:00:00+08:00');
      item.publish_time = date.toISOString();
      delete item.dateStr;
      const daysDiff = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
      return daysDiff <= 30 && daysDiff >= 0;
    }
    delete item.dateStr;
    return true;
  });

  console.error(`[视频号] 过滤后: ${items.length} 条（30天内）`);

  if (items.length === 0) {
    console.error('[视频号] 警告: 未提取到任何数据');
  }

  return { account: rawItems.account, items, count: items.length };
}
// ============ 优化后的公众号数据抓取函数 ============
async function extractGongzhonghao(page) {
  console.log('[公众号] 开始抓取数据...');

  // 等待页面稳定
  await new Promise(r => setTimeout(r, 3000));

  // 滚动加载更多内容，增加滚动次数和减少延迟
  console.log('[公众号] 滚动加载更多内容...');
  const scrollCount = await scrollToLoadMore(page, 20, 1200);
  console.log(`[公众号] 滚动 ${scrollCount} 次`);

  const rawItems = await page.evaluate(() => {
    const items = [];

    try {
      const text = document.body.innerText;
      console.log('[公众号] 页面文本长度:', text.length);

      // 使用多种分割模式尝试
      const patterns = [
        /(?=已发表\n)/,
        /(?=已发布\n)/,
        /(?=发表于\n)/
      ];

      let parts = [];
      let usedPattern = '';

      for (let i = 0; i < patterns.length; i++) {
        const testParts = text.split(patterns[i]);
        if (testParts.length > 5) {  // 至少要有几篇文章
          parts = testParts;
          usedPattern = patterns[i].toString();
          console.log(`[公众号] 使用分割模式 ${i}，找到 ${parts.length} 个部分`);
          break;
        }
      }

      if (parts.length === 0) {
        console.error('[公众号] 所有分割模式都失败');
        return { account: {}, items: [] };
      }

      // 提取文章数据
      parts.forEach((part, i) => {
        try {
          // 检查是否是文章部分
          if (!part.match(/已发表|已发布|发表于/)) return;

          const lines = part.split('\n').map(l => l.trim()).filter(l => l);
          if (lines.length < 3) return;

          // 结构通常是: 已发表, 标题, 日期, 数字们...
          let titleIdx = -1;
          let dateStr = '';

          // 找标题（第一个不是"已发表"且长度>5的行）
          for (let j = 0; j < Math.min(5, lines.length); j++) {
            if (!lines[j].match(/已发表|已发布|发表于/) && lines[j].length > 5 && !lines[j].match(/^\d+$/)) {
              titleIdx = j;
              break;
            }
          }

          if (titleIdx === -1) return;
          const title = lines[titleIdx].substring(0, 100);

          // 找日期（支持多种格式）
          for (const line of lines) {
            if (line.match(/\d{4}[-\/年]\d{1,2}[-\/月]\d{1,2}|^\d{1,2}[-\/]\d{1,2}\s+\d{1,2}:\d{2}|\d+[天小时分钟]前/)) {
              dateStr = line;
              break;
            }
          }

          // 提取纯数字行
          const nums = [];
          for (const line of lines) {
            if (/^\d+$/.test(line)) {
              nums.push(parseInt(line));
            }
          }

          // 过滤无效标题
          if (title.length > 5 &&
              !title.includes('权限') &&
              !title.includes('删除') &&
              !title.includes('已发表') &&
              !title.match(/^\d+$/)) {
            items.push({
              platform: 'gongzhonghao',
              content_type: '文章',
              title,
              dateStr,
              views: nums[0] || 0,
              likes: nums[1] || 0,
              comments: nums[2] || 0,
              shares: nums[3] || 0,
              favorites: nums[4] || 0
            });
          }
        } catch (err) {
          console.error(`[公众号] 处理部分 ${i} 失败:`, err.message);
        }
      });

      // 提取账户信息
      const account = {
        users: text.match(/总用户数[:\s]*(\d+)/)?.[1] ||
               text.match(/用户[总数]*[:\s]*(\d+)/)?.[1] || ''
      };

      console.log(`[公众号] 提取完成，共 ${items.length} 篇文章`);

      return { account, items };

    } catch (err) {
      console.error('[公众号] 提取失败:', err.message);
      return { account: {}, items: [] };
    }
  });

  // 过滤并处理日期
  let parsedCount = 0;
  let failedDates = [];

  const items = rawItems.items
    .map((item, idx) => {
      const date = parseChineseDate(item.dateStr);
      const newItem = { ...item };

      if (date) {
        newItem.publish_time = date.toISOString();
        newItem._isRecent = isWithinDays(date, 30);
        parsedCount++;
      } else {
        // 如果没有日期，假设是最近30天内的（保留数据）
        if (item.dateStr) {
          failedDates.push(item.dateStr);
        }
        newItem._isRecent = true;  // 保留无日期的数据
      }

      delete newItem.dateStr;
      return newItem;
    })
    .filter(item => item._isRecent !== false)
    .map(item => {
      delete item._isRecent;
      return item;
    });

  if (failedDates.length > 0) {
    console.log(`[公众号] 日期解析失败的样本 (${failedDates.length}):`, failedDates.slice(0, 3));
  }

  console.log(`[公众号] 日期解析成功: ${parsedCount}/${rawItems.items.length}`);
  console.log(`[公众号] 过滤后剩余 ${items.length} 篇`);

  return {
    account: rawItems.account,
    items,
    count: items.length,
    _meta: {
      totalExtracted: rawItems.items.length,
      filteredCount: items.length,
      scrollCount,
      dateParsed: parsedCount
    }
  };
}

async function extractZhihu(page) {
  await new Promise(r => setTimeout(r, 3000));

  // 滚动加载更多
  await scrollToLoadMore(page, 15, 1500);

  const rawItems = await page.evaluate(() => {
    const items = [];
    const text = document.body.innerText;

    // 按 "阅读\n数字" 模式分割内容
    const parts = text.split(/(?=阅读\n\d+)/);

    parts.forEach((part, i) => {
      if (!part.startsWith('阅读')) return;

      // 提取指标
      const viewsMatch = part.match(/阅读\n(\d+)/);
      const likesMatch = part.match(/赞同\n(\d+)/);
      const commentsMatch = part.match(/评论\n(\d+)/);
      const favoritesMatch = part.match(/收藏\n(\d+)/);

      // 标题在上一个 part 末尾
      if (i > 0) {
        const prevPart = parts[i-1];
        const lines = prevPart.split('\n').filter(l => l.trim());

        // 找标题和日期
        let title = '';
        let dateStr = '';

        for (let j = lines.length - 1; j >= 0; j--) {
          const line = lines[j];
          // 找日期
          if (!dateStr && line.match(/\d{4}[-\/]\d{1,2}[-\/]\d{1,2}|\d+天前|\d+小时前|\d+分钟前/)) {
            dateStr = line;
          }
          // 找标题
          if (!title && line.length > 20 && !line.match(/^\d+$/) && !line.includes('编辑') && !line.includes('删除')) {
            title = line.substring(0, 100);
          }
          if (title && dateStr) break;
        }

        if (title.length > 10) {
          items.push({
            platform: 'zhihu',
            content_type: '文章',
            title,
            dateStr,
            views: viewsMatch ? parseInt(viewsMatch[1]) || 0 : 0,
            likes: likesMatch ? parseInt(likesMatch[1]) || 0 : 0,
            comments: commentsMatch ? parseInt(commentsMatch[1]) || 0 : 0,
            shares: 0,
            favorites: favoritesMatch ? parseInt(favoritesMatch[1]) || 0 : 0
          });
        }
      }
    });

    const account = {
      level: text.match(/Lv\s*(\d+)/)?.[1] || '',
      score: text.match(/创作分\s*([\d,]+)/)?.[1] || ''
    };

    return { account, items };
  });

  // 过滤30天内
  const items = rawItems.items.filter(item => {
    const date = parseChineseDate(item.dateStr);
    delete item.dateStr;
    if (date) {
      item.publish_time = date.toISOString();
      return isWithinDays(date, 30);
    }
    return true;
  });

  return { account: rawItems.account, items, count: items.length };
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

  console.error(`[${platform.name}] 连接 CDP 端口: ${platform.cdpPort}`);

  // 获取 WebSocket 端点
  let wsEndpoint;
  try {
    const versionUrl = `http://${WINDOWS_IP}:${platform.cdpPort}/json/version`;
    const response = await new Promise((resolve, reject) => {
      http.get(versionUrl, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve(JSON.parse(data)); } catch (e) { reject(e); }
        });
      }).on('error', reject);
    });
    wsEndpoint = response.webSocketDebuggerUrl;
  } catch (e) {
    console.error(`[${platform.name}] Chrome 未运行或无法连接`);
    return { success: false, platform: platform.name, error: 'Chrome not running' };
  }

  console.error(`[${platform.name}] WebSocket: ${wsEndpoint}`);

  try {
    const browser = await puppeteer.connect({
      browserWSEndpoint: wsEndpoint,
      defaultViewport: null  // 不改变视口，避免 CDP 兼容问题
    });

    const pages = await browser.pages();
    const page = pages[0] || await browser.newPage();

    if (platform.dataUrl) {
      console.error(`[${platform.name}] 导航到: ${platform.dataUrl}`);
      await page.goto(platform.dataUrl, { waitUntil: 'networkidle2', timeout: 60000 });
    } else {
      console.error(`[${platform.name}] 使用当前页面`);
    }

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
