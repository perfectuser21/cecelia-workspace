/**
 * Windows Automation Runner
 * 支持 LLM 模式（首次探索）和 Script 模式（日常运行）
 */

const express = require('express');
const puppeteer = require('puppeteer-core');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// 加载配置
const CONFIG_PATH = path.join(__dirname, 'config.json');
let config = {};
try {
    config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
} catch (e) {
    console.error('错误：无法加载 config.json，请先运行 setup.ps1');
    process.exit(1);
}

const BASE_DIR = __dirname;
const PROFILES_DIR = path.join(BASE_DIR, 'profiles');
const SCRIPTS_DIR = path.join(BASE_DIR, 'scripts');
const LOGS_DIR = path.join(BASE_DIR, 'logs');

// 任务队列（串行执行）
let isRunning = false;
let taskQueue = [];

// ============ 登录模式 ============
async function loginMode(platform) {
    const platformConfig = config.platforms[platform];
    if (!platformConfig) {
        console.error(`未知平台: ${platform}`);
        console.log('可用平台:', Object.keys(config.platforms).join(', '));
        return;
    }

    const profileDir = path.join(PROFILES_DIR, platformConfig.profile);
    console.log(`\n正在打开 ${platformConfig.name}...`);
    console.log(`Profile 目录: ${profileDir}`);
    console.log(`请手动登录，完成后关闭浏览器窗口。\n`);

    const browser = await puppeteer.launch({
        executablePath: config.CHROME_PATH,
        headless: false,
        userDataDir: profileDir,
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ],
        defaultViewport: null
    });

    const page = await browser.newPage();
    await page.goto(platformConfig.url, { waitUntil: 'networkidle2', timeout: 60000 });

    // 等待用户手动关闭浏览器
    await new Promise((resolve) => {
        browser.on('disconnected', resolve);
    });

    console.log(`\n${platformConfig.name} 登录完成！Profile 已保存。`);
}

// ============ LLM 模式 ============
async function runLLMMode(platform, task, saveScript) {
    const Anthropic = require('@anthropic-ai/sdk');
    const anthropic = new Anthropic({ apiKey: config.ANTHROPIC_API_KEY });

    const platformConfig = config.platforms[platform];
    const profileDir = path.join(PROFILES_DIR, platformConfig.profile);
    const jobId = uuidv4().slice(0, 8);

    console.log(`[${jobId}] LLM 模式启动: ${platformConfig.name}`);
    console.log(`[${jobId}] 任务: ${task}`);

    // 记录操作步骤（用于生成脚本）
    const steps = [];

    const browser = await puppeteer.launch({
        executablePath: config.CHROME_PATH,
        headless: config.HEADLESS,
        userDataDir: profileDir,
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled',
            '--start-maximized'
        ],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    try {
        // 第一步：打开平台页面
        console.log(`[${jobId}] 打开 ${platformConfig.url}`);
        await page.goto(platformConfig.url, { waitUntil: 'networkidle2', timeout: 60000 });
        steps.push({ action: 'goto', url: platformConfig.url });

        // 等待页面稳定
        await page.waitForTimeout(3000);

        // 截图当前页面
        const screenshotPath = path.join(LOGS_DIR, `${jobId}_initial.png`);
        await page.screenshot({ path: screenshotPath, fullPage: false });

        // 获取页面 HTML 结构（简化版）
        const pageInfo = await page.evaluate(() => {
            const getSimplifiedDOM = (element, depth = 0) => {
                if (depth > 3) return null;
                const result = {
                    tag: element.tagName?.toLowerCase(),
                    text: element.innerText?.slice(0, 100),
                    classes: element.className,
                    id: element.id
                };
                return result;
            };

            // 获取所有可交互元素
            const interactiveElements = [];
            document.querySelectorAll('a, button, input, [onclick], [role="button"]').forEach((el, i) => {
                if (i < 50) {
                    interactiveElements.push({
                        index: i,
                        tag: el.tagName.toLowerCase(),
                        text: el.innerText?.slice(0, 50) || el.value || el.placeholder || '',
                        href: el.href || '',
                        selector: el.id ? `#${el.id}` : (el.className ? `.${el.className.split(' ')[0]}` : el.tagName.toLowerCase())
                    });
                }
            });

            // 获取数据表格
            const tables = [];
            document.querySelectorAll('table, [class*="table"], [class*="list"]').forEach((el, i) => {
                if (i < 5) {
                    tables.push({
                        index: i,
                        text: el.innerText?.slice(0, 500)
                    });
                }
            });

            return {
                title: document.title,
                url: window.location.href,
                interactiveElements,
                tables,
                bodyText: document.body.innerText.slice(0, 2000)
            };
        });

        console.log(`[${jobId}] 页面已加载: ${pageInfo.title}`);

        // 调用 Claude 分析页面并执行任务
        const systemPrompt = `你是一个浏览器自动化助手。用户会给你一个任务和当前页面的信息。
你需要分析页面，决定下一步操作，并返回 JSON 格式的指令。

可用操作：
- {"action": "click", "selector": "CSS选择器", "description": "描述"}
- {"action": "type", "selector": "CSS选择器", "text": "输入内容", "description": "描述"}
- {"action": "scroll", "direction": "down|up", "description": "描述"}
- {"action": "wait", "ms": 毫秒数, "description": "描述"}
- {"action": "extract", "selector": "CSS选择器", "fields": ["字段1", "字段2"], "description": "描述"}
- {"action": "done", "data": 提取的数据, "description": "任务完成"}

只返回 JSON，不要其他文字。如果需要多步操作，每次只返回一步。`;

        let result = null;
        let maxSteps = 10;

        for (let step = 0; step < maxSteps; step++) {
            const userMessage = `当前页面信息：
${JSON.stringify(pageInfo, null, 2)}

任务：${task}

${step > 0 ? `已执行步骤：${JSON.stringify(steps)}` : '这是第一步。'}

请返回下一步操作的 JSON。`;

            const response = await anthropic.messages.create({
                model: 'claude-sonnet-4-20250514',
                max_tokens: 1024,
                system: systemPrompt,
                messages: [{ role: 'user', content: userMessage }]
            });

            const llmResponse = response.content[0].text;
            console.log(`[${jobId}] LLM 响应: ${llmResponse}`);

            let instruction;
            try {
                instruction = JSON.parse(llmResponse);
            } catch (e) {
                console.error(`[${jobId}] JSON 解析失败:`, e);
                break;
            }

            steps.push(instruction);

            // 执行操作
            if (instruction.action === 'click') {
                await page.click(instruction.selector);
                await page.waitForTimeout(2000);
            } else if (instruction.action === 'type') {
                await page.type(instruction.selector, instruction.text);
            } else if (instruction.action === 'scroll') {
                await page.evaluate((dir) => {
                    window.scrollBy(0, dir === 'down' ? 500 : -500);
                }, instruction.direction);
            } else if (instruction.action === 'wait') {
                await page.waitForTimeout(instruction.ms);
            } else if (instruction.action === 'extract') {
                const data = await page.evaluate((sel, fields) => {
                    const elements = document.querySelectorAll(sel);
                    return Array.from(elements).map(el => {
                        const item = {};
                        fields.forEach(f => item[f] = el.querySelector(`[class*="${f}"]`)?.innerText || '');
                        item._text = el.innerText.slice(0, 200);
                        return item;
                    });
                }, instruction.selector, instruction.fields || []);
                instruction.extractedData = data;
                result = data;
            } else if (instruction.action === 'done') {
                result = instruction.data;
                break;
            }

            // 更新页面信息
            await page.waitForTimeout(1000);
            const newScreenshot = path.join(LOGS_DIR, `${jobId}_step${step}.png`);
            await page.screenshot({ path: newScreenshot });
        }

        // 保存脚本
        if (saveScript && steps.length > 0) {
            const scriptPath = path.join(SCRIPTS_DIR, `${platform}.js`);
            const scriptContent = generateScript(platform, platformConfig, steps);
            fs.writeFileSync(scriptPath, scriptContent);
            console.log(`[${jobId}] 脚本已保存: ${scriptPath}`);
        }

        return {
            success: true,
            jobId,
            platform,
            mode: 'llm',
            steps: steps.length,
            data: result,
            scriptSaved: saveScript
        };

    } catch (error) {
        console.error(`[${jobId}] 错误:`, error);
        const errorScreenshot = path.join(LOGS_DIR, `${jobId}_error.png`);
        await page.screenshot({ path: errorScreenshot }).catch(() => {});
        throw error;
    } finally {
        await browser.close();
    }
}

// ============ Script 模式 ============
async function runScriptMode(platform) {
    const platformConfig = config.platforms[platform];
    const profileDir = path.join(PROFILES_DIR, platformConfig.profile);
    const scriptPath = path.join(SCRIPTS_DIR, `${platform}.js`);
    const jobId = uuidv4().slice(0, 8);

    if (!fs.existsSync(scriptPath)) {
        throw new Error(`脚本不存在: ${scriptPath}，请先使用 LLM 模式生成脚本`);
    }

    console.log(`[${jobId}] Script 模式启动: ${platformConfig.name}`);

    const browser = await puppeteer.launch({
        executablePath: config.CHROME_PATH,
        headless: config.HEADLESS,
        userDataDir: profileDir,
        args: [
            '--no-sandbox',
            '--disable-blink-features=AutomationControlled'
        ],
        defaultViewport: { width: 1920, height: 1080 }
    });

    const page = await browser.newPage();

    try {
        // 动态加载并执行脚本
        const scriptModule = require(scriptPath);
        const result = await scriptModule.run(page, platformConfig);

        // 截图
        const screenshotPath = path.join(LOGS_DIR, `${jobId}_result.png`);
        await page.screenshot({ path: screenshotPath });

        return {
            success: true,
            jobId,
            platform,
            mode: 'script',
            data: result,
            screenshot: screenshotPath
        };

    } catch (error) {
        console.error(`[${jobId}] 错误:`, error);
        throw error;
    } finally {
        await browser.close();
    }
}

// ============ 生成脚本 ============
function generateScript(platform, platformConfig, steps) {
    const stepsCode = steps.map((step, i) => {
        if (step.action === 'goto') {
            return `    // Step ${i + 1}: 打开页面
    await page.goto('${step.url}', { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForTimeout(3000);`;
        } else if (step.action === 'click') {
            return `    // Step ${i + 1}: ${step.description || '点击'}
    await page.click('${step.selector}');
    await page.waitForTimeout(2000);`;
        } else if (step.action === 'type') {
            return `    // Step ${i + 1}: ${step.description || '输入'}
    await page.type('${step.selector}', '${step.text}');`;
        } else if (step.action === 'scroll') {
            return `    // Step ${i + 1}: ${step.description || '滚动'}
    await page.evaluate(() => window.scrollBy(0, ${step.direction === 'down' ? 500 : -500}));
    await page.waitForTimeout(1000);`;
        } else if (step.action === 'wait') {
            return `    // Step ${i + 1}: ${step.description || '等待'}
    await page.waitForTimeout(${step.ms});`;
        } else if (step.action === 'extract') {
            return `    // Step ${i + 1}: ${step.description || '提取数据'}
    const data = await page.evaluate(() => {
        const elements = document.querySelectorAll('${step.selector}');
        return Array.from(elements).map(el => ({
            text: el.innerText.slice(0, 200)
        }));
    });
    results.push(...data);`;
        } else if (step.action === 'done') {
            return `    // Step ${i + 1}: 任务完成`;
        }
        return '';
    }).join('\n\n');

    return `/**
 * ${platformConfig.name} 数据采集脚本
 * 自动生成于: ${new Date().toISOString()}
 * 平台: ${platform}
 */

async function run(page, config) {
    const results = [];

    try {
${stepsCode}

        return {
            success: true,
            count: results.length,
            data: results
        };
    } catch (error) {
        return {
            success: false,
            error: error.message
        };
    }
}

module.exports = { run };
`;
}

// ============ HTTP 服务 ============
const app = express();
app.use(express.json());

// API Key 验证中间件
app.use((req, res, next) => {
    if (req.path === '/health') return next();

    const apiKey = req.headers['x-api-key'] || req.query.key;
    if (apiKey !== config.RUNNER_API_KEY) {
        return res.status(401).json({ error: 'Invalid API key' });
    }
    next();
});

// 健康检查
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 执行任务
app.post('/run', async (req, res) => {
    const { platform, mode = 'script', task, save_script = true } = req.body;

    if (!platform || !config.platforms[platform]) {
        return res.status(400).json({
            error: 'Invalid platform',
            available: Object.keys(config.platforms)
        });
    }

    if (isRunning) {
        return res.status(429).json({ error: 'Busy', message: '有任务正在执行，请稍后重试' });
    }

    isRunning = true;

    try {
        let result;
        if (mode === 'llm') {
            if (!task) {
                return res.status(400).json({ error: 'LLM 模式需要提供 task 参数' });
            }
            result = await runLLMMode(platform, task, save_script);
        } else {
            result = await runScriptMode(platform);
        }
        res.json(result);
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    } finally {
        isRunning = false;
    }
});

// 列出可用平台
app.get('/platforms', (req, res) => {
    res.json(config.platforms);
});

// ============ 主入口 ============
const args = process.argv.slice(2);

if (args[0] === '--login') {
    const platform = args[1];
    if (!platform) {
        console.log('用法: node runner.js --login <platform>');
        console.log('可用平台:', Object.keys(config.platforms).join(', '));
        process.exit(1);
    }
    loginMode(platform).then(() => process.exit(0));
} else {
    const PORT = config.PORT || 3000;
    app.listen(PORT, () => {
        console.log(`\n========================================`);
        console.log(`  Windows Automation Runner 已启动`);
        console.log(`========================================`);
        console.log(`  地址: http://localhost:${PORT}`);
        console.log(`  健康检查: http://localhost:${PORT}/health`);
        console.log(`  平台列表: http://localhost:${PORT}/platforms`);
        console.log(`========================================\n`);
    });
}
