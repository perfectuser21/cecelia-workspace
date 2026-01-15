"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.mediaService = exports.MediaService = void 0;
// Media processing service using Sharp for images
const sharp_1 = __importDefault(require("sharp"));
const path_1 = __importDefault(require("path"));
const upload_service_1 = require("./upload.service");
const platforms_config_1 = require("../../../shared/config/platforms.config");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
class MediaService {
    async getImageMetadata(filePath) {
        const fullPath = upload_service_1.uploadService.getFullPath(filePath);
        const metadata = await (0, sharp_1.default)(fullPath).metadata();
        return {
            width: metadata.width || 0,
            height: metadata.height || 0,
            format: metadata.format || 'unknown',
        };
    }
    async processImageForPlatforms(originalPath, platforms) {
        const result = {};
        const fullOriginalPath = upload_service_1.uploadService.getFullPath(originalPath);
        for (const platform of platforms) {
            const spec = platforms_config_1.platformSpecs[platform];
            if (!spec) {
                logger_1.default.warn(`Unknown platform: ${platform}`);
                continue;
            }
            try {
                const processedPaths = await this.processImageForPlatform(fullOriginalPath, originalPath, spec);
                result[platform] = processedPaths;
            }
            catch (error) {
                logger_1.default.error(`Failed to process image for ${platform}`, {
                    error: error.message,
                    originalPath,
                });
                // Use original for failed platforms
                result[platform] = [originalPath];
            }
        }
        return result;
    }
    async processImageForPlatform(fullOriginalPath, relativePath, spec) {
        const metadata = await (0, sharp_1.default)(fullOriginalPath).metadata();
        const originalWidth = metadata.width || 0;
        const originalHeight = metadata.height || 0;
        // If image is smaller than max, just optimize
        if (originalWidth <= spec.imageSpecs.maxWidth &&
            originalHeight <= spec.imageSpecs.maxHeight) {
            const outputPath = upload_service_1.uploadService.generateProcessedPath(relativePath, spec.name);
            const fullOutputPath = upload_service_1.uploadService.getFullPath(outputPath);
            await (0, sharp_1.default)(fullOriginalPath)
                .jpeg({ quality: 90 })
                .toFile(fullOutputPath);
            return [outputPath];
        }
        // Resize to fit within max dimensions
        const outputPath = upload_service_1.uploadService.generateProcessedPath(relativePath, spec.name);
        const fullOutputPath = upload_service_1.uploadService.getFullPath(outputPath);
        await (0, sharp_1.default)(fullOriginalPath)
            .resize(spec.imageSpecs.maxWidth, spec.imageSpecs.maxHeight, {
            fit: 'inside',
            withoutEnlargement: true,
        })
            .jpeg({ quality: 90 })
            .toFile(fullOutputPath);
        return [outputPath];
    }
    async createThumbnail(originalPath, width = 300, height = 300) {
        const fullOriginalPath = upload_service_1.uploadService.getFullPath(originalPath);
        const ext = path_1.default.extname(originalPath);
        const baseName = path_1.default.basename(originalPath, ext);
        const thumbnailPath = `thumbnails/${baseName}_thumb.jpg`;
        const fullThumbnailPath = upload_service_1.uploadService.getFullPath(thumbnailPath);
        await (0, sharp_1.default)(fullOriginalPath)
            .resize(width, height, {
            fit: 'cover',
            position: 'center',
        })
            .jpeg({ quality: 80 })
            .toFile(fullThumbnailPath);
        return thumbnailPath;
    }
    async cropToAspectRatio(originalPath, aspectRatio, platform) {
        const fullOriginalPath = upload_service_1.uploadService.getFullPath(originalPath);
        const metadata = await (0, sharp_1.default)(fullOriginalPath).metadata();
        const originalWidth = metadata.width || 0;
        const originalHeight = metadata.height || 0;
        const [ratioW, ratioH] = aspectRatio.split(':').map(Number);
        const targetRatio = ratioW / ratioH;
        const currentRatio = originalWidth / originalHeight;
        let cropWidth = originalWidth;
        let cropHeight = originalHeight;
        if (currentRatio > targetRatio) {
            // Image is wider than target ratio, crop width
            cropWidth = Math.floor(originalHeight * targetRatio);
        }
        else {
            // Image is taller than target ratio, crop height
            cropHeight = Math.floor(originalWidth / targetRatio);
        }
        const left = Math.floor((originalWidth - cropWidth) / 2);
        const top = Math.floor((originalHeight - cropHeight) / 2);
        const outputPath = upload_service_1.uploadService.generateProcessedPath(originalPath, platform, `_${ratioW}x${ratioH}`);
        const fullOutputPath = upload_service_1.uploadService.getFullPath(outputPath);
        await (0, sharp_1.default)(fullOriginalPath)
            .extract({
            left,
            top,
            width: cropWidth,
            height: cropHeight,
        })
            .jpeg({ quality: 90 })
            .toFile(fullOutputPath);
        return outputPath;
    }
}
exports.MediaService = MediaService;
exports.mediaService = new MediaService();
exports.default = exports.mediaService;
//# sourceMappingURL=media.service.js.map