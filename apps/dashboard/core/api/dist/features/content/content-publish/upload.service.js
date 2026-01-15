"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.uploadService = exports.UploadService = void 0;
// Upload service for handling file uploads
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const publish_repository_1 = require("./publish.repository");
class UploadService {
    constructor() {
        this.uploadDir = process.env.UPLOAD_PATH || path_1.default.join(process.cwd(), 'data/uploads');
        this.ensureUploadDirs();
    }
    ensureUploadDirs() {
        const dirs = [
            this.uploadDir,
            path_1.default.join(this.uploadDir, 'original'),
            path_1.default.join(this.uploadDir, 'processed'),
            path_1.default.join(this.uploadDir, 'thumbnails'),
            path_1.default.join(this.uploadDir, 'temp'),
        ];
        dirs.forEach(dir => {
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
                logger_1.default.info(`Created upload directory: ${dir}`);
            }
        });
    }
    getUploadDir() {
        return this.uploadDir;
    }
    async saveUploadedFile(file, userId) {
        const ext = path_1.default.extname(file.originalname).toLowerCase();
        const filename = `${(0, uuid_1.v4)()}${ext}`;
        const relativePath = `original/${filename}`;
        const fullPath = path_1.default.join(this.uploadDir, relativePath);
        // Move file from temp to upload dir
        fs_1.default.renameSync(file.path, fullPath);
        logger_1.default.info('File saved', {
            originalName: file.originalname,
            path: relativePath,
            size: file.size,
            mimeType: file.mimetype,
        });
        // Create database record
        const mediaFile = await publish_repository_1.publishRepository.createMediaFile({
            original_name: file.originalname,
            file_path: relativePath,
            file_size: file.size,
            mime_type: file.mimetype,
            created_by: userId,
        });
        return mediaFile;
    }
    async deleteFile(filePath) {
        const fullPath = path_1.default.join(this.uploadDir, filePath);
        if (fs_1.default.existsSync(fullPath)) {
            fs_1.default.unlinkSync(fullPath);
            logger_1.default.info(`Deleted file: ${filePath}`);
        }
    }
    getFullPath(relativePath) {
        return path_1.default.join(this.uploadDir, relativePath);
    }
    generateProcessedPath(originalPath, platform, suffix = '') {
        const ext = path_1.default.extname(originalPath);
        const baseName = path_1.default.basename(originalPath, ext);
        return `processed/${baseName}_${platform}${suffix}${ext}`;
    }
}
exports.UploadService = UploadService;
exports.uploadService = new UploadService();
exports.default = exports.uploadService;
//# sourceMappingURL=upload.service.js.map