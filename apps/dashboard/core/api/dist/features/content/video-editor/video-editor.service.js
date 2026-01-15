"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ensureDirectories = ensureDirectories;
exports.getVideoMetadata = getVideoMetadata;
exports.saveVideo = saveVideo;
exports.getVideo = getVideo;
exports.updateVideoTranscript = updateVideoTranscript;
exports.getAllVideos = getAllVideos;
exports.createJob = createJob;
exports.getJob = getJob;
exports.getAllJobs = getAllJobs;
exports.deleteVideo = deleteVideo;
exports.deleteJob = deleteJob;
exports.createAiJob = createAiJob;
exports.updateAiJobStep = updateAiJobStep;
exports.updateAiJobStatus = updateAiJobStatus;
exports.getAiJob = getAiJob;
exports.getAllAiJobs = getAllAiJobs;
const fluent_ffmpeg_1 = __importDefault(require("fluent-ffmpeg"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const video_editor_types_1 = require("./video-editor.types");
const UPLOAD_PATH = process.env.UPLOAD_PATH || 'data/uploads';
const VIDEO_DIR = path_1.default.join(UPLOAD_PATH, 'videos');
const OUTPUT_DIR = path_1.default.join(UPLOAD_PATH, 'processed');
// 内存存储（生产环境应使用数据库）
const videos = new Map();
const jobs = new Map();
// 确保目录存在
function ensureDirectories() {
    [VIDEO_DIR, OUTPUT_DIR].forEach(dir => {
        if (!fs_1.default.existsSync(dir)) {
            fs_1.default.mkdirSync(dir, { recursive: true });
        }
    });
}
// 获取视频元数据
function getVideoMetadata(filePath) {
    return new Promise((resolve, reject) => {
        fluent_ffmpeg_1.default.ffprobe(filePath, (err, metadata) => {
            if (err)
                reject(err);
            else
                resolve(metadata);
        });
    });
}
// 保存上传的视频
async function saveVideo(tempPath, originalName, mimeType, fileSize) {
    ensureDirectories();
    const id = (0, uuid_1.v4)();
    const ext = path_1.default.extname(originalName);
    const fileName = `${id}${ext}`;
    const filePath = path_1.default.join(VIDEO_DIR, fileName);
    // 移动文件
    fs_1.default.renameSync(tempPath, filePath);
    // 获取视频元数据
    let duration;
    let width;
    let height;
    try {
        const metadata = await getVideoMetadata(filePath);
        const videoStream = metadata.streams.find(s => s.codec_type === 'video');
        if (videoStream) {
            width = videoStream.width;
            height = videoStream.height;
        }
        duration = metadata.format.duration;
    }
    catch (err) {
        console.error('Failed to get video metadata:', err);
    }
    const video = {
        id,
        originalName,
        filePath: `videos/${fileName}`,
        fileSize,
        mimeType,
        duration,
        width,
        height,
        createdAt: new Date(),
    };
    videos.set(id, video);
    return video;
}
// 获取视频信息
function getVideo(id) {
    return videos.get(id);
}
// 更新视频转录结果
function updateVideoTranscript(id, transcript) {
    const video = videos.get(id);
    if (!video) {
        return undefined;
    }
    video.transcript = transcript;
    videos.set(id, video);
    return video;
}
// 获取所有视频
function getAllVideos() {
    return Array.from(videos.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
// 创建处理任务
async function createJob(videoId, options) {
    const video = videos.get(videoId);
    if (!video) {
        throw new Error('Video not found');
    }
    const job = {
        id: (0, uuid_1.v4)(),
        videoId,
        originalVideo: video,
        options,
        status: 'pending',
        progress: 0,
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    jobs.set(job.id, job);
    // 异步处理
    processVideoAsync(job);
    return job;
}
// 获取任务状态
function getJob(id) {
    return jobs.get(id);
}
// 获取所有任务
function getAllJobs() {
    return Array.from(jobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
// 异步处理视频
async function processVideoAsync(job) {
    const inputPath = path_1.default.join(UPLOAD_PATH, job.originalVideo.filePath);
    const outputFileName = `${job.id}.mp4`;
    const outputPath = path_1.default.join(OUTPUT_DIR, outputFileName);
    // 更新状态
    job.status = 'processing';
    job.updatedAt = new Date();
    try {
        await processVideo(inputPath, outputPath, job.options, (progress) => {
            job.progress = progress;
            job.updatedAt = new Date();
        });
        job.status = 'completed';
        job.progress = 100;
        job.outputPath = `processed/${outputFileName}`;
        job.updatedAt = new Date();
    }
    catch (err) {
        job.status = 'failed';
        job.error = err.message || 'Processing failed';
        job.updatedAt = new Date();
        console.error('Video processing failed:', err);
    }
}
// FFmpeg 处理视频
function processVideo(inputPath, outputPath, options, onProgress) {
    return new Promise((resolve, reject) => {
        let command = (0, fluent_ffmpeg_1.default)(inputPath);
        let totalDuration = 0;
        // 获取总时长用于计算进度
        fluent_ffmpeg_1.default.ffprobe(inputPath, (err, metadata) => {
            if (!err && metadata.format.duration) {
                totalDuration = metadata.format.duration;
            }
        });
        // 裁剪时间
        if (options.trim) {
            command = command.setStartTime(options.trim.start);
            if (options.trim.end) {
                command = command.setDuration(calculateDuration(options.trim.start, options.trim.end));
            }
        }
        // 调整尺寸
        let targetWidth;
        let targetHeight;
        if (options.preset) {
            const dimensions = video_editor_types_1.PRESET_DIMENSIONS[options.preset];
            targetWidth = dimensions.width;
            targetHeight = dimensions.height;
        }
        else if (options.resize) {
            targetWidth = options.resize.width;
            targetHeight = options.resize.height;
        }
        if (targetWidth && targetHeight) {
            // 使用 scale 和 pad 实现不同的 fit 模式
            const fit = options.resize?.fit || 'cover';
            if (fit === 'cover') {
                // 裁剪以填满目标尺寸
                command = command.videoFilters([
                    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=increase`,
                    `crop=${targetWidth}:${targetHeight}`
                ]);
            }
            else if (fit === 'contain') {
                // 保持比例，添加黑边
                command = command.videoFilters([
                    `scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease`,
                    `pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:black`
                ]);
            }
            else {
                // fill: 直接拉伸
                command = command.size(`${targetWidth}x${targetHeight}`);
            }
        }
        // 添加字幕
        if (options.subtitle && options.subtitle.text) {
            const sub = options.subtitle;
            const fontSize = sub.fontSize || 48;
            const fontColor = sub.fontColor || 'white';
            const bgColor = sub.backgroundColor || 'black@0.5';
            // 计算字幕位置
            let yPosition = 'h-th-50'; // 底部
            if (sub.style === 'top') {
                yPosition = '50';
            }
            else if (sub.style === 'center') {
                yPosition = '(h-th)/2';
            }
            // 转义特殊字符
            const escapedText = sub.text
                .replace(/'/g, "\\'")
                .replace(/:/g, '\\:')
                .replace(/\\/g, '\\\\');
            command = command.videoFilters([
                `drawtext=text='${escapedText}':fontsize=${fontSize}:fontcolor=${fontColor}:box=1:boxcolor=${bgColor}:boxborderw=10:x=(w-tw)/2:y=${yPosition}`
            ]);
        }
        // 输出设置
        command
            .outputOptions([
            '-c:v libx264',
            '-preset fast',
            '-crf 23',
            '-c:a aac',
            '-b:a 128k',
            '-movflags +faststart'
        ])
            .on('progress', (progress) => {
            if (progress.percent) {
                onProgress(Math.min(Math.round(progress.percent), 99));
            }
            else if (totalDuration > 0 && progress.timemark) {
                const currentTime = parseTimemark(progress.timemark);
                onProgress(Math.min(Math.round((currentTime / totalDuration) * 100), 99));
            }
        })
            .on('end', () => {
            resolve();
        })
            .on('error', (err) => {
            reject(err);
        })
            .save(outputPath);
    });
}
// 计算时长（从 HH:MM:SS 格式）
function calculateDuration(start, end) {
    return parseTimemark(end) - parseTimemark(start);
}
// 解析时间标记
function parseTimemark(timemark) {
    const parts = timemark.split(':');
    if (parts.length === 3) {
        const hours = parseInt(parts[0], 10);
        const minutes = parseInt(parts[1], 10);
        const seconds = parseFloat(parts[2]);
        return hours * 3600 + minutes * 60 + seconds;
    }
    return parseFloat(timemark) || 0;
}
// 删除视频
function deleteVideo(id) {
    const video = videos.get(id);
    if (!video)
        return false;
    const filePath = path_1.default.join(UPLOAD_PATH, video.filePath);
    if (fs_1.default.existsSync(filePath)) {
        fs_1.default.unlinkSync(filePath);
    }
    videos.delete(id);
    return true;
}
// 删除任务
function deleteJob(id) {
    const job = jobs.get(id);
    if (!job)
        return false;
    if (job.outputPath) {
        const outputFilePath = path_1.default.join(UPLOAD_PATH, job.outputPath);
        if (fs_1.default.existsSync(outputFilePath)) {
            fs_1.default.unlinkSync(outputFilePath);
        }
    }
    jobs.delete(id);
    return true;
}
// AI 任务相关（使用扩展类型）
const aiJobs = new Map();
// 初始化处理步骤
function initializeSteps() {
    return video_editor_types_1.PROCESSING_STEPS.map(({ step, name }) => ({
        step,
        name,
        status: 'pending',
        progress: 0,
    }));
}
// 创建 AI 处理任务
async function createAiJob(jobId, video, userPrompt) {
    const job = {
        id: jobId,
        videoId: video.id,
        originalVideo: video,
        options: {},
        status: 'pending',
        progress: 0,
        userPrompt,
        steps: initializeSteps(),
        createdAt: new Date(),
        updatedAt: new Date(),
    };
    aiJobs.set(jobId, job);
    jobs.set(jobId, job); // 同时添加到普通 jobs 中
    return job;
}
// 更新 AI 任务某一步骤的状态
function updateAiJobStep(jobId, step, stepStatus, message, stepProgress) {
    const job = aiJobs.get(jobId);
    if (!job) {
        console.warn(`AI Job not found: ${jobId}`);
        return;
    }
    const stepInfo = job.steps.find(s => s.step === step);
    if (!stepInfo) {
        console.warn(`Step not found: ${step}`);
        return;
    }
    stepInfo.status = stepStatus;
    stepInfo.message = message;
    if (stepStatus === 'in_progress') {
        stepInfo.startedAt = new Date();
        stepInfo.progress = stepProgress || 0;
        job.currentStep = step;
        job.status = 'processing';
    }
    else if (stepStatus === 'completed') {
        stepInfo.completedAt = new Date();
        stepInfo.progress = 100;
    }
    else if (stepStatus === 'failed') {
        stepInfo.progress = 0;
        job.status = 'failed';
        job.error = message;
    }
    // 计算总体进度
    const completedSteps = job.steps.filter(s => s.status === 'completed').length;
    const totalSteps = job.steps.length;
    job.progress = Math.round((completedSteps / totalSteps) * 100);
    job.updatedAt = new Date();
    jobs.set(jobId, job);
}
// 更新 AI 任务整体状态（向后兼容）
function updateAiJobStatus(jobId, status, message, outputPath, analysis, params, transcript) {
    const job = aiJobs.get(jobId);
    if (!job) {
        console.warn(`AI Job not found: ${jobId}`);
        return;
    }
    job.status = status;
    job.updatedAt = new Date();
    if (status === 'processing') {
        job.progress = 50;
    }
    else if (status === 'completed') {
        job.progress = 100;
        // 标记所有步骤为完成
        job.steps.forEach(step => {
            step.status = 'completed';
            step.progress = 100;
        });
        if (outputPath)
            job.outputPath = outputPath;
        if (analysis)
            job.aiAnalysis = analysis;
        if (params) {
            job.aiParams = params;
            job.options = params;
        }
    }
    else if (status === 'failed') {
        job.error = message;
    }
    if (transcript) {
        job.transcript = transcript;
    }
    // 同步到普通 jobs
    jobs.set(jobId, job);
}
// 获取 AI 任务
function getAiJob(id) {
    return aiJobs.get(id);
}
// 获取所有 AI 任务
function getAllAiJobs() {
    return Array.from(aiJobs.values()).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
// 初始化
ensureDirectories();
//# sourceMappingURL=video-editor.service.js.map