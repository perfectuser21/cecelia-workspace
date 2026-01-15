export interface ProcessedImage {
    platform: string;
    path: string;
    width: number;
    height: number;
}
export declare class MediaService {
    getImageMetadata(filePath: string): Promise<{
        width: number;
        height: number;
        format: string;
    }>;
    processImageForPlatforms(originalPath: string, platforms: string[]): Promise<Record<string, string[]>>;
    private processImageForPlatform;
    createThumbnail(originalPath: string, width?: number, height?: number): Promise<string>;
    cropToAspectRatio(originalPath: string, aspectRatio: string, platform: string): Promise<string>;
}
export declare const mediaService: MediaService;
export default mediaService;
//# sourceMappingURL=media.service.d.ts.map