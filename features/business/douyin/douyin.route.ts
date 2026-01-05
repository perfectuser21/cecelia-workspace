import { Router, Request, Response } from 'express';
import axios from 'axios';
import logger from '../../../shared/utils/logger';

const router = Router();

// VPS API（通过 host.docker.internal 访问主机上的 VPS API 服务）
const VPS_API_HOST = process.env.VPS_API_HOST || 'host.docker.internal';
const VPS_API_BASE = `http://${VPS_API_HOST}:9876`;

// 获取抖音登录二维码 (支持 GET 和 POST)
const getQrCodeHandler = async (req: Request, res: Response) => {
  try {
    logger.info('Requesting Douyin QR code from VPS API...');

    const response = await axios.post(`${VPS_API_BASE}/douyin/qrcode`, {}, {
      timeout: 120000  // 2分钟超时
    });

    const data = response.data;

    if (data.success && data.qrcode_base64) {
      logger.info('Douyin QR code received successfully');
      res.json({
        success: true,
        qrcode: `data:image/png;base64,${data.qrcode_base64}`,
        message: data.message || '请使用抖音 APP 扫描二维码登录'
      });
    } else {
      logger.error('Failed to get Douyin QR code', { error: data.error });
      res.status(500).json({
        success: false,
        error: data.error || 'Failed to get QR code'
      });
    }
  } catch (error: any) {
    logger.error('Error getting Douyin QR code', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

router.get('/get-qrcode', getQrCodeHandler);
router.post('/get-qrcode', getQrCodeHandler);

// 检查抖音登录状态
router.get('/check-status', async (req: Request, res: Response) => {
  try {
    logger.info('Checking Douyin login status...');

    const response = await axios.get(`${VPS_API_BASE}/douyin/status`, {
      timeout: 30000
    });

    const data = response.data;
    logger.info('Douyin status response', { data });

    if (data.success) {
      res.json({
        success: true,
        status: data.status || 'pending',
        message: data.message || '请完成扫码登录',
        cookies_saved: data.cookies_saved || false
      });
    } else {
      res.json({
        success: true,
        status: 'pending',
        message: data.error || data.message || '请完成扫码登录'
      });
    }
  } catch (error: any) {
    logger.error('Error checking Douyin status', { error: error.message });
    res.json({
      success: true,
      status: 'pending',
      message: '正在检查登录状态...'
    });
  }
});

// 验证 Cookie 是否有效（在线验证）
router.get('/validate', async (req: Request, res: Response) => {
  try {
    logger.info('Validating Douyin cookies...');

    const response = await axios.get(`${VPS_API_BASE}/douyin/validate`, {
      timeout: 60000  // 1分钟超时
    });

    const data = response.data;
    logger.info('Douyin validate response', { data });

    res.json({
      success: data.success,
      valid: data.valid,
      status: data.status,
      message: data.message,
      nickname: data.nickname || null
    });
  } catch (error: any) {
    logger.error('Error validating Douyin cookies', { error: error.message });
    res.status(500).json({
      success: false,
      valid: false,
      status: 'error',
      error: error.message
    });
  }
});

// 手动上传 Cookie（从浏览器导出的 Cookie）
router.post('/upload-cookies', async (req: Request, res: Response) => {
  try {
    const { cookies } = req.body;

    if (!cookies) {
      return res.status(400).json({
        success: false,
        error: '请提供 cookies 数据'
      });
    }

    logger.info('Uploading Douyin cookies to VPS API...');

    const response = await axios.post(`${VPS_API_BASE}/douyin/upload-cookies`, {
      cookies
    }, {
      timeout: 30000
    });

    const data = response.data;
    logger.info('Douyin cookie upload response', { success: data.success });

    if (data.success) {
      res.json({
        success: true,
        message: data.message || 'Cookies 上传成功',
        cookies_count: data.cookies_count
      });
    } else {
      res.status(400).json({
        success: false,
        error: data.error || 'Cookie 上传失败'
      });
    }
  } catch (error: any) {
    logger.error('Error uploading Douyin cookies', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// 获取所有平台登录状态
router.get('/platforms-status', async (req: Request, res: Response) => {
  try {
    // 获取抖音状态（使用在线验证）
    let douyinStatus = 'unknown';
    let douyinNickname = null;
    try {
      // 先快速检查本地状态
      const statusResponse = await axios.get(`${VPS_API_BASE}/douyin/status`, {
        timeout: 5000
      });
      if (statusResponse.data.success && statusResponse.data.status) {
        douyinStatus = statusResponse.data.status;
      }
    } catch (e) {
      logger.warn('Failed to get Douyin status for platforms list');
    }

    const platforms = [
      {
        id: 'douyin',
        name: '抖音',
        icon: '🎵',
        status: douyinStatus,
        lastLogin: null,
        expiresAt: null
      },
      {
        id: 'xiaohongshu',
        name: '小红书',
        icon: '📕',
        status: 'unknown',
        lastLogin: null,
        expiresAt: null
      },
      {
        id: 'kuaishou',
        name: '快手',
        icon: '🎬',
        status: 'unknown',
        lastLogin: null,
        expiresAt: null
      },
      {
        id: 'bilibili',
        name: 'B站',
        icon: '📺',
        status: 'unknown',
        lastLogin: null,
        expiresAt: null
      }
    ];

    res.json({
      success: true,
      platforms
    });
  } catch (error: any) {
    logger.error('Error getting platforms status', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
