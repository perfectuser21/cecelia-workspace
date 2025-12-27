// Media processing service using Sharp for images
import sharp from 'sharp';
import path from 'path';
import fs from 'fs';
import { uploadService } from './upload.service';
import { platformSpecs, PlatformSpec } from '../../shared/config/platforms.config';
import logger from '../../shared/utils/logger';

export interface ProcessedImage {
  platform: string;
  path: string;
  width: number;
  height: number;
}

export class MediaService {
  async getImageMetadata(filePath: string): Promise<{
    width: number;
    height: number;
    format: string;
  }> {
    const fullPath = uploadService.getFullPath(filePath);
    const metadata = await sharp(fullPath).metadata();
    return {
      width: metadata.width || 0,
      height: metadata.height || 0,
      format: metadata.format || 'unknown',
    };
  }

  async processImageForPlatforms(
    originalPath: string,
    platforms: string[]
  ): Promise<Record<string, string[]>> {
    const result: Record<string, string[]> = {};
    const fullOriginalPath = uploadService.getFullPath(originalPath);

    for (const platform of platforms) {
      const spec = platformSpecs[platform];
      if (!spec) {
        logger.warn(`Unknown platform: ${platform}`);
        continue;
      }

      try {
        const processedPaths = await this.processImageForPlatform(
          fullOriginalPath,
          originalPath,
          spec
        );
        result[platform] = processedPaths;
      } catch (error: any) {
        logger.error(`Failed to process image for ${platform}`, {
          error: error.message,
          originalPath,
        });
        // Use original for failed platforms
        result[platform] = [originalPath];
      }
    }

    return result;
  }

  private async processImageForPlatform(
    fullOriginalPath: string,
    relativePath: string,
    spec: PlatformSpec
  ): Promise<string[]> {
    const metadata = await sharp(fullOriginalPath).metadata();
    const originalWidth = metadata.width || 0;
    const originalHeight = metadata.height || 0;

    // If image is smaller than max, just optimize
    if (
      originalWidth <= spec.imageSpecs.maxWidth &&
      originalHeight <= spec.imageSpecs.maxHeight
    ) {
      const outputPath = uploadService.generateProcessedPath(
        relativePath,
        spec.name
      );
      const fullOutputPath = uploadService.getFullPath(outputPath);

      await sharp(fullOriginalPath)
        .jpeg({ quality: 90 })
        .toFile(fullOutputPath);

      return [outputPath];
    }

    // Resize to fit within max dimensions
    const outputPath = uploadService.generateProcessedPath(
      relativePath,
      spec.name
    );
    const fullOutputPath = uploadService.getFullPath(outputPath);

    await sharp(fullOriginalPath)
      .resize(spec.imageSpecs.maxWidth, spec.imageSpecs.maxHeight, {
        fit: 'inside',
        withoutEnlargement: true,
      })
      .jpeg({ quality: 90 })
      .toFile(fullOutputPath);

    return [outputPath];
  }

  async createThumbnail(
    originalPath: string,
    width: number = 300,
    height: number = 300
  ): Promise<string> {
    const fullOriginalPath = uploadService.getFullPath(originalPath);
    const ext = path.extname(originalPath);
    const baseName = path.basename(originalPath, ext);
    const thumbnailPath = `thumbnails/${baseName}_thumb.jpg`;
    const fullThumbnailPath = uploadService.getFullPath(thumbnailPath);

    await sharp(fullOriginalPath)
      .resize(width, height, {
        fit: 'cover',
        position: 'center',
      })
      .jpeg({ quality: 80 })
      .toFile(fullThumbnailPath);

    return thumbnailPath;
  }

  async cropToAspectRatio(
    originalPath: string,
    aspectRatio: string,
    platform: string
  ): Promise<string> {
    const fullOriginalPath = uploadService.getFullPath(originalPath);
    const metadata = await sharp(fullOriginalPath).metadata();
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
    } else {
      // Image is taller than target ratio, crop height
      cropHeight = Math.floor(originalWidth / targetRatio);
    }

    const left = Math.floor((originalWidth - cropWidth) / 2);
    const top = Math.floor((originalHeight - cropHeight) / 2);

    const outputPath = uploadService.generateProcessedPath(
      originalPath,
      platform,
      `_${ratioW}x${ratioH}`
    );
    const fullOutputPath = uploadService.getFullPath(outputPath);

    await sharp(fullOriginalPath)
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

export const mediaService = new MediaService();
export default mediaService;
