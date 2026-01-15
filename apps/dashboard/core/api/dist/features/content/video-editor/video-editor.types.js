"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PRESET_DIMENSIONS = exports.PROCESSING_STEPS = void 0;
exports.PROCESSING_STEPS = [
    { step: 'whisper', name: '语音识别' },
    { step: 'ai_analysis', name: 'AI 分析' },
    { step: 'ffmpeg_prepare', name: '准备处理' },
    { step: 'ffmpeg_execute', name: '视频处理' },
];
// 预设尺寸映射
exports.PRESET_DIMENSIONS = {
    '9:16': { width: 1080, height: 1920 }, // 抖音/TikTok
    '16:9': { width: 1920, height: 1080 }, // YouTube
    '1:1': { width: 1080, height: 1080 }, // Instagram
    '4:3': { width: 1440, height: 1080 }, // 传统
    '3:4': { width: 1080, height: 1440 }, // 小红书
};
//# sourceMappingURL=video-editor.types.js.map