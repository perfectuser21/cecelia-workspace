export interface PlatformSpec {
    name: string;
    displayName: string;
    imageSpecs: {
        aspectRatios: string[];
        maxWidth: number;
        maxHeight: number;
        maxSize: number;
        formats: string[];
    };
    videoSpecs: {
        maxDuration: number;
        maxSize: number;
        formats: string[];
    };
    titleLimit: number;
    contentLimit: number;
    supportsMultiImage: boolean;
    maxImages: number;
}
export declare const platformSpecs: Record<string, PlatformSpec>;
export declare function getPlatformSpec(platform: string): PlatformSpec | null;
export declare function getAllPlatforms(): PlatformSpec[];
export default platformSpecs;
//# sourceMappingURL=platforms.config.d.ts.map