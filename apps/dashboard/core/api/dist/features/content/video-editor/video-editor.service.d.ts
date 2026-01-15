import ffmpeg from 'fluent-ffmpeg';
import { UploadedVideo, VideoJob, ProcessOptions, JobStatus, ProcessingStep, AiJobExtended, TranscriptResult } from './video-editor.types';
export declare function ensureDirectories(): void;
export declare function getVideoMetadata(filePath: string): Promise<ffmpeg.FfprobeData>;
export declare function saveVideo(tempPath: string, originalName: string, mimeType: string, fileSize: number): Promise<UploadedVideo>;
export declare function getVideo(id: string): UploadedVideo | undefined;
export declare function updateVideoTranscript(id: string, transcript: TranscriptResult): UploadedVideo | undefined;
export declare function getAllVideos(): UploadedVideo[];
export declare function createJob(videoId: string, options: ProcessOptions): Promise<VideoJob>;
export declare function getJob(id: string): VideoJob | undefined;
export declare function getAllJobs(): VideoJob[];
export declare function deleteVideo(id: string): boolean;
export declare function deleteJob(id: string): boolean;
export declare function createAiJob(jobId: string, video: UploadedVideo, userPrompt: string): Promise<AiJobExtended>;
export declare function updateAiJobStep(jobId: string, step: ProcessingStep, stepStatus: 'in_progress' | 'completed' | 'failed', message?: string, stepProgress?: number): void;
export declare function updateAiJobStatus(jobId: string, status: JobStatus, message?: string, outputPath?: string, analysis?: string, params?: ProcessOptions, transcript?: string): void;
export declare function getAiJob(id: string): AiJobExtended | undefined;
export declare function getAllAiJobs(): AiJobExtended[];
//# sourceMappingURL=video-editor.service.d.ts.map