import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, CheckCircle, AlertCircle, ArrowLeft, QrCode, RefreshCw } from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

export default function DouyinLogin() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<'idle' | 'loading' | 'showing' | 'checking' | 'success' | 'error'>('loading');
  const [qrcodeUrl, setQrcodeUrl] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [countdown, setCountdown] = useState(300); // 5分钟倒计时

  // 页面加载时自动获取二维码
  useEffect(() => {
    handleGetQRCode();
  }, []);

  // 轮询检查登录状态
  const checkLoginStatus = useCallback(async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/douyin/check-status`, {
        timeout: 30000
      });

      if (response.data.success) {
        if (response.data.status === 'logged_in' || response.data.cookies_saved) {
          setStatus('success');
          setMessage('登录成功！Cookie 已保存');
          return true; // 登录成功，停止轮询
        }
      }
      return false; // 继续轮询
    } catch (err) {
      console.log('Status check failed, will retry...');
      return false;
    }
  }, []);

  // 轮询效果
  useEffect(() => {
    let pollInterval: NodeJS.Timeout;
    let countdownInterval: NodeJS.Timeout;

    if (status === 'showing' || status === 'checking') {
      // 每3秒检查一次登录状态
      pollInterval = setInterval(async () => {
        const loggedIn = await checkLoginStatus();
        if (loggedIn) {
          clearInterval(pollInterval);
          clearInterval(countdownInterval);
        }
      }, 3000);

      // 倒计时
      countdownInterval = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(pollInterval);
            clearInterval(countdownInterval);
            setStatus('error');
            setError('二维码已过期，请重新获取');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (pollInterval) clearInterval(pollInterval);
      if (countdownInterval) clearInterval(countdownInterval);
    };
  }, [status, checkLoginStatus]);

  const handleGetQRCode = async () => {
    try {
      setStatus('loading');
      setError('');
      setCountdown(300);

      const response = await axios.post(`${API_BASE}/api/douyin/get-qrcode`, {}, {
        timeout: 120000
      });

      if (response.data.success) {
        setQrcodeUrl(response.data.qrcode);
        setMessage(response.data.message || '请使用抖音 APP 扫描二维码');
        setStatus('showing');
      } else {
        throw new Error(response.data.error || '获取二维码失败');
      }
    } catch (err: any) {
      console.error('Failed to get QR code:', err);
      setError(err.message || '获取二维码失败，请重试');
      setStatus('error');
    }
  };

  const handleRefreshQRCode = () => {
    setQrcodeUrl(null);
    handleGetQRCode();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-black flex flex-col items-center justify-center px-4">
      <div className="max-w-md w-full bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/20">
        {/* 返回按钮 */}
        <button
          onClick={() => navigate('/accounts')}
          className="flex items-center text-gray-300 hover:text-white mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          返回账号管理
        </button>

        {/* 标题 */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-black rounded-2xl mb-4 shadow-lg">
            <span className="text-2xl">🎵</span>
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">
            抖音账号登录
          </h2>
          <p className="text-gray-400">
            扫描二维码完成登录
          </p>
        </div>

        {/* 状态显示 */}
        <div className="mb-6">
          {status === 'idle' && (
            <div className="text-center">
              <div className="bg-white/5 rounded-xl p-6 mb-6 border border-white/10">
                <QrCode className="w-24 h-24 mx-auto text-gray-500 mb-4" />
                <p className="text-gray-400 text-sm">
                  点击下方按钮获取登录二维码
                </p>
              </div>
              <button
                onClick={handleGetQRCode}
                className="w-full inline-flex justify-center items-center px-6 py-3 text-base font-medium rounded-xl text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 shadow-lg shadow-pink-500/25 transition-all"
              >
                获取登录二维码
              </button>
            </div>
          )}

          {status === 'loading' && (
            <div className="text-center">
              <div className="bg-white/5 rounded-xl p-8 border border-white/10">
                <Loader2 className="w-16 h-16 animate-spin text-pink-500 mx-auto mb-4" />
                <p className="text-gray-300">正在获取二维码...</p>
                <p className="text-gray-500 text-sm mt-2">这可能需要几秒钟</p>
              </div>
            </div>
          )}

          {(status === 'showing' || status === 'checking') && qrcodeUrl && (
            <div className="text-center">
              {/* 二维码显示 */}
              <div className="relative bg-white rounded-xl p-6 mb-4 inline-block shadow-xl">
                <img
                  src={qrcodeUrl}
                  alt="抖音登录二维码"
                  className="w-80 h-80 object-contain"
                />
                {/* 倒计时覆盖层 */}
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded">
                  {formatTime(countdown)}
                </div>
              </div>

              {/* 状态指示 */}
              <div className="flex items-center justify-center gap-2 mb-4">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-green-400 text-sm">正在等待扫码...</span>
              </div>

              {/* 提示信息 */}
              <div className="bg-gradient-to-r from-pink-500/10 to-rose-500/10 border border-pink-500/20 rounded-xl p-4 mb-4">
                <p className="text-pink-300 font-medium mb-2">
                  {message}
                </p>
                <div className="text-left space-y-1 text-sm text-gray-400">
                  <p>1. 打开抖音 APP</p>
                  <p>2. 点击右下角「我」</p>
                  <p>3. 点击右上角「≡」菜单</p>
                  <p>4. 选择「扫一扫」扫描此二维码</p>
                </div>
              </div>

              {/* 刷新按钮 */}
              <button
                onClick={handleRefreshQRCode}
                className="inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg text-gray-300 bg-white/5 hover:bg-white/10 border border-white/10 transition-all"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                刷新二维码
              </button>
            </div>
          )}

          {status === 'success' && (
            <div className="text-center">
              <div className="bg-green-500/10 rounded-xl p-8 border border-green-500/20">
                <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
                <p className="text-green-400 font-medium mb-2">
                  {message || '登录成功！'}
                </p>
                <p className="text-gray-400 text-sm">
                  Cookie 已保存到服务器
                </p>
              </div>
              <button
                onClick={() => navigate('/accounts')}
                className="mt-6 w-full inline-flex justify-center items-center px-6 py-3 text-base font-medium rounded-xl text-white bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 transition-all"
              >
                返回账号管理
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center">
              <div className="bg-red-500/10 rounded-xl p-8 border border-red-500/20 mb-4">
                <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                <p className="text-red-400 font-medium mb-2">
                  获取二维码失败
                </p>
                <p className="text-gray-400 text-sm">
                  {error}
                </p>
              </div>
              <button
                onClick={handleGetQRCode}
                className="w-full inline-flex justify-center items-center px-6 py-3 text-base font-medium rounded-xl text-white bg-gradient-to-r from-pink-500 to-rose-500 hover:from-pink-600 hover:to-rose-600 transition-all"
              >
                重新尝试
              </button>
            </div>
          )}
        </div>

        {/* 底部提示 */}
        <div className="mt-8 pt-6 border-t border-white/10">
          <h4 className="text-sm font-medium text-gray-300 mb-2">注意事项：</h4>
          <ul className="text-xs text-gray-500 space-y-1">
            <li>• 二维码有效期约 5 分钟，过期请刷新</li>
            <li>• 扫码成功后会自动检测并保存 Cookie</li>
            <li>• 系统会定期检查登录状态</li>
            <li>• 如登录失效，会收到通知</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
