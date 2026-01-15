"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Publish routes for content publishing
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const uuid_1 = require("uuid");
const publish_service_1 = require("./publish.service");
const upload_service_1 = require("./upload.service");
const media_service_1 = require("./media.service");
const platforms_config_1 = require("../../shared/config/platforms.config");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const router = (0, express_1.Router)();
// Configure multer for file uploads
const storage = multer_1.default.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path_1.default.join(upload_service_1.uploadService.getUploadDir(), 'temp');
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
    },
});
const upload = (0, multer_1.default)({
    storage,
    limits: {
        fileSize: 1024 * 1024 * 1024, // 1GB max
        files: 20, // max 20 files
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp',
            'video/mp4',
            'video/quicktime',
            'video/webm',
        ];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        }
        else {
            cb(new Error(`Unsupported file type: ${file.mimetype}`));
        }
    },
});
// GET /v1/publish/stats - Get publish statistics
router.get('/stats', async (req, res, next) => {
    try {
        const stats = await publish_service_1.publishService.getStats();
        res.json(stats);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/publish/platforms - Get all platform specs
router.get('/platforms', (req, res) => {
    const platforms = (0, platforms_config_1.getAllPlatforms)();
    res.json(platforms);
});
// GET /v1/publish/platforms/:platform - Get specific platform spec
router.get('/platforms/:platform', (req, res, next) => {
    const spec = platforms_config_1.platformSpecs[req.params.platform];
    if (!spec) {
        return next(new error_middleware_1.AppError(`Unknown platform: ${req.params.platform}`, 404));
    }
    res.json(spec);
});
// POST /v1/publish/upload - Upload files
router.post('/upload', upload.array('files', 20), async (req, res, next) => {
    try {
        const files = req.files;
        if (!files || files.length === 0) {
            throw new error_middleware_1.AppError('No files uploaded', 400);
        }
        const userId = req.userId; // From auth middleware if available
        const results = [];
        for (const file of files) {
            const mediaFile = await upload_service_1.uploadService.saveUploadedFile(file, userId);
            // Get image metadata if it's an image
            let metadata = {};
            if (file.mimetype.startsWith('image/')) {
                metadata = await media_service_1.mediaService.getImageMetadata(mediaFile.file_path);
                // Create thumbnail
                const thumbnailPath = await media_service_1.mediaService.createThumbnail(mediaFile.file_path);
                metadata.thumbnail = thumbnailPath;
            }
            results.push({
                id: mediaFile.id,
                originalName: mediaFile.original_name,
                filePath: mediaFile.file_path,
                fileSize: mediaFile.file_size,
                mimeType: mediaFile.mime_type,
                ...metadata,
            });
        }
        res.status(201).json({
            success: true,
            files: results,
        });
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/publish/tasks - Get all publish tasks
router.get('/tasks', async (req, res, next) => {
    try {
        const { status, limit, offset } = req.query;
        const tasks = await publish_service_1.publishService.getTasks({
            status: status,
            limit: limit ? parseInt(limit, 10) : undefined,
            offset: offset ? parseInt(offset, 10) : undefined,
        });
        res.json(tasks.map(task => publish_service_1.publishService.formatTaskForApi(task)));
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/publish/tasks/:id - Get task by ID
router.get('/tasks/:id', async (req, res, next) => {
    try {
        const task = await publish_service_1.publishService.getTaskById(req.params.id);
        res.json(publish_service_1.publishService.formatTaskForApi(task));
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/publish/tasks/:id/logs - Get task logs
router.get('/tasks/:id/logs', async (req, res, next) => {
    try {
        const logs = await publish_service_1.publishService.getTaskLogs(req.params.id);
        res.json(logs);
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/publish/tasks - Create new publish task
router.post('/tasks', async (req, res, next) => {
    try {
        const { titleZh, titleEn, contentZh, contentEn, mediaType, originalFiles, coverImage, targetPlatforms, scheduleAt } = req.body;
        if (!titleZh) {
            throw new error_middleware_1.AppError('Chinese title is required', 400);
        }
        if (!targetPlatforms || !Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
            throw new error_middleware_1.AppError('At least one target platform is required', 400);
        }
        // Validate platforms
        for (const platform of targetPlatforms) {
            if (!platforms_config_1.platformSpecs[platform]) {
                throw new error_middleware_1.AppError(`Unknown platform: ${platform}`, 400);
            }
        }
        const userId = req.userId;
        const task = await publish_service_1.publishService.createTask({
            titleZh,
            titleEn: titleEn || titleZh, // 英文标题默认使用中文
            contentZh,
            contentEn: contentEn || contentZh,
            mediaType: mediaType || 'text',
            originalFiles,
            coverImage,
            targetPlatforms,
            scheduleAt: scheduleAt ? new Date(scheduleAt) : undefined,
            createdBy: userId,
        });
        res.status(201).json(publish_service_1.publishService.formatTaskForApi(task));
    }
    catch (error) {
        next(error);
    }
});
// PATCH /v1/publish/tasks/:id - Update task
router.patch('/tasks/:id', async (req, res, next) => {
    try {
        const { title, content, titleZh, titleEn, contentZh, contentEn, originalFiles, targetPlatforms, scheduleAt } = req.body;
        const task = await publish_service_1.publishService.updateTask(req.params.id, {
            title,
            content,
            titleZh,
            titleEn,
            contentZh,
            contentEn,
            originalFiles,
            targetPlatforms,
            scheduleAt: scheduleAt === null ? null : scheduleAt ? new Date(scheduleAt) : undefined,
        });
        res.json(publish_service_1.publishService.formatTaskForApi(task));
    }
    catch (error) {
        next(error);
    }
});
// DELETE /v1/publish/tasks/:id - Delete task
router.delete('/tasks/:id', async (req, res, next) => {
    try {
        await publish_service_1.publishService.deleteTask(req.params.id);
        res.status(204).send();
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/publish/tasks/:id/submit - Process and submit task for publishing
router.post('/tasks/:id/submit', async (req, res, next) => {
    try {
        const task = await publish_service_1.publishService.processAndSubmit(req.params.id);
        res.json(publish_service_1.publishService.formatTaskForApi(task));
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/publish/tasks/:id/result - Update task result (called by n8n)
router.post('/tasks/:id/result', async (req, res, next) => {
    try {
        const { platform, success, url, error } = req.body;
        if (!platform) {
            throw new error_middleware_1.AppError('Platform is required', 400);
        }
        const task = await publish_service_1.publishService.updateTaskResult(req.params.id, platform, {
            success,
            url,
            error,
        });
        res.json(publish_service_1.publishService.formatTaskForApi(task));
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/publish/tasks/:id/retry/:platform - Retry single platform
router.post('/tasks/:id/retry/:platform', async (req, res, next) => {
    try {
        const { id, platform } = req.params;
        const task = await publish_service_1.publishService.retryPlatform(id, platform);
        res.json(publish_service_1.publishService.formatTaskForApi(task));
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/publish/tasks/:id/copy - Copy task
router.post('/tasks/:id/copy', async (req, res, next) => {
    try {
        const userId = req.userId;
        const task = await publish_service_1.publishService.copyTask(req.params.id, userId);
        res.status(201).json(publish_service_1.publishService.formatTaskForApi(task));
    }
    catch (error) {
        next(error);
    }
});
// POST /v1/publish/tasks/batch - Batch operations
router.post('/tasks/batch', async (req, res, next) => {
    try {
        const { action, ids } = req.body;
        if (!action || !ids || !Array.isArray(ids)) {
            throw new error_middleware_1.AppError('Action and ids array are required', 400);
        }
        if (!['delete', 'submit'].includes(action)) {
            throw new error_middleware_1.AppError('Invalid action. Must be "delete" or "submit"', 400);
        }
        const result = await publish_service_1.publishService.batchOperation(action, ids);
        res.json(result);
    }
    catch (error) {
        next(error);
    }
});
// GET /v1/publish/files/:path(*) - Serve uploaded files
router.get('/files/*', (req, res, next) => {
    try {
        const filePath = req.params[0];
        const fullPath = upload_service_1.uploadService.getFullPath(filePath);
        res.sendFile(fullPath);
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=publish.route.js.map