export interface TranscriptSegment {
    start: number;
    end: number;
    text: string;
}
export interface TranscriptResult {
    segments: TranscriptSegment[];
    fullText: string;
    language: string;
    languageProbability?: number;
    duration?: number;
}
export interface UploadedVideo {
    id: string;
    originalName: string;
    filePath: string;
    fileSize: number;
    mimeType: string;
    duration?: number;
    width?: number;
    height?: number;
    transcript?: TranscriptResult;
    createdAt: Date;
}
export interface TrimOptions {
    start: string;
    end: string;
}
export interface ResizeOptions {
    width: number;
    height: number;
    fit: 'cover' | 'contain' | 'fill';
}
export type AspectRatioPreset = '9:16' | '16:9' | '1:1' | '4:3' | '3:4';
export interface SubtitleOptions {
    text: string;
    style: 'bottom' | 'top' | 'center';
    fontSize?: number;
    fontColor?: string;
    backgroundColor?: string;
}
export interface ProcessOptions {
    trim?: TrimOptions;
    resize?: ResizeOptions;
    preset?: AspectRatioPreset;
    subtitle?: SubtitleOptions;
}
export type JobStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface VideoJob {
    id: string;
    videoId: string;
    originalVideo: UploadedVideo;
    options: ProcessOptions;
    status: JobStatus;
    progress: number;
    outputPath?: string;
    error?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateJobRequest {
    videoId: string;
    options: ProcessOptions;
}
export interface JobStatusResponse {
    id: string;
    status: JobStatus;
    progress: number;
    outputPath?: string;
    error?: string;
}
export type ProcessingStep = 'whisper' | 'ai_analysis' | 'ffmpeg_prepare' | 'ffmpeg_execute';
export interface StepInfo {
    step: ProcessingStep;
    name: string;
    status: 'pending' | 'in_progress' | 'completed' | 'failed';
    progress: number;
    message?: string;
    startedAt?: Date;
    completedAt?: Date;
}
export declare const PROCESSING_STEPS: {
    step: ProcessingStep;
    name: string;
}[];
export interface AiJobExtended {
    id: string;
    videoId: string;
    originalVideo: UploadedVideo;
    options: ProcessOptions;
    status: JobStatus;
    progress: number;
    outputPath?: string;
    error?: string;
    userPrompt: string;
    aiAnalysis?: string;
    aiParams?: ProcessOptions;
    transcript?: string;
    steps: StepInfo[];
    currentStep?: ProcessingStep;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PRESET_DIMENSIONS: Record<AspectRatioPreset, {
    width: number;
    height: number;
}>;
//# sourceMappingURL=video-editor.types.d.ts.map