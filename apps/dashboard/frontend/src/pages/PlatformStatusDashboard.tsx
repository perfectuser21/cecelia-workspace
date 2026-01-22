import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  XCircle,
  AlertCircle,
  RefreshCw,
  ExternalLink,
  Clock,
  Shield,
} from 'lucide-react';
import axios from 'axios';

const API_BASE = import.meta.env.VITE_API_URL || '';

interface Platform {
  id: string;
  name: string;
  icon: string;
  status: 'logged_in' | 'expired' | 'unknown';
  lastLogin: string | null;
  expiresAt: string | null;
  loginPath: string;
  color: string;
}

const PLATFORM_CONFIG: Record<string, { loginPath: string; color: string }> = {
  douyin: { loginPath: '/douyin-login', color: 'from-pink-500 to-rose-500' },
  xiaohongshu: { loginPath: '/xiaohongshu-login', color: 'from-red-500 to-orange-500' },
  kuaishou: { loginPath: '/kuaishou-login', color: 'from-orange-500 to-yellow-500' },
  bilibili: { loginPath: '/bilibili-login', color: 'from-blue-500 to-cyan-500' },
};

export default function PlatformLogin() {
  const navigate = useNavigate();
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [validating, setValidating] = useState<string | null>(null);

  const fetchPlatformsStatus = async () => {
    try {
      const response = await axios.get(`${API_BASE}/api/douyin/platforms-status`);
      if (response.data.success) {
        const platformsWithConfig = response.data.platforms.map((p: any) => ({
          ...p,
          loginPath: PLATFORM_CONFIG[p.id]?.loginPath || '#',
          color: PLATFORM_CONFIG[p.id]?.color || 'from-gray-500 to-gray-600',
        }));
        setPlatforms(platformsWithConfig);
      }
    } catch (error) {
      console.error('Failed to fetch platforms status:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchPlatformsStatus();
  }, []);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchPlatformsStatus();
  };

  const handleValidate = async (platformId: string) => {
    if (platformId !== 'douyin') return; // 目前只支持抖音

    setValidating(platformId);
    try {
      const response = await axios.get(`${API_BASE}/api/douyin/validate`, {
        timeout: 90000,
      });

      if (response.data.success) {
        // 更新平台状态
        setPlatforms(prev =>
          prev.map(p => {
            if (p.id === platformId) {
              return {
                ...p,
                status: response.data.valid ? 'logged_in' : 'expired',
              };
            }
            return p;
          })
        );

        if (response.data.valid) {
          alert(`Cookie 有效${response.data.nickname ? `，用户: ${response.data.nickname}` : ''}`);
        } else {
          alert(`Cookie 已过期: ${response.data.message}`);
        }
      }
    } catch (error: any) {
      console.error('Validate failed:', error);
      alert('验证失败: ' + (error.message || '请稍后重试'));
    } finally {
      setValidating(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'logged_in':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
            <CheckCircle className="w-3 h-3" />
            已登录
          </span>
        );
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
            <XCircle className="w-3 h-3" />
            已过期
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
            <AlertCircle className="w-3 h-3" />
            未登录
          </span>
        );
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <RefreshCw className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      {/* 页面标题 */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">平台登录管理</h1>
          <p className="text-gray-500 mt-1">管理各平台的登录状态和 Cookie</p>
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          刷新状态
        </button>
      </div>

      {/* 平台卡片网格 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {platforms.map(platform => (
          <div
            key={platform.id}
            className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow"
          >
            {/* 卡片头部 */}
            <div className={`bg-gradient-to-r ${platform.color} p-4`}>
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-2xl">{platform.icon}</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-semibold text-white">{platform.name}</h3>
                  <div className="mt-1">{getStatusBadge(platform.status)}</div>
                </div>
              </div>
            </div>

            {/* 卡片内容 */}
            <div className="p-4 space-y-4">
              {/* 登录信息 */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-gray-500">
                  <Clock className="w-4 h-4" />
                  <span>上次登录</span>
                </div>
                <div className="text-gray-900 font-medium">{formatDate(platform.lastLogin)}</div>

                <div className="flex items-center gap-2 text-gray-500">
                  <Shield className="w-4 h-4" />
                  <span>过期时间</span>
                </div>
                <div className="text-gray-900 font-medium">{formatDate(platform.expiresAt)}</div>
              </div>

              {/* 操作按钮 */}
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => navigate(platform.loginPath)}
                  className={`flex-1 inline-flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-medium text-white rounded-lg bg-gradient-to-r ${platform.color} hover:opacity-90 transition-opacity`}
                >
                  {platform.status === 'logged_in' ? '重新登录' : '立即登录'}
                  <ExternalLink className="w-4 h-4" />
                </button>
                {platform.id === 'douyin' && (
                  <button
                    onClick={() => handleValidate(platform.id)}
                    disabled={validating === platform.id}
                    className="inline-flex justify-center items-center gap-2 px-4 py-2.5 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-50 transition-colors"
                  >
                    {validating === platform.id ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        验证中
                      </>
                    ) : (
                      <>
                        <Shield className="w-4 h-4" />
                        验证
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* 底部说明 */}
      <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-xl">
        <h4 className="font-medium text-blue-900 mb-2">提示</h4>
        <ul className="text-sm text-blue-700 space-y-1">
          <li>• 各平台 Cookie 有效期不同，建议定期检查登录状态</li>
          <li>• 登录成功后，系统会自动保存 Cookie 到服务器</li>
          <li>• 如 Cookie 过期，相关的数据采集和发布功能将无法使用</li>
          <li>• 系统会在 Cookie 即将过期时发送通知提醒</li>
        </ul>
      </div>
    </div>
  );
}
