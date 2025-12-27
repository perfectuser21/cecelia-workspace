// Website contents API routes
// Public routes for zenithjoyai.com to fetch content
import { Router, Request, Response, NextFunction } from 'express';
import { contentsRepository } from './contents.repository';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import logger from '../../shared/utils/logger';
import axios from 'axios';

// Cloudflare Deploy Hook - 发布内容后自动触发网站重新构建
const CLOUDFLARE_DEPLOY_HOOK = process.env.CLOUDFLARE_DEPLOY_HOOK || '';

async function triggerWebsiteRebuild() {
  if (!CLOUDFLARE_DEPLOY_HOOK) {
    logger.warn('CLOUDFLARE_DEPLOY_HOOK not configured, skipping rebuild trigger');
    return;
  }

  try {
    await axios.post(CLOUDFLARE_DEPLOY_HOOK);
    logger.info('Triggered zenithjoyai.com rebuild via Cloudflare Deploy Hook');
  } catch (error: any) {
    logger.error('Failed to trigger website rebuild', { error: error.message });
  }
}

const router = Router();

// Public route: Get all published contents (for zenithjoyai.com)
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lang, type, limit, offset } = req.query;

    const contents = await contentsRepository.findAll({
      lang: lang as string,
      content_type: type as string,
      status: 'published', // Only return published content
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    const total = await contentsRepository.count({
      lang: lang as string,
      content_type: type as string,
      status: 'published',
    });

    res.json({
      success: true,
      data: contents,
      total,
    });
  } catch (error) {
    next(error);
  }
});

// Public route: Get single content by slug
router.get('/slug/:slug', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { slug } = req.params;
    const { lang = 'zh' } = req.query;

    const content = await contentsRepository.findBySlugAndLang(slug, lang as string);

    if (!content || content.status !== 'published') {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

// ======= Admin routes (require authentication) =======

// Get all contents (including drafts) for admin
router.get('/admin', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { lang, type, status, limit, offset } = req.query;

    const contents = await contentsRepository.findAll({
      lang: lang as string,
      content_type: type as string,
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : 50,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    const total = await contentsRepository.count({
      lang: lang as string,
      content_type: type as string,
      status: status as string,
    });

    res.json({
      success: true,
      data: contents,
      total,
    });
  } catch (error) {
    next(error);
  }
});

// Get single content by ID for admin
router.get('/admin/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const content = await contentsRepository.findById(id);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

// Create new content
router.post('/admin', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      slug,
      title,
      description,
      body,
      content_type,
      lang,
      tags,
      reading_time,
      faq,
      key_takeaways,
      quotable_insights,
      video_url,
      thumbnail_url,
      status,
    } = req.body;

    if (!slug || !title || !content_type) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields: slug, title, content_type',
      });
    }

    // Check if slug already exists for this language
    const existing = await contentsRepository.findBySlugAndLang(slug, lang || 'zh');
    if (existing) {
      return res.status(400).json({
        success: false,
        error: 'Content with this slug already exists for this language',
      });
    }

    const content = await contentsRepository.create({
      slug,
      title,
      description,
      body,
      content_type,
      lang,
      tags,
      reading_time,
      faq,
      key_takeaways,
      quotable_insights,
      video_url,
      thumbnail_url,
      status,
    });

    logger.info('Content created', { id: content.id, slug: content.slug });

    res.status(201).json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

// Update content
router.put('/admin/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const content = await contentsRepository.update(id, updates);

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    logger.info('Content updated', { id: content.id, slug: content.slug });

    // 如果是已发布的内容被修改，触发重建
    if (content.status === 'published') {
      triggerWebsiteRebuild();
    }

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

// Delete content
router.delete('/admin/:id', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    // 先获取内容状态，判断是否需要触发重建
    const content = await contentsRepository.findById(id);
    const wasPublished = content?.status === 'published';

    const deleted = await contentsRepository.delete(id);

    if (!deleted) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    logger.info('Content deleted', { id });

    // 如果删除的是已发布内容，触发重建
    if (wasPublished) {
      triggerWebsiteRebuild();
    }

    res.json({
      success: true,
      message: 'Content deleted',
    });
  } catch (error) {
    next(error);
  }
});

// Publish content (change status to published)
router.post('/admin/:id/publish', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const content = await contentsRepository.update(id, {
      status: 'published',
      published_at: new Date(),
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    logger.info('Content published', { id: content.id, slug: content.slug });

    // 触发 zenithjoyai.com 重新构建
    triggerWebsiteRebuild();

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

// Unpublish content (change status to draft)
router.post('/admin/:id/unpublish', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const content = await contentsRepository.update(id, {
      status: 'draft',
    });

    if (!content) {
      return res.status(404).json({
        success: false,
        error: 'Content not found',
      });
    }

    logger.info('Content unpublished', { id: content.id, slug: content.slug });

    // 撤回发布也需要触发重建（从网站移除内容）
    triggerWebsiteRebuild();

    res.json({
      success: true,
      data: content,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
