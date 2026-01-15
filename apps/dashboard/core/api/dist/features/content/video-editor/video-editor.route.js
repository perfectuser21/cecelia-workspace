"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const multer_1 = __importDefault(require("multer"));
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const uuid_1 = require("uuid");
const child_process_1 = require("child_process");
const videoEditorService = __importStar(require("./video-editor.service"));
// 脚本路径
const SCRIPTS_PATH = process.env.VIDEO_EDITOR_SCRIPTS_PATH || '/home/xx/dev/zenithjoy-autopilot/features/content/video-editor/scripts';
const N8N_WEBHOOK_URL = process.env.N8N_VIDEO_EDIT_WEBHOOK_URL || 'http://n8n-self-hosted:5678/webhook/video-ai-edit';
// 宿主机数据路径（用于 n8n SSH 执行脚本时访问文件）
const HOST_DATA_PATH = process.env.HOST_DATA_PATH || '/home/xx/dev/zenithjoy-autopilot/apps/dashboard/data/uploads';
const router = (0, express_1.Router)();
const UPLOAD_PATH = process.env.UPLOAD_PATH || 'data/uploads';
const TEMP_DIR = path_1.default.join(UPLOAD_PATH, 'temp');
// 确保临时目录存在
if (!fs_1.default.existsSync(TEMP_DIR)) {
    fs_1.default.mkdirSync(TEMP_DIR, { recursive: true });
}
// Multer 配置
const storage = multer_1.default.diskStorage({
    destination: (_req, _file, cb) => {
        cb(null, TEMP_DIR);
    },
    filename: (_req, file, cb) => {
        const ext = path_1.default.extname(file.originalname);
        cb(null, `${(0, uuid_1.v4)()}${ext}`);
    },
});
const fileFilter = (_req, file, cb) => {
    const allowedMimeTypes = [
        'video/mp4',
        'video/quicktime',
        'video/webm',
        'video/x-msvideo',
        'video/x-matroska',
    ];
    if (allowedMimeTypes.includes(file.mimetype)) {
        cb(null, true);
    }
    else {
        cb(new Error('Only video files are allowed (MP4, MOV, WebM, AVI, MKV)'));
    }
};
const upload = (0, multer_1.default)({
    storage,
    fileFilter,
    limits: {
        fileSize: 2 * 1024 * 1024 * 1024, // 2GB
    },
});
// POST /v1/video-editor/upload - 上传视频
router.post('/upload', upload.single('video'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No video file provided' });
        }
        const video = await videoEditorService.saveVideo(req.file.path, req.file.originalname, req.file.mimetype, req.file.size);
        res.json({
            success: true,
            video,
        });
    }
    catch (error) {
        console.error('Upload error:', error);
        res.status(500).json({ error: error.message || 'Upload failed' });
    }
});
// GET /v1/video-editor/videos - 获取所有视频
router.get('/videos', (_req, res) => {
    const videos = videoEditorService.getAllVideos();
    res.json(videos);
});
// GET /v1/video-editor/videos/:id - 获取视频信息
router.get('/videos/:id', (req, res) => {
    const video = videoEditorService.getVideo(req.params.id);
    if (!video) {
        return res.status(404).json({ error: 'Video not found' });
    }
    res.json(video);
});
// DELETE /v1/video-editor/videos/:id - 删除视频
router.delete('/videos/:id', (req, res) => {
    const deleted = videoEditorService.deleteVideo(req.params.id);
    if (!deleted) {
        return res.status(404).json({ error: 'Video not found' });
    }
    res.json({ success: true });
});
// POST /v1/video-editor/process - 创建处理任务
router.post('/process', async (req, res) => {
    try {
        const { videoId, options } = req.body;
        if (!videoId) {
            return res.status(400).json({ error: 'videoId is required' });
        }
        const job = await videoEditorService.createJob(videoId, options || {});
        res.json({
            success: true,
            job: {
                id: job.id,
                status: job.status,
                progress: job.progress,
            },
        });
    }
    catch (error) {
        console.error('Process error:', error);
        res.status(500).json({ error: error.message || 'Failed to create job' });
    }
});
// GET /v1/video-editor/jobs - 获取所有任务
router.get('/jobs', (_req, res) => {
    const jobs = videoEditorService.getAllJobs();
    res.json(jobs);
});
// GET /v1/video-editor/jobs/:id - 获取任务状态
router.get('/jobs/:id', (req, res) => {
    // 先尝试获取 AI Job（包含步骤信息）
    const aiJob = videoEditorService.getAiJob(req.params.id);
    if (aiJob) {
        return res.json({
            id: aiJob.id,
            status: aiJob.status,
            progress: aiJob.progress,
            outputPath: aiJob.outputPath,
            error: aiJob.error,
            options: aiJob.options,
            originalVideo: aiJob.originalVideo,
            userPrompt: aiJob.userPrompt,
            aiAnalysis: aiJob.aiAnalysis,
            transcript: aiJob.transcript,
            steps: aiJob.steps,
            currentStep: aiJob.currentStep,
            createdAt: aiJob.createdAt,
            updatedAt: aiJob.updatedAt,
        });
    }
    // 否则获取普通 job
    const job = videoEditorService.getJob(req.params.id);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json({
        id: job.id,
        status: job.status,
        progress: job.progress,
        outputPath: job.outputPath,
        error: job.error,
        options: job.options,
        originalVideo: job.originalVideo,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt,
    });
});
// DELETE /v1/video-editor/jobs/:id - 删除任务
router.delete('/jobs/:id', (req, res) => {
    const deleted = videoEditorService.deleteJob(req.params.id);
    if (!deleted) {
        return res.status(404).json({ error: 'Job not found' });
    }
    res.json({ success: true });
});
// GET /v1/video-editor/download/:jobId - 下载处理后的视频
router.get('/download/:jobId', (req, res) => {
    const job = videoEditorService.getJob(req.params.jobId);
    if (!job) {
        return res.status(404).json({ error: 'Job not found' });
    }
    if (job.status !== 'completed' || !job.outputPath) {
        return res.status(400).json({ error: 'Video not ready for download' });
    }
    const filePath = path_1.default.join(UPLOAD_PATH, job.outputPath);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({ error: 'Output file not found' });
    }
    const originalName = job.originalVideo.originalName;
    const ext = path_1.default.extname(originalName);
    const baseName = path_1.default.basename(originalName, ext);
    const downloadName = `${baseName}_processed.mp4`;
    res.download(filePath, downloadName);
});
// GET /v1/video-editor/preview/* - 预览视频文件
router.get('/preview/*', (req, res) => {
    const relativePath = req.params[0];
    const filePath = path_1.default.join(UPLOAD_PATH, relativePath);
    if (!fs_1.default.existsSync(filePath)) {
        return res.status(404).json({ error: 'File not found' });
    }
    res.sendFile(path_1.default.resolve(filePath));
});
// POST /v1/video-editor/transcribe - 独立的 Whisper 转录端点
router.post('/transcribe', async (req, res) => {
    try {
        const { videoId } = req.body;
        if (!videoId) {
            return res.status(400).json({ error: 'videoId is required' });
        }
        // 获取视频信息
        const video = videoEditorService.getVideo(videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        // 如果已有转录结果，直接返回
        if (video.transcript) {
            console.log(`[Video Editor] Using cached transcript for video ${videoId}`);
            return res.json({
                success: true,
                cached: true,
                transcript: video.transcript,
            });
        }
        // 使用宿主机路径
        const videoPath = path_1.default.join(HOST_DATA_PATH, video.filePath);
        console.log(`[Video Editor] Starting Whisper transcription for video ${videoId}`);
        console.log(`[Video Editor] Video path: ${videoPath}`);
        // 通过 SSH 在宿主机上执行 transcribe.py
        const sshHost = process.env.SSH_HOST || '146.190.52.84';
        const sshUser = process.env.SSH_USER || 'xx';
        const sshKey = process.env.SSH_KEY_PATH || '/app/ssh/id_rsa';
        const transcribeScript = path_1.default.join(SCRIPTS_PATH, 'transcribe.py');
        const escapeArg = (arg) => arg.replace(/"/g, '\\"');
        const sshCommand = `ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=30 -i ${sshKey} ${sshUser}@${sshHost} "python3 ${transcribeScript} --video \\"${escapeArg(videoPath)}\\" --model base --language zh"`;
        return new Promise((resolve) => {
            const child = (0, child_process_1.spawn)('sh', ['-c', sshCommand], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
                console.log(`[Video Editor] Whisper stderr: ${data}`);
            });
            child.on('close', (code) => {
                console.log(`[Video Editor] Whisper exited with code ${code}`);
                if (code !== 0) {
                    res.status(500).json({ error: `Transcription failed: ${stderr}` });
                    resolve();
                    return;
                }
                try {
                    const trimmedOutput = stdout.trim();
                    if (!trimmedOutput) {
                        res.status(500).json({ error: 'No output from transcription', raw: stdout });
                        resolve();
                        return;
                    }
                    const whisperResult = JSON.parse(trimmedOutput);
                    // 检查是否有错误
                    if (whisperResult.error) {
                        res.status(500).json({ error: `Whisper error: ${whisperResult.error}` });
                        resolve();
                        return;
                    }
                    // 构建 TranscriptResult
                    const transcriptResult = {
                        segments: whisperResult.segments || [],
                        fullText: whisperResult.full_text || '',
                        language: whisperResult.language || 'zh',
                        languageProbability: whisperResult.language_probability,
                        duration: whisperResult.duration,
                    };
                    // 保存到视频记录
                    videoEditorService.updateVideoTranscript(videoId, transcriptResult);
                    console.log(`[Video Editor] Transcription completed: ${transcriptResult.segments.length} segments`);
                    res.json({
                        success: true,
                        cached: false,
                        transcript: transcriptResult,
                    });
                }
                catch (parseError) {
                    console.error('Parse error:', parseError);
                    res.status(500).json({ error: 'Failed to parse transcription result', raw: stdout });
                }
                resolve();
            });
            child.on('error', (err) => {
                console.error(`[Video Editor] SSH error: ${err.message}`);
                res.status(500).json({ error: `SSH error: ${err.message}` });
                resolve();
            });
        });
    }
    catch (error) {
        console.error('Transcribe error:', error);
        res.status(500).json({ error: error.message || 'Transcription failed' });
    }
});
// POST /v1/video-editor/ai-process - AI 智能处理（触发 n8n + Headless Claude）
// 接受可选的 analysisParams 参数，如果提供则跳过 Whisper 和 AI 分析
router.post('/ai-process', async (req, res) => {
    try {
        const { videoId, userPrompt, analysisParams } = req.body;
        if (!videoId) {
            return res.status(400).json({ error: 'videoId is required' });
        }
        if (!userPrompt) {
            return res.status(400).json({ error: 'userPrompt is required' });
        }
        // 获取视频信息
        const video = videoEditorService.getVideo(videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        // 创建任务
        const jobId = (0, uuid_1.v4)();
        // 使用宿主机路径（n8n 通过 SSH 在宿主机上执行脚本）
        const videoPath = path_1.default.join(HOST_DATA_PATH, video.filePath);
        const outputFileName = `${jobId}.mp4`;
        const outputPath = path_1.default.join(HOST_DATA_PATH, 'processed', outputFileName);
        // 确保输出目录存在
        const outputDir = path_1.default.dirname(outputPath);
        if (!fs_1.default.existsSync(outputDir)) {
            fs_1.default.mkdirSync(outputDir, { recursive: true });
        }
        // 回调 URL（使用 localhost:3333 因为脚本在宿主机上执行）
        const callbackUrl = `http://localhost:3333/v1/video-editor/ai-callback`;
        // 创建内部 job 记录
        const job = await videoEditorService.createAiJob(jobId, video, userPrompt);
        // 通过 SSH 在宿主机上执行处理脚本
        console.log(`[Video Editor] Starting processing for job ${jobId}`);
        console.log(`[Video Editor] Video: ${videoPath}`);
        console.log(`[Video Editor] Output: ${outputPath}`);
        console.log(`[Video Editor] Prompt: ${userPrompt}`);
        if (analysisParams) {
            console.log(`[Video Editor] Using pre-computed analysis params, skipping Whisper and AI analysis`);
        }
        // 使用 SSH 连接到宿主机执行 trigger.sh
        const sshHost = process.env.SSH_HOST || '146.190.52.84';
        const sshUser = process.env.SSH_USER || 'xx';
        const sshKey = process.env.SSH_KEY_PATH || '/app/ssh/id_rsa';
        const triggerScript = path_1.default.join(SCRIPTS_PATH, 'trigger.sh');
        // 转义参数中的特殊字符
        const escapeArg = (arg) => arg.replace(/"/g, '\\"');
        // 构建分析参数 JSON（如果提供）
        const analysisJson = analysisParams ? JSON.stringify(analysisParams).replace(/"/g, '\\"') : '';
        const sshCommand = `ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=10 -i ${sshKey} ${sshUser}@${sshHost} "${triggerScript} \\"${escapeArg(videoPath)}\\" \\"${escapeArg(outputPath)}\\" \\"${escapeArg(userPrompt)}\\" \\"${escapeArg(callbackUrl)}\\" \\"${escapeArg(jobId)}\\" \\"${analysisJson}\\""`;
        console.log(`[Video Editor] SSH command: ${sshCommand.substring(0, 200)}...`);
        const child = (0, child_process_1.spawn)('sh', ['-c', sshCommand], {
            detached: true,
            stdio: ['ignore', 'pipe', 'pipe'],
        });
        child.stdout?.on('data', (data) => {
            console.log(`[Video Editor] SSH stdout: ${data}`);
        });
        child.stderr?.on('data', (data) => {
            console.error(`[Video Editor] SSH stderr: ${data}`);
        });
        child.on('error', (err) => {
            console.error(`[Video Editor] SSH error: ${err.message}`);
            videoEditorService.updateAiJobStatus(jobId, 'failed', `SSH error: ${err.message}`);
        });
        child.on('close', (code) => {
            console.log(`[Video Editor] SSH process exited with code ${code}`);
            if (code !== 0) {
                videoEditorService.updateAiJobStatus(jobId, 'failed', `SSH exited with code ${code}`);
            }
        });
        child.unref();
        console.log(`[Video Editor] SSH process started`);
        res.json({
            success: true,
            job: {
                id: job.id,
                status: job.status,
                message: 'AI processing started',
            },
        });
    }
    catch (error) {
        console.error('AI process error:', error);
        res.status(500).json({ error: error.message || 'Failed to start AI processing' });
    }
});
// POST /v1/video-editor/ai-callback - AI 处理回调（n8n 调用）
router.post('/ai-callback', async (req, res) => {
    try {
        const { jobId, status, message, outputPath, analysis, params, transcript } = req.body;
        if (!jobId) {
            return res.status(400).json({ error: 'jobId is required' });
        }
        console.log(`AI callback received: jobId=${jobId}, status=${status}`);
        // 更新任务状态
        if (status === 'completed' && outputPath) {
            // 提取相对路径（支持容器路径和宿主机路径）
            let relativePath = outputPath
                .replace(/^\/app\/data\/uploads\//, '') // 容器路径
                .replace(/^\/home\/xx\/dev\/zenithjoy-autopilot\/apps\/dashboard\/data\/uploads\//, ''); // 宿主机路径
            videoEditorService.updateAiJobStatus(jobId, 'completed', message, relativePath, analysis, params, transcript);
        }
        else if (status === 'failed') {
            videoEditorService.updateAiJobStatus(jobId, 'failed', message);
        }
        else {
            videoEditorService.updateAiJobStatus(jobId, status, message);
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error('AI callback error:', error);
        res.status(500).json({ error: error.message || 'Callback failed' });
    }
});
// POST /v1/video-editor/step-callback - 步骤状态回调（脚本调用）
router.post('/step-callback', async (req, res) => {
    try {
        const { jobId, step, status, message, progress } = req.body;
        if (!jobId || !step || !status) {
            return res.status(400).json({ error: 'jobId, step, and status are required' });
        }
        console.log(`Step callback received: jobId=${jobId}, step=${step}, status=${status}`);
        videoEditorService.updateAiJobStep(jobId, step, status, message, progress);
        res.json({ success: true });
    }
    catch (error) {
        console.error('Step callback error:', error);
        res.status(500).json({ error: error.message || 'Callback failed' });
    }
});
// POST /v1/video-editor/ai-analyze - AI 分析（只分析，不处理）
// 如果已有 transcript 则使用，否则先转录
router.post('/ai-analyze', async (req, res) => {
    try {
        const { videoId, userPrompt, transcript: providedTranscript } = req.body;
        if (!videoId) {
            return res.status(400).json({ error: 'videoId is required' });
        }
        if (!userPrompt) {
            return res.status(400).json({ error: 'userPrompt is required' });
        }
        // 获取视频信息
        const video = videoEditorService.getVideo(videoId);
        if (!video) {
            return res.status(404).json({ error: 'Video not found' });
        }
        // 使用宿主机路径
        const videoPath = path_1.default.join(HOST_DATA_PATH, video.filePath);
        console.log(`[Video Editor] Starting AI analysis for video ${videoId}`);
        console.log(`[Video Editor] Video: ${videoPath}`);
        console.log(`[Video Editor] Prompt: ${userPrompt}`);
        // 优先使用提供的 transcript，其次使用视频已保存的 transcript
        let transcriptForAnalysis = providedTranscript || video.transcript;
        // 构建带时间戳的转录文本（用于 AI 分析）
        let transcriptText = '';
        if (transcriptForAnalysis && transcriptForAnalysis.segments.length > 0) {
            transcriptText = transcriptForAnalysis.segments
                .slice(0, 20) // 只取前 20 个片段
                .map(seg => `[${seg.start.toFixed(1)}s - ${seg.end.toFixed(1)}s] ${seg.text}`)
                .join('\n');
            console.log(`[Video Editor] Using existing transcript (${transcriptForAnalysis.segments.length} segments)`);
        }
        else {
            console.log(`[Video Editor] No transcript available, AI will analyze without transcript`);
        }
        // 获取视频信息 JSON
        const videoInfo = JSON.stringify({
            duration: video.duration,
            width: video.width,
            height: video.height,
        });
        // 通过 SSH 在宿主机上执行 analyze.sh（直接调用，不经过 process.sh）
        const sshHost = process.env.SSH_HOST || '146.190.52.84';
        const sshUser = process.env.SSH_USER || 'xx';
        const sshKey = process.env.SSH_KEY_PATH || '/app/ssh/id_rsa';
        const analyzeScript = path_1.default.join(SCRIPTS_PATH, 'analyze.sh');
        const escapeArg = (arg) => arg.replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\$/g, '\\$');
        // 构建 analyze.sh 命令
        let sshCommand = `ssh -o StrictHostKeyChecking=no -o BatchMode=yes -o ConnectTimeout=120 -i ${sshKey} ${sshUser}@${sshHost} "${analyzeScript} --video-path \\"${escapeArg(videoPath)}\\" --user-prompt \\"${escapeArg(userPrompt)}\\" --video-info '${videoInfo}' --model sonnet`;
        // 如果有转录内容，添加到参数
        if (transcriptText) {
            sshCommand += ` --transcript \\"${escapeArg(transcriptText)}\\"`;
        }
        sshCommand += `"`;
        return new Promise((resolve) => {
            const child = (0, child_process_1.spawn)('sh', ['-c', sshCommand], {
                stdio: ['ignore', 'pipe', 'pipe'],
            });
            let stdout = '';
            let stderr = '';
            child.stdout?.on('data', (data) => {
                stdout += data.toString();
            });
            child.stderr?.on('data', (data) => {
                stderr += data.toString();
                console.log(`[Video Editor] AI analyze stderr: ${data}`);
            });
            child.on('close', (code) => {
                console.log(`[Video Editor] AI analyze exited with code ${code}`);
                if (code !== 0) {
                    res.status(500).json({ error: `Analysis failed: ${stderr}` });
                    resolve();
                    return;
                }
                // 解析 JSON 输出
                try {
                    const trimmedOutput = stdout.trim();
                    if (!trimmedOutput) {
                        res.status(500).json({ error: 'No output from analysis', raw: stdout });
                        resolve();
                        return;
                    }
                    const analysis = JSON.parse(trimmedOutput);
                    res.json({
                        success: true,
                        analysis: {
                            summary: analysis.analysis || analysis.summary,
                            params: analysis.params,
                        },
                        // 返回使用的 transcript（如果有）
                        transcript: transcriptForAnalysis,
                    });
                }
                catch (parseError) {
                    console.error('Parse error:', parseError);
                    res.status(500).json({ error: 'Failed to parse analysis', raw: stdout });
                }
                resolve();
            });
            child.on('error', (err) => {
                console.error(`[Video Editor] SSH error: ${err.message}`);
                res.status(500).json({ error: `SSH error: ${err.message}` });
                resolve();
            });
        });
    }
    catch (error) {
        console.error('AI analyze error:', error);
        res.status(500).json({ error: error.message || 'Analysis failed' });
    }
});
exports.default = router;
//# sourceMappingURL=video-editor.route.js.map