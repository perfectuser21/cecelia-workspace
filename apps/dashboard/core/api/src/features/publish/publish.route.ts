// Publish routes for content publishing
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { publishService } from './publish.service';
import { uploadService } from './upload.service';
import { mediaService } from './media.service';
import { platformSpecs, getAllPlatforms } from '../../shared/config/platforms.config';
import { AppError } from '../../shared/middleware/error.middleware';

const router = Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(uploadService.getUploadDir(), 'temp');
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
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
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}`));
    }
  },
});

// GET /v1/publish/stats - Get publish statistics
router.get('/stats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stats = await publishService.getStats();
    res.json(stats);
  } catch (error) {
    next(error);
  }
});

// GET /v1/publish/platforms - Get all platform specs
router.get('/platforms', (req: Request, res: Response) => {
  const platforms = getAllPlatforms();
  res.json(platforms);
});

// GET /v1/publish/platforms/:platform - Get specific platform spec
router.get('/platforms/:platform', (req: Request, res: Response, next: NextFunction) => {
  const spec = platformSpecs[req.params.platform];
  if (!spec) {
    return next(new AppError(`Unknown platform: ${req.params.platform}`, 404));
  }
  res.json(spec);
});

// POST /v1/publish/upload - Upload files
router.post(
  '/upload',
  upload.array('files', 20),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const files = req.files as Express.Multer.File[];
      if (!files || files.length === 0) {
        throw new AppError('No files uploaded', 400);
      }

      const userId = (req as any).userId; // From auth middleware if available
      const results = [];

      for (const file of files) {
        const mediaFile = await uploadService.saveUploadedFile(file, userId);

        // Get image metadata if it's an image
        let metadata: any = {};
        if (file.mimetype.startsWith('image/')) {
          metadata = await mediaService.getImageMetadata(mediaFile.file_path);

          // Create thumbnail
          const thumbnailPath = await mediaService.createThumbnail(mediaFile.file_path);
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
    } catch (error) {
      next(error);
    }
  }
);

// GET /v1/publish/tasks - Get all publish tasks
router.get('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, limit, offset } = req.query;
    const tasks = await publishService.getTasks({
      status: status as string,
      limit: limit ? parseInt(limit as string, 10) : undefined,
      offset: offset ? parseInt(offset as string, 10) : undefined,
    });

    res.json(tasks.map(task => publishService.formatTaskForApi(task)));
  } catch (error) {
    next(error);
  }
});

// GET /v1/publish/tasks/:id - Get task by ID
router.get('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await publishService.getTaskById(req.params.id);
    res.json(publishService.formatTaskForApi(task));
  } catch (error) {
    next(error);
  }
});

// GET /v1/publish/tasks/:id/logs - Get task logs
router.get('/tasks/:id/logs', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const logs = await publishService.getTaskLogs(req.params.id);
    res.json(logs);
  } catch (error) {
    next(error);
  }
});

// POST /v1/publish/tasks - Create new publish task
router.post('/tasks', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { titleZh, titleEn, contentZh, contentEn, mediaType, originalFiles, coverImage, targetPlatforms, scheduleAt } = req.body;

    if (!titleZh) {
      throw new AppError('Chinese title is required', 400);
    }
    if (!targetPlatforms || !Array.isArray(targetPlatforms) || targetPlatforms.length === 0) {
      throw new AppError('At least one target platform is required', 400);
    }

    // Validate platforms
    for (const platform of targetPlatforms) {
      if (!platformSpecs[platform]) {
        throw new AppError(`Unknown platform: ${platform}`, 400);
      }
    }

    const userId = (req as any).userId;
    const task = await publishService.createTask({
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

    res.status(201).json(publishService.formatTaskForApi(task));
  } catch (error) {
    next(error);
  }
});

// PATCH /v1/publish/tasks/:id - Update task
router.patch('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, titleZh, titleEn, contentZh, contentEn, originalFiles, targetPlatforms, scheduleAt } = req.body;

    const task = await publishService.updateTask(req.params.id, {
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

    res.json(publishService.formatTaskForApi(task));
  } catch (error) {
    next(error);
  }
});

// DELETE /v1/publish/tasks/:id - Delete task
router.delete('/tasks/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await publishService.deleteTask(req.params.id);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /v1/publish/tasks/:id/submit - Process and submit task for publishing
router.post('/tasks/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const task = await publishService.processAndSubmit(req.params.id);
    res.json(publishService.formatTaskForApi(task));
  } catch (error) {
    next(error);
  }
});

// POST /v1/publish/tasks/:id/result - Update task result (called by n8n)
router.post('/tasks/:id/result', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { platform, success, url, error } = req.body;

    if (!platform) {
      throw new AppError('Platform is required', 400);
    }

    const task = await publishService.updateTaskResult(req.params.id, platform, {
      success,
      url,
      error,
    });

    res.json(publishService.formatTaskForApi(task));
  } catch (error) {
    next(error);
  }
});

// POST /v1/publish/tasks/:id/retry/:platform - Retry single platform
router.post('/tasks/:id/retry/:platform', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, platform } = req.params;
    const task = await publishService.retryPlatform(id, platform);
    res.json(publishService.formatTaskForApi(task));
  } catch (error) {
    next(error);
  }
});

// POST /v1/publish/tasks/:id/copy - Copy task
router.post('/tasks/:id/copy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).userId;
    const task = await publishService.copyTask(req.params.id, userId);
    res.status(201).json(publishService.formatTaskForApi(task));
  } catch (error) {
    next(error);
  }
});

// POST /v1/publish/tasks/batch - Batch operations
router.post('/tasks/batch', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, ids } = req.body;

    if (!action || !ids || !Array.isArray(ids)) {
      throw new AppError('Action and ids array are required', 400);
    }

    if (!['delete', 'submit'].includes(action)) {
      throw new AppError('Invalid action. Must be "delete" or "submit"', 400);
    }

    const result = await publishService.batchOperation(action, ids);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

// GET /v1/publish/files/:path(*) - Serve uploaded files
router.get('/files/*', (req: Request, res: Response, next: NextFunction) => {
  try {
    const filePath = req.params[0];
    const fullPath = uploadService.getFullPath(filePath);
    res.sendFile(fullPath);
  } catch (error) {
    next(error);
  }
});

export default router;
