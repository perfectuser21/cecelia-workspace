#!/usr/bin/env node
/**
 * AI Factory 截图工具
 *
 * 用法:
 *   node screenshot.mjs <url> <output_path> [options]
 *   node screenshot.mjs --file <html_path> <output_path> [options]
 *
 * 选项:
 *   --width <number>    视口宽度 (默认: 1920)
 *   --height <number>   视口高度 (默认: 1080)
 *   --full-page         截取完整页面
 *   --delay <ms>        截图前等待时间
 *   --selector <css>    等待特定元素出现
 *
 * 示例:
 *   node screenshot.mjs https://example.com ./screenshot.png
 *   node screenshot.mjs --file ./report.html ./report.png --full-page
 */

import puppeteer from 'puppeteer-core';
import { fileURLToPath } from 'url';
import { dirname, resolve, isAbsolute } from 'path';
import { existsSync, readdirSync } from 'fs';

// 自动查找 Chrome 可执行文件
function findChrome() {
  // 1. 检查环境变量
  if (process.env.CHROME_PATH && existsSync(process.env.CHROME_PATH)) {
    return process.env.CHROME_PATH;
  }

  // 2. 检查 puppeteer 缓存目录
  const puppeteerCache = `${process.env.HOME}/.cache/puppeteer/chrome`;
  if (existsSync(puppeteerCache)) {
    const versions = readdirSync(puppeteerCache)
      .filter(d => d.startsWith('linux-'))
      .sort()
      .reverse();

    for (const version of versions) {
      const chromePath = `${puppeteerCache}/${version}/chrome-linux64/chrome`;
      if (existsSync(chromePath)) {
        return chromePath;
      }
    }
  }

  // 3. 检查系统路径
  const systemPaths = [
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium'
  ];

  for (const p of systemPaths) {
    if (existsSync(p)) {
      return p;
    }
  }

  return null;
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// 解析命令行参数
function parseArgs(args) {
  const options = {
    url: null,
    output: null,
    width: 1920,
    height: 1080,
    fullPage: false,
    delay: 0,
    selector: null,
    isFile: false
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];

    if (arg === '--file') {
      options.isFile = true;
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        options.url = args[++i];
      }
    } else if (arg === '--width') {
      options.width = parseInt(args[++i], 10);
    } else if (arg === '--height') {
      options.height = parseInt(args[++i], 10);
    } else if (arg === '--full-page') {
      options.fullPage = true;
    } else if (arg === '--delay') {
      options.delay = parseInt(args[++i], 10);
    } else if (arg === '--selector') {
      options.selector = args[++i];
    } else if (!arg.startsWith('--')) {
      if (!options.url) {
        options.url = arg;
      } else if (!options.output) {
        options.output = arg;
      }
    }
  }

  return options;
}

async function takeScreenshot(options) {
  const chromePath = findChrome();
  if (!chromePath) {
    throw new Error('找不到 Chrome 可执行文件。请安装 Chrome 或设置 CHROME_PATH 环境变量');
  }

  console.error(`[screenshot] 使用 Chrome: ${chromePath}`);

  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--font-render-hinting=none'
    ]
  });

  try {
    const page = await browser.newPage();

    // 设置视口大小
    await page.setViewport({
      width: options.width,
      height: options.height,
      deviceScaleFactor: 2  // 2K 清晰度
    });

    // 导航到目标 URL
    let targetUrl = options.url;
    if (options.isFile) {
      const filePath = isAbsolute(options.url) ? options.url : resolve(process.cwd(), options.url);
      if (!existsSync(filePath)) {
        throw new Error(`文件不存在: ${filePath}`);
      }
      targetUrl = `file://${filePath}`;
    }

    console.error(`[screenshot] 加载: ${targetUrl}`);
    await page.goto(targetUrl, {
      waitUntil: 'networkidle2',
      timeout: 30000
    });

    // 等待特定选择器
    if (options.selector) {
      console.error(`[screenshot] 等待元素: ${options.selector}`);
      await page.waitForSelector(options.selector, { timeout: 10000 });
    }

    // 额外延迟
    if (options.delay > 0) {
      console.error(`[screenshot] 等待 ${options.delay}ms`);
      await new Promise(r => setTimeout(r, options.delay));
    }

    // 确保输出路径是绝对路径
    const outputPath = isAbsolute(options.output)
      ? options.output
      : resolve(process.cwd(), options.output);

    // 截图
    await page.screenshot({
      path: outputPath,
      fullPage: options.fullPage,
      type: 'png'
    });

    console.error(`[screenshot] 保存到: ${outputPath}`);

    // 输出 JSON 结果到 stdout（供调用脚本解析）
    console.log(JSON.stringify({
      success: true,
      path: outputPath,
      url: options.url,
      width: options.width,
      height: options.height
    }));

  } finally {
    await browser.close();
  }
}

// 主入口
const args = process.argv.slice(2);

if (args.length < 2) {
  console.error(`用法: node screenshot.mjs <url> <output_path> [options]
       node screenshot.mjs --file <html_path> <output_path> [options]

选项:
  --width <number>    视口宽度 (默认: 1920)
  --height <number>   视口高度 (默认: 1080)
  --full-page         截取完整页面
  --delay <ms>        截图前等待时间
  --selector <css>    等待特定元素出现

示例:
  node screenshot.mjs https://example.com ./screenshot.png
  node screenshot.mjs --file ./report.html ./report.png --full-page
`);
  process.exit(1);
}

const options = parseArgs(args);

if (!options.url || !options.output) {
  console.error('错误: 缺少 URL 或输出路径');
  process.exit(1);
}

takeScreenshot(options).catch(err => {
  console.error(`[screenshot] 错误: ${err.message}`);
  console.log(JSON.stringify({
    success: false,
    error: err.message
  }));
  process.exit(1);
});
