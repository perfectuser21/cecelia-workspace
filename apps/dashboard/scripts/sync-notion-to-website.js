#!/usr/bin/env node
/**
 * Notion 作品库 → website_contents 同步脚本
 *
 * 功能：
 * - 获取已发布的深度帖/日常文章/深度文章
 * - 解析页面内容，分离中英文（通过标记识别）
 * - 只同步文字内容，不处理图片
 * - 写入 PostgreSQL website_contents 表
 */

const https = require('https');
const { Pool } = require('pg');

// 配置
const CONFIG = {
  notionToken: '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',
  databaseId: 'a5e419c5-f8c5-4452-a667-8419a25b9d17',
  notionVersion: '2022-06-28',
  pg: {
    host: 'localhost',
    port: 5432,
    database: 'n8n_social_metrics',
    user: 'n8n_user',
    password: 'n8n_password_2025'
  }
};

// PostgreSQL 连接池
const pool = new Pool(CONFIG.pg);

// Notion API 请求
async function notionRequest(endpoint, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.notion.com',
      path: `/v1${endpoint}`,
      method,
      headers: {
        'Authorization': `Bearer ${CONFIG.notionToken}`,
        'Notion-Version': CONFIG.notionVersion,
        'Content-Type': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse response: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

// 获取最近 3 个月已发布的文章（不含视频）
async function getPublishedArticles() {
  const articles = [];
  let hasMore = true;
  let startCursor = undefined;

  // 计算 3 个月前的日期
  const threeMonthsAgo = new Date();
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
  const dateFilter = threeMonthsAgo.toISOString().split('T')[0];

  while (hasMore) {
    const body = {
      filter: {
        and: [
          { property: '发布状态', status: { equals: '已发布' } },
          { property: '发布', date: { on_or_after: dateFilter } }
        ]
      },
      page_size: 100
    };
    if (startCursor) body.start_cursor = startCursor;

    const result = await notionRequest(`/databases/${CONFIG.databaseId}/query`, 'POST', body);

    if (result.error) {
      throw new Error(`Notion API error: ${result.message}`);
    }

    articles.push(...result.results);
    hasMore = result.has_more;
    startCursor = result.next_cursor;
  }

  return articles;
}

// 获取页面的所有 blocks
async function getPageBlocks(pageId) {
  const blocks = [];
  let hasMore = true;
  let startCursor = undefined;

  while (hasMore) {
    const endpoint = startCursor
      ? `/blocks/${pageId}/children?start_cursor=${startCursor}`
      : `/blocks/${pageId}/children`;

    const result = await notionRequest(endpoint);

    if (result.error) {
      console.error(`Error fetching blocks for ${pageId}: ${result.message}`);
      return blocks;
    }

    blocks.push(...result.results);
    hasMore = result.has_more;
    startCursor = result.next_cursor;
  }

  return blocks;
}

// 获取 block 的子 blocks
async function getChildBlocks(blockId) {
  return getPageBlocks(blockId);
}


// 提取 rich_text 的纯文本
function extractPlainText(richTextArray) {
  if (!richTextArray || !Array.isArray(richTextArray)) return '';
  return richTextArray.map(rt => rt.plain_text || '').join('');
}

// 清理模板标记
function cleanTemplateMarkers(text) {
  if (!text) return '';
  let cleaned = text;
  // 移除这些模板标记（可能在行首或作为单独段落）
  const markers = ['正文：', '内容：', '标题：', '中文：', '英文：', '作品数据：'];
  for (const marker of markers) {
    // 移除单独成行的标记
    cleaned = cleaned.split(marker).join('');
  }
  // 清理多余的空行
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

// 将 blocks 转换为 markdown
function blocksToMarkdown(blocks) {
  let markdown = '';

  for (const block of blocks) {
    switch (block.type) {
      case 'paragraph':
        const text = extractPlainText(block.paragraph?.rich_text);
        if (text) markdown += text + '\n\n';
        break;
      case 'heading_1':
        markdown += `# ${extractPlainText(block.heading_1?.rich_text)}\n\n`;
        break;
      case 'heading_2':
        markdown += `## ${extractPlainText(block.heading_2?.rich_text)}\n\n`;
        break;
      case 'heading_3':
        markdown += `### ${extractPlainText(block.heading_3?.rich_text)}\n\n`;
        break;
      case 'bulleted_list_item':
        markdown += `- ${extractPlainText(block.bulleted_list_item?.rich_text)}\n`;
        break;
      case 'numbered_list_item':
        markdown += `1. ${extractPlainText(block.numbered_list_item?.rich_text)}\n`;
        break;
      case 'quote':
        markdown += `> ${extractPlainText(block.quote?.rich_text)}\n\n`;
        break;
      case 'divider':
        markdown += '---\n\n';
        break;
      case 'image':
        // 图片会单独处理
        break;
    }
  }

  return cleanTemplateMarkers(markdown);
}

// 检测文本是否主要是英文
function isEnglishText(text) {
  if (!text || text.trim().length < 5) return false;
  const cleanText = text.replace(/\s+/g, '');
  const englishChars = (cleanText.match(/[a-zA-Z]/g) || []).length;
  const chineseChars = (cleanText.match(/[\u4e00-\u9fff]/g) || []).length;
  return englishChars > chineseChars;
}

// 检测文本是否主要是中文
function isChineseText(text) {
  if (!text || text.trim().length < 2) return false;
  const cleanText = text.replace(/\s+/g, '');
  const englishChars = (cleanText.match(/[a-zA-Z]/g) || []).length;
  const chineseChars = (cleanText.match(/[\u4e00-\u9fff]/g) || []).length;
  return chineseChars > englishChars;
}

// 解析页面内容，分离中英文
async function parsePageContent(pageId, pageTitle) {
  const blocks = await getPageBlocks(pageId);

  let zhContent = { title: pageTitle, body: '' };
  let enContent = { title: '', body: '' };

  // 收集所有 column_list
  const columnLists = [];

  for (const block of blocks) {
    if (block.type === 'column_list') {
      const columns = await getChildBlocks(block.id);

      for (const column of columns) {
        if (column.type !== 'column') continue;
        const columnContent = await getChildBlocks(column.id);

        // 检查这列是否有实际文字内容
        const textBlocks = columnContent.filter(cb => {
          if (cb.type !== 'paragraph' && !cb.type.startsWith('heading')) return false;
          const text = extractPlainText(cb[cb.type]?.rich_text);
          return text && text.trim() && !['标题：', '标题:', '内容：', '内容:', '正文：', '正文:'].includes(text.trim());
        });

        if (textBlocks.length > 0) {
          columnLists.push({ blocks: columnContent, allBlocks: textBlocks });
        }
      }
    }
  }

  // 从 blocks 中按语言分离内容
  function separateByLanguage(blocks) {
    let zhBlocks = [];
    let enBlocks = [];
    let enTitle = '';
    let foundEnTitle = false;

    for (const block of blocks) {
      if (block.type !== 'paragraph' && !block.type.startsWith('heading')) continue;
      const text = extractPlainText(block[block.type]?.rich_text);

      // 跳过标记
      if (['标题：', '标题:', '内容：', '内容:', '正文：', '正文:'].includes(text?.trim())) {
        // 检查下一个文本是否是英文标题
        if (text?.trim() === '标题：' || text?.trim() === '标题:') {
          foundEnTitle = true;
        }
        continue;
      }

      if (!text || !text.trim()) continue;

      // 如果刚遇到 "标题：" 且这行是英文，设为英文标题
      if (foundEnTitle && isEnglishText(text)) {
        enTitle = text.trim();
        foundEnTitle = false;
        continue;
      }
      foundEnTitle = false;

      // 按语言分类
      if (isEnglishText(text)) {
        enBlocks.push(block);
      } else if (isChineseText(text)) {
        zhBlocks.push(block);
      }
    }

    return {
      zh: blocksToMarkdown(zhBlocks),
      en: blocksToMarkdown(enBlocks),
      enTitle: enTitle
    };
  }

  if (columnLists.length >= 2) {
    // 情况1: 有多个 column（中文列和英文列分开）
    // 第一个有文字的列是中文，第二个是英文
    const col1 = separateByLanguage(columnLists[0].blocks);
    const col2 = separateByLanguage(columnLists[1].blocks);

    // 判断哪个是中文列，哪个是英文列
    if (isChineseText(col1.zh) && col1.zh.length > col1.en.length) {
      zhContent.body = col1.zh;
      enContent.body = col2.en || col2.zh; // 第二列可能全是英文
      enContent.title = col2.enTitle;
    } else {
      // 两列可能都是混合的，合并处理
      zhContent.body = col1.zh + '\n\n' + col2.zh;
      enContent.body = col1.en + '\n\n' + col2.en;
      enContent.title = col1.enTitle || col2.enTitle;
    }
  } else if (columnLists.length === 1) {
    // 情况2: 只有一个 column，中英文混在一起
    const separated = separateByLanguage(columnLists[0].blocks);
    zhContent.body = separated.zh;
    enContent.body = separated.en;
    enContent.title = separated.enTitle;
  } else {
    // 情况3: 没有 column_list，直接从顶层 blocks 解析
    let allTextBlocks = blocks.filter(b =>
      b.type === 'paragraph' || b.type.startsWith('heading') ||
      b.type === 'bulleted_list_item' || b.type === 'numbered_list_item'
    );
    const separated = separateByLanguage(allTextBlocks);
    zhContent.body = separated.zh;
    enContent.body = separated.en;
    enContent.title = separated.enTitle;
  }

  // 如果英文标题为空，尝试从英文正文第一行提取
  if (enContent.body && !enContent.title) {
    const lines = enContent.body.split('\n').filter(l => l.trim());
    if (lines.length > 0) {
      const firstLine = lines[0].trim();
      if (firstLine.length < 150 && !firstLine.startsWith('-') && !firstLine.startsWith('#') && isEnglishText(firstLine)) {
        enContent.title = firstLine;
        enContent.body = lines.slice(1).join('\n').trim();
      }
    }
  }

  // 清理空白
  zhContent.body = zhContent.body.trim();
  enContent.body = enContent.body.trim();

  return { zh: zhContent, en: enContent };
}

// 生成 slug（使用完整 page ID，确保唯一性）
function generateSlug(title, id) {
  return id.replace(/-/g, '');
}

// 同步单篇文章到数据库
async function syncArticle(article) {
  const pageId = article.id;
  const props = article.properties;

  // 提取属性
  const dbTitle = extractPlainText(props['标题']?.title) || 'Untitled';
  const contentType = props['内容形态']?.select?.name || 'article';
  const publishDate = props['发布']?.date?.start || new Date().toISOString();

  console.log(`Processing: ${dbTitle}`);

  // 解析页面内容
  const content = await parsePageContent(pageId, dbTitle);

  // 映射内容类型（全部作为 article）
  const mappedType = 'article';

  // 同步中文版本（始终同步）
  const zhSlug = generateSlug(content.zh.title, pageId);
  await upsertContent({
    slug: zhSlug,
    title: content.zh.title || dbTitle,
    description: (content.zh.body || '').substring(0, 200),
    body: content.zh.body || '',
    content_type: mappedType,
    lang: 'zh',
    thumbnail_url: null,
    status: 'published',
    published_at: publishDate,
    notion_page_id: pageId
  });
  console.log(`  ✓ Synced ZH: ${content.zh.title || dbTitle}`);

  // 只有当有英文标题和英文内容时才同步英文版本
  // 因为解析时已经按语言分离，这里只需检查长度
  const hasEnglishTitle = content.en.title && content.en.title.trim().length > 0;
  const hasEnglishBody = content.en.body && content.en.body.trim().length > 20;

  if (hasEnglishTitle && hasEnglishBody) {
    const enSlug = generateSlug(content.en.title, pageId) + '-en';
    await upsertContent({
      slug: enSlug,
      title: content.en.title,
      description: (content.en.body || '').substring(0, 200),
      body: content.en.body || '',
      content_type: mappedType,
      lang: 'en',
      thumbnail_url: null,
      status: 'published',
      published_at: publishDate,
      notion_page_id: pageId
    });
    console.log(`  ✓ Synced EN: ${content.en.title}`);
  } else {
    console.log(`  - No EN content for this page (title: ${hasEnglishTitle}, body: ${hasEnglishBody})`);
  }
}

// Upsert 内容到数据库
async function upsertContent(data) {
  const query = `
    INSERT INTO website_contents (
      slug, title, description, body, content_type, lang,
      thumbnail_url, status, published_at, updated_at
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
    ON CONFLICT (slug, lang)
    DO UPDATE SET
      title = EXCLUDED.title,
      description = EXCLUDED.description,
      body = EXCLUDED.body,
      content_type = EXCLUDED.content_type,
      thumbnail_url = EXCLUDED.thumbnail_url,
      status = EXCLUDED.status,
      published_at = EXCLUDED.published_at,
      updated_at = NOW()
  `;

  await pool.query(query, [
    data.slug,
    data.title,
    data.description,
    data.body,
    data.content_type,
    data.lang,
    data.thumbnail_url,
    data.status,
    data.published_at
  ]);
}

// 主函数
async function main() {
  console.log('=== Notion → Website Content Sync ===\n');

  try {
    // 1. 获取所有已发布文章
    console.log('Fetching published articles from Notion...');
    const articles = await getPublishedArticles();
    console.log(`Found ${articles.length} articles to sync\n`);

    // 2. 逐个同步
    let success = 0;
    let failed = 0;

    for (const article of articles) {
      try {
        await syncArticle(article);
        success++;
        // 添加延迟避免 API 限制
        await new Promise(r => setTimeout(r, 500));
      } catch (err) {
        console.error(`  ✗ Failed: ${err.message}`);
        failed++;
      }
    }

    console.log(`\n=== Sync Complete ===`);
    console.log(`Success: ${success}`);
    console.log(`Failed: ${failed}`);

  } catch (err) {
    console.error('Sync failed:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
