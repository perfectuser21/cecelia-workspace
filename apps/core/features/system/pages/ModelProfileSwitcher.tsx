import { useState, useCallback } from 'react';
import { Brain, Cpu, Zap, Check, Loader, RefreshCw } from 'lucide-react';
import { useApiFn } from '../../shared/hooks/useApi';
import { useWebSocket } from '../../shared/hooks/useWebSocket';
import Toast, { ToastType } from '../components/Toast';
import {
  ModelProfile,
  fetchModelProfiles,
  switchProfile,
} from '../api/model-profile.api';

function getProviderColor(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'text-purple-400';
    case 'minimax':
      return 'text-emerald-400';
    case 'openai':
      return 'text-blue-400';
    default:
      return 'text-gray-400';
  }
}

function getProviderBadgeBg(provider: string): string {
  switch (provider) {
    case 'anthropic':
      return 'bg-purple-500/20 border-purple-500/30';
    case 'minimax':
      return 'bg-emerald-500/20 border-emerald-500/30';
    case 'openai':
      return 'bg-blue-500/20 border-blue-500/30';
    default:
      return 'bg-gray-500/20 border-gray-500/30';
  }
}

function getModelShortName(model: string): string {
  if (model.includes('opus')) return 'Opus';
  if (model.includes('sonnet')) return 'Sonnet';
  if (model.includes('haiku')) return 'Haiku';
  if (model.includes('M2.1')) return 'M2.1';
  if (model.includes('M2.5')) return 'M2.5';
  return model;
}

function getExecutorModel(profile: ModelProfile): string {
  const { executor } = profile.config;
  const provider = executor.default_provider;
  const devMap = executor.model_map?.dev;
  if (devMap) {
    const model = devMap[provider];
    if (model) return model;
  }
  return provider === 'anthropic' ? 'claude-sonnet-4-20250514' : 'MiniMax-M2.5-highspeed';
}

interface ProfileCardProps {
  profile: ModelProfile;
  switching: boolean;
  onSwitch: (id: string) => void;
}

function ProfileCard({ profile, switching, onSwitch }: ProfileCardProps) {
  const { thalamus, cortex } = profile.config;
  const executorModel = getExecutorModel(profile);
  const executorProvider = profile.config.executor.default_provider;

  const layers = [
    { label: 'L1 丘脑', icon: Zap, ...thalamus },
    { label: 'L2 皮层', icon: Brain, ...cortex },
    { label: '执行层', icon: Cpu, provider: executorProvider, model: executorModel },
  ];

  return (
    <div
      className={`relative rounded-xl border p-6 transition-all duration-200 ${
        profile.is_active
          ? 'border-blue-500/50 bg-blue-500/5 shadow-lg shadow-blue-500/10'
          : 'border-white/10 bg-white/5 hover:border-white/20 hover:bg-white/[0.07]'
      }`}
    >
      {profile.is_active && (
        <div className="absolute top-3 right-3 flex items-center gap-1.5 text-xs text-blue-400 font-medium">
          <Check className="w-3.5 h-3.5" />
          当前激活
        </div>
      )}

      <h3 className="text-lg font-semibold text-white mb-1">{profile.name}</h3>
      <p className="text-xs text-gray-500 mb-4 font-mono">{profile.id}</p>

      <div className="space-y-3">
        {layers.map((layer) => {
          const Icon = layer.icon;
          return (
            <div key={layer.label} className="flex items-center gap-3">
              <Icon className={`w-4 h-4 flex-shrink-0 ${getProviderColor(layer.provider)}`} />
              <span className="text-sm text-gray-400 w-16 flex-shrink-0">{layer.label}</span>
              <span
                className={`text-xs px-2 py-0.5 rounded-full border ${getProviderBadgeBg(layer.provider)}`}
              >
                <span className={getProviderColor(layer.provider)}>{layer.provider}</span>
              </span>
              <span className="text-sm text-white font-mono">{getModelShortName(layer.model)}</span>
            </div>
          );
        })}
      </div>

      {!profile.is_active && (
        <button
          onClick={() => onSwitch(profile.id)}
          disabled={switching}
          className="mt-5 w-full py-2 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          {switching ? (
            <>
              <Loader className="w-4 h-4 animate-spin" />
              切换中...
            </>
          ) : (
            '切换到此 Profile'
          )}
        </button>
      )}
    </div>
  );
}

export default function ModelProfileSwitcher() {
  const [switching, setSwitching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const {
    data: profiles,
    loading,
    error,
    refresh,
  } = useApiFn<ModelProfile[]>('model-profiles', fetchModelProfiles, {
    staleTime: 30_000,
  });

  const handleWsMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.type === 'profile:changed') {
          refresh();
        }
      } catch {
        // ignore non-JSON messages
      }
    },
    [refresh]
  );

  const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/brain/ws`;
  useWebSocket(wsUrl, { onMessage: handleWsMessage });

  const handleSwitch = async (profileId: string) => {
    setSwitching(true);
    try {
      await switchProfile(profileId);
      refresh();
      const target = profiles?.find((p) => p.id === profileId);
      setToast({
        message: `已切换到「${target?.name || profileId}」`,
        type: 'success',
      });
    } catch (err) {
      setToast({
        message: `切换失败: ${err instanceof Error ? err.message : '未知错误'}`,
        type: 'error',
      });
    } finally {
      setSwitching(false);
    }
  };

  const activeProfile = profiles?.find((p) => p.is_active);

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-white/10 rounded w-48" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="h-48 bg-white/5 rounded-xl border border-white/10" />
            <div className="h-48 bg-white/5 rounded-xl border border-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 text-red-400">
          加载 Profile 失败: {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Brain className="w-6 h-6 text-purple-400" />
            模型 Profile
          </h1>
          {activeProfile && (
            <p className="text-sm text-gray-400 mt-1">
              当前: <span className="text-white font-medium">{activeProfile.name}</span>
            </p>
          )}
        </div>
        <button
          onClick={refresh}
          className="p-2 rounded-lg hover:bg-white/10 text-gray-400 hover:text-white transition-colors"
          title="刷新"
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {profiles?.map((profile) => (
          <ProfileCard
            key={profile.id}
            profile={profile}
            switching={switching}
            onSwitch={handleSwitch}
          />
        ))}
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
