"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Website contents API routes
// Public routes for zenithjoyai.com to fetch content
const express_1 = require("express");
const contents_repository_1 = require("./contents.repository");
const auth_middleware_1 = require("../../../shared/middleware/auth.middleware");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const axios_1 = __importDefault(require("axios"));
// Cloudflare Deploy Hook - 发布内容后自动触发网站重新构建
const CLOUDFLARE_DEPLOY_HOOK = process.env.CLOUDFLARE_DEPLOY_HOOK || '';
async function triggerWebsiteRebuild() {
    if (!CLOUDFLARE_DEPLOY_HOOK) {
        logger_1.default.warn('CLOUDFLARE_DEPLOY_HOOK not configured, skipping rebuild trigger');
        return;
    }
    try {
        await axios_1.default.post(CLOUDFLARE_DEPLOY_HOOK);
        logger_1.default.info('Triggered zenithjoyai.com rebuild via Cloudflare Deploy Hook');
    }
    catch (error) {
        logger_1.default.error('Failed to trigger website rebuild', { error: error.message });
    }
}
const router = (0, express_1.Router)();
// Public route: Get all published contents (for zenithjoyai.com)
router.get('/', async (req, res, next) => {
    try {
        const { lang, type, limit, offset } = req.query;
        const contents = await contents_repository_1.contentsRepository.findAll({
            lang: lang,
            content_type: type,
            status: 'published', // Only return published content
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        const total = await contents_repository_1.contentsRepository.count({
            lang: lang,
            content_type: type,
            status: 'published',
        });
        res.json({
            success: true,
            data: contents,
            total,
        });
    }
    catch (error) {
        next(error);
    }
});
// Public route: Get single content by slug
router.get('/slug/:slug', async (req, res, next) => {
    try {
        const { slug } = req.params;
        const { lang = 'zh' } = req.query;
        const content = await contents_repository_1.contentsRepository.findBySlugAndLang(slug, lang);
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
    }
    catch (error) {
        next(error);
    }
});
// ======= Admin routes (require authentication) =======
// Get all contents (including drafts) for admin
router.get('/admin', auth_middleware_1.authMiddleware, async (req, res, next) => {
    try {
        const { lang, type, status, limit, offset } = req.query;
        const contents = await contents_repository_1.contentsRepository.findAll({
            lang: lang,
            content_type: type,
            status: status,
            limit: limit ? parseInt(limit, 10) : 50,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        const total = await contents_repository_1.contentsRepository.count({
            lang: lang,
            content_type: type,
            status: status,
        });
        res.json({
            success: true,
            data: contents,
            total,
        });
    }
    catch (error) {
        next(error);
    }
});
// Get single content by ID for admin
router.get('/admin/:id', auth_middleware_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const content = await contents_repository_1.contentsRepository.findById(id);
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
    }
    catch (error) {
        next(error);
    }
});
// Create new content
router.post('/admin', auth_middleware_1.authMiddleware, async (req, res, next) => {
    try {
        const { slug, title, description, body, content_type, lang, tags, reading_time, faq, key_takeaways, quotable_insights, video_url, thumbnail_url, status, } = req.body;
        if (!slug || !title || !content_type) {
            return res.status(400).json({
                success: false,
                error: 'Missing required fields: slug, title, content_type',
            });
        }
        // Check if slug already exists for this language
        const existing = await contents_repository_1.contentsRepository.findBySlugAndLang(slug, lang || 'zh');
        if (existing) {
            return res.status(400).json({
                success: false,
                error: 'Content with this slug already exists for this language',
            });
        }
        const content = await contents_repository_1.contentsRepository.create({
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
        logger_1.default.info('Content created', { id: content.id, slug: content.slug });
        res.status(201).json({
            success: true,
            data: content,
        });
    }
    catch (error) {
        next(error);
    }
});
// Update content
router.put('/admin/:id', auth_middleware_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const content = await contents_repository_1.contentsRepository.update(id, updates);
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found',
            });
        }
        logger_1.default.info('Content updated', { id: content.id, slug: content.slug });
        // 如果是已发布的内容被修改，触发重建
        if (content.status === 'published') {
            triggerWebsiteRebuild();
        }
        res.json({
            success: true,
            data: content,
        });
    }
    catch (error) {
        next(error);
    }
});
// Delete content
router.delete('/admin/:id', auth_middleware_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        // 先获取内容状态，判断是否需要触发重建
        const content = await contents_repository_1.contentsRepository.findById(id);
        const wasPublished = content?.status === 'published';
        const deleted = await contents_repository_1.contentsRepository.delete(id);
        if (!deleted) {
            return res.status(404).json({
                success: false,
                error: 'Content not found',
            });
        }
        logger_1.default.info('Content deleted', { id });
        // 如果删除的是已发布内容，触发重建
        if (wasPublished) {
            triggerWebsiteRebuild();
        }
        res.json({
            success: true,
            message: 'Content deleted',
        });
    }
    catch (error) {
        next(error);
    }
});
// Publish content (change status to published)
router.post('/admin/:id/publish', auth_middleware_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const content = await contents_repository_1.contentsRepository.update(id, {
            status: 'published',
            published_at: new Date(),
        });
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found',
            });
        }
        logger_1.default.info('Content published', { id: content.id, slug: content.slug });
        // 触发 zenithjoyai.com 重新构建
        triggerWebsiteRebuild();
        res.json({
            success: true,
            data: content,
        });
    }
    catch (error) {
        next(error);
    }
});
// Unpublish content (change status to draft)
router.post('/admin/:id/unpublish', auth_middleware_1.authMiddleware, async (req, res, next) => {
    try {
        const { id } = req.params;
        const content = await contents_repository_1.contentsRepository.update(id, {
            status: 'draft',
        });
        if (!content) {
            return res.status(404).json({
                success: false,
                error: 'Content not found',
            });
        }
        logger_1.default.info('Content unpublished', { id: content.id, slug: content.slug });
        // 撤回发布也需要触发重建（从网站移除内容）
        triggerWebsiteRebuild();
        res.json({
            success: true,
            data: content,
        });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=contents.route.js.map