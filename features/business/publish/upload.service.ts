// Upload service for handling file uploads
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import config from '../../../shared/utils/config';
import logger from '../../../shared/utils/logger';
import { publishRepository, MediaFile } from './publish.repository';

export interface UploadResult {
  id: string;
  originalName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  width?: number;
  height?: number;
}

export class UploadService {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_PATH || path.join(process.cwd(), 'data/uploads');
    this.ensureUploadDirs();
  }

  private ensureUploadDirs(): void {
    const dirs = [
      this.uploadDir,
      path.join(this.uploadDir, 'original'),
      path.join(this.uploadDir, 'processed'),
      path.join(this.uploadDir, 'thumbnails'),
      path.join(this.uploadDir, 'temp'),
    ];

    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        logger.info(`Created upload directory: ${dir}`);
      }
    });
  }

  getUploadDir(): string {
    return this.uploadDir;
  }

  async saveUploadedFile(
    file: Express.Multer.File,
    userId?: number
  ): Promise<MediaFile> {
    const ext = path.extname(file.originalname).toLowerCase();
    const filename = `${uuidv4()}${ext}`;
    const relativePath = `original/${filename}`;
    const fullPath = path.join(this.uploadDir, relativePath);

    // Move file from temp to upload dir
    fs.renameSync(file.path, fullPath);

    logger.info('File saved', {
      originalName: file.originalname,
      path: relativePath,
      size: file.size,
      mimeType: file.mimetype,
    });

    // Create database record
    const mediaFile = await publishRepository.createMediaFile({
      original_name: file.originalname,
      file_path: relativePath,
      file_size: file.size,
      mime_type: file.mimetype,
      created_by: userId,
    });

    return mediaFile;
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = path.join(this.uploadDir, filePath);
    if (fs.existsSync(fullPath)) {
      fs.unlinkSync(fullPath);
      logger.info(`Deleted file: ${filePath}`);
    }
  }

  getFullPath(relativePath: string): string {
    return path.join(this.uploadDir, relativePath);
  }

  generateProcessedPath(originalPath: string, platform: string, suffix: string = ''): string {
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    return `processed/${baseName}_${platform}${suffix}${ext}`;
  }
}

export const uploadService = new UploadService();
export default uploadService;
