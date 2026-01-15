import { MediaFile } from './publish.repository';
export interface UploadResult {
    id: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    width?: number;
    height?: number;
}
export declare class UploadService {
    private uploadDir;
    constructor();
    private ensureUploadDirs;
    getUploadDir(): string;
    saveUploadedFile(file: Express.Multer.File, userId?: number): Promise<MediaFile>;
    deleteFile(filePath: string): Promise<void>;
    getFullPath(relativePath: string): string;
    generateProcessedPath(originalPath: string, platform: string, suffix?: string): string;
}
export declare const uploadService: UploadService;
export default uploadService;
//# sourceMappingURL=upload.service.d.ts.map