/**
 * EngineDashboard - Engine 工作台首页
 * 合并天气、问候语、倒计时 + 开发任务监控
 */

import { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  GitBranch,
  CheckCircle2,
  Clock,
  AlertCircle,
  Cpu,
  Code,
  Workflow,
  ArrowRight,
  RefreshCw,
  Terminal,
  Zap,
  Sun,
  Cloud,
  CloudRain,
  CloudSnow,
  Quote,
  Timer,
  PartyPopper,
  Bot,
} from 'lucide-react';
import { getAllTasks, type DevTaskStatus } from '../api/dev-tracker.api';
import { getEngineInfo, type EngineInfo } from '../api/engine.api';
import { useAuth } from '../contexts/AuthContext';

// ============ 天气和问候语相关 ============

// 每日一言库
const DAILY_QUOTES = [
  { text: '把每一件简单的事做好就是不简单。', author: '稻盛和夫' },
  { text: '不要等待机会，而要创造机会。', author: '林肯' },
  { text: '成功不是终点，失败也不是终结，唯有勇气才是永恒。', author: '丘吉尔' },
  { text: '今天的努力是明天的礼物。', author: '佚名' },
  { text: '专注于当下，未来自然清晰。', author: '佚名' },
  { text: '简单的事情重复做，你就是专家。', author: '佚名' },
  { text: '与其担心未来，不如现在好好努力。', author: '佚名' },
  { text: '每一个优秀的人，都有一段沉默的时光。', author: '佚名' },
  { text: 'Code is poetry.', author: 'WordPress' },
  { text: 'Talk is cheap. Show me the code.', author: 'Linus Torvalds' },
  { text: '代码写得好，BUG 少不了。', author: '程序员' },
  { text: '今天的 TODO，就是明天的 DONE。', author: '乐观开发者' },
];

// 节日配置
const HOLIDAYS: Record<string, { name: string; greeting: string; emoji: string }> = {
  '01-01': { name: '元旦', greeting: '新年快乐！新的一年，新的开始', emoji: '🎊' },
  '02-14': { name: '情人节', greeting: '愿你被爱包围', emoji: '💕' },
  '03-14': { name: '白色情人节', greeting: '甜蜜的一天', emoji: '🤍' },
  '04-01': { name: '愚人节', greeting: '今天说的话要小心哦', emoji: '🤡' },
  '05-01': { name: '劳动节', greeting: '劳动最光荣！不过今天可以休息', emoji: '💪' },
  '05-04': { name: '青年节', greeting: '永远年轻，永远热泪盈眶', emoji: '🔥' },
  '06-01': { name: '儿童节', greeting: '愿你永葆童心', emoji: '🎈' },
  '10-01': { name: '国庆节', greeting: '祖国生日快乐！', emoji: '🇨🇳' },
  '10-31': { name: '万圣节', greeting: 'Trick or Treat!', emoji: '🎃' },
  '12-24': { name: '平安夜', greeting: '平安喜乐', emoji: '🎄' },
  '12-25': { name: '圣诞节', greeting: 'Merry Christmas!', emoji: '🎅' },
  '12-31': { name: '跨年夜', greeting: '新年倒计时！', emoji: '🎆' },
};

const getHoliday = () => {
  const now = new Date();
  const key = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  return HOLIDAYS[key] || null;
};

const getDailyQuote = () => {
  const today = new Date();
  const seed = today.getFullYear() * 10000 + (today.getMonth() + 1) * 100 + today.getDate();
  const index = seed % DAILY_QUOTES.length;
  return DAILY_QUOTES[index];
};

const getOffWorkCountdown = () => {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return null;

  const hour = now.getHours();
  const minute = now.getMinutes();
  const timeValue = hour + minute / 60;
  if (timeValue < 8.5 || timeValue >= 18) return null;

  const offWorkTime = new Date(now);
  offWorkTime.setHours(18, 0, 0, 0);
  const diff = offWorkTime.getTime() - now.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  return { hours, minutes };
};

const getWeekendCountdown = () => {
  const now = new Date();
  const day = now.getDay();
  if (day === 0 || day === 6) return null;
  return 6 - day;
};

interface WeatherInfo {
  temp: string;
  desc: string;
  icon: 'sun' | 'cloud' | 'rain' | 'snow';
  city: string;
}

const getWeatherIcon = (code: string) => {
  const codeNum = parseInt(code);
  if (codeNum >= 200 && codeNum < 300) return 'rain';
  if (codeNum >= 300 && codeNum < 600) return 'rain';
  if (codeNum >= 600 && codeNum < 700) return 'snow';
  if (codeNum >= 700 && codeNum < 800) return 'cloud';
  if (codeNum === 800) return 'sun';
  return 'cloud';
};

const getDynamicGreeting = (holiday: ReturnType<typeof getHoliday>) => {
  const now = new Date();
  const hour = now.getHours();
  const minute = now.getMinutes();
  const day = now.getDay();
  const timeValue = hour + minute / 60;

  if (holiday) {
    return { greeting: `${holiday.emoji} ${holiday.name}快乐`, subtitle: holiday.greeting };
  }

  if (day === 0 || day === 6) {
    return { greeting: '周末好', subtitle: '难得休息，还惦记着代码？' };
  }

  if (timeValue < 8.5) {
    return { greeting: '早', subtitle: '来得挺早，先来杯咖啡吧' };
  }
  if (timeValue < 12) {
    return { greeting: '上午好', subtitle: '状态不错，继续 Coding' };
  }
  if (timeValue < 13.5) {
    return { greeting: '中午好', subtitle: '该吃饭啦，别饿着自己' };
  }
  if (timeValue < 18) {
    return { greeting: '下午好', subtitle: '离下班又近了一步' };
  }
  if (timeValue < 21) {
    return { greeting: '晚上好', subtitle: '辛苦一天了，注意休息' };
  }
  return { greeting: '夜猫子', subtitle: '这么晚还在忙，注意身体' };
};

// ============ 活动相关 ============

interface RecentActivity {
  id: string;
  type: 'commit' | 'pr' | 'task_start' | 'task_complete' | 'ci_pass' | 'ci_fail';
  title: string;
  project: string;
  time: string;
  branch?: string;
}

export default function EngineDashboard() {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<DevTaskStatus[]>([]);
  const [engineInfo, setEngineInfo] = useState<EngineInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [offWorkCountdown, setOffWorkCountdown] = useState(getOffWorkCountdown());
  const weekendCountdown = getWeekendCountdown();

  const holiday = useMemo(() => getHoliday(), []);
  const dailyQuote = useMemo(() => getDailyQuote(), []);
  const greeting = getDynamicGreeting(holiday);

  const fetchData = async () => {
    try {
      const [tasksRes, engineRes] = await Promise.all([getAllTasks(), getEngineInfo()]);
      if (tasksRes.success && tasksRes.data) {
        setTasks(tasksRes.data);
      }
      if (engineRes.success && engineRes.engine) {
        setEngineInfo(engineRes.engine);
      }
    } catch (e) {
      console.error('Failed to fetch dashboard data:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  // 倒计时更新
  useEffect(() => {
    const timer = setInterval(() => {
      setOffWorkCountdown(getOffWorkCountdown());
    }, 60000);
    return () => clearInterval(timer);
  }, []);

  // 天气获取
  useEffect(() => {
    const fetchWeather = async () => {
      try {
        const res = await fetch("https://wttr.in/Xi'an?format=j1");
        if (res.ok) {
          const data = await res.json();
          const current = data.current_condition?.[0];
          if (current) {
            setWeather({
              temp: current.temp_C,
              desc: current.lang_zh?.[0]?.value || current.weatherDesc?.[0]?.value || '未知',
              icon: getWeatherIcon(current.weatherCode),
              city: '西安',
            });
          }
        }
      } catch (e) {
        console.log('天气获取失败', e);
      }
    };
    fetchWeather();
    const weatherTimer = setInterval(fetchWeather, 30 * 60 * 1000);
    return () => clearInterval(weatherTimer);
  }, []);

  // 从任务生成最近活动
  const recentActivities: RecentActivity[] = tasks
    .flatMap((task) => {
      const activities: RecentActivity[] = [];
      const { repo, task: taskInfo, steps, quality } = task;

      if (taskInfo.createdAt) {
        activities.push({
          id: `${repo.name}-start`,
          type: 'task_start',
          title: `开始任务: ${taskInfo.name || task.branches.current}`,
          project: repo.name,
          time: taskInfo.createdAt,
          branch: task.branches.current,
        });
      }

      steps.items
        .filter((s) => s.status === 'done' && s.completedAt)
        .forEach((step) => {
          activities.push({
            id: `${repo.name}-step-${step.id}`,
            type: 'task_complete',
            title: `完成 Step ${step.id}: ${step.name}`,
            project: repo.name,
            time: step.completedAt!,
            branch: task.branches.current,
          });
        });

      if (quality.ci === 'passed') {
        activities.push({
          id: `${repo.name}-ci-pass`,
          type: 'ci_pass',
          title: 'CI 检查通过',
          project: repo.name,
          time: quality.lastCheck,
          branch: task.branches.current,
        });
      } else if (quality.ci === 'failed') {
        activities.push({
          id: `${repo.name}-ci-fail`,
          type: 'ci_fail',
          title: 'CI 检查失败',
          project: repo.name,
          time: quality.lastCheck,
          branch: task.branches.current,
        });
      }

      if (taskInfo.prUrl) {
        activities.push({
          id: `${repo.name}-pr`,
          type: 'pr',
          title: `创建 PR #${taskInfo.prNumber}`,
          project: repo.name,
          time: taskInfo.createdAt,
          branch: task.branches.current,
        });
      }

      return activities;
    })
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 10);

  // 统计数据
  const stats = {
    activeTasks: tasks.filter((t) => t.steps.current > 0 && t.steps.current < 10).length,
    completedToday: tasks.filter((t) => {
      const allDone = t.steps.items.every((s) => s.status === 'done' || s.status === 'skipped');
      if (!allDone) return false;
      const lastStep = t.steps.items.find((s) => s.status === 'done' && s.completedAt);
      if (!lastStep?.completedAt) return false;
      const today = new Date().toDateString();
      return new Date(lastStep.completedAt).toDateString() === today;
    }).length,
    failedTasks: tasks.filter((t) => t.quality.ci === 'failed' || t.steps.items.some((s) => s.status === 'failed'))
      .length,
    totalRepos: new Set(tasks.map((t) => t.repo.name)).size,
  };

  const getActivityIcon = (type: RecentActivity['type']) => {
    switch (type) {
      case 'commit':
        return <GitBranch className="w-4 h-4 text-blue-500" />;
      case 'pr':
        return <GitBranch className="w-4 h-4 text-purple-500" />;
      case 'task_start':
        return <Zap className="w-4 h-4 text-cyan-500" />;
      case 'task_complete':
        return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'ci_pass':
        return <CheckCircle2 className="w-4 h-4 text-green-500" />;
      case 'ci_fail':
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      default:
        return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const formatTime = (time: string) => {
    const date = new Date(time);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return '刚刚';
    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffMins < 1440) return `${Math.floor(diffMins / 60)} 小时前`;
    return date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 text-cyan-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 顶部欢迎栏 */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 rounded-2xl p-6 border border-cyan-500/20">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white mb-1">
              {greeting.greeting}，{user?.name || 'Developer'}
            </h1>
            <p className="text-slate-400">{greeting.subtitle}</p>
          </div>
          <div className="flex items-center gap-4">
            {engineInfo && (
              <div className="text-right">
                <p className="text-sm text-slate-400">Engine 版本</p>
                <p className="text-lg font-mono text-cyan-400">v{engineInfo.version}</p>
              </div>
            )}
            <div className="p-3 bg-cyan-500/20 rounded-xl">
              <Cpu className="w-8 h-8 text-cyan-400" />
            </div>
          </div>
        </div>
      </div>

      {/* 天气 + 倒计时 + 每日一言 */}
      <div className="flex flex-wrap gap-3">
        {weather && (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-all">
            {weather.icon === 'sun' && <Sun className="w-4 h-4 text-amber-500" />}
            {weather.icon === 'cloud' && <Cloud className="w-4 h-4 text-slate-400" />}
            {weather.icon === 'rain' && <CloudRain className="w-4 h-4 text-blue-500" />}
            {weather.icon === 'snow' && <CloudSnow className="w-4 h-4 text-cyan-400" />}
            <span className="text-sm text-slate-600 dark:text-slate-300">
              {weather.city} <span className="font-medium text-slate-800 dark:text-white">{weather.temp}°C</span>{' '}
              {weather.desc}
            </span>
          </div>
        )}

        {offWorkCountdown && (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            <Timer className="w-4 h-4 text-cyan-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              距离下班还有{' '}
              <span className="font-medium text-slate-800 dark:text-white">
                {offWorkCountdown.hours}小时{offWorkCountdown.minutes}分钟
              </span>
            </span>
          </div>
        )}

        {weekendCountdown !== null && weekendCountdown > 0 && (
          <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
            <PartyPopper className="w-4 h-4 text-purple-500" />
            <span className="text-sm text-slate-600 dark:text-slate-300">
              距离周末还有 <span className="font-medium text-slate-800 dark:text-white">{weekendCountdown}天</span>
            </span>
          </div>
        )}

        <div className="inline-flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-slate-800 rounded-full border border-slate-200 dark:border-slate-700 shadow-sm">
          <Quote className="w-4 h-4 text-cyan-500" />
          <span className="text-sm text-slate-600 dark:text-slate-300">
            {dailyQuote.text}
            <span className="text-slate-400 dark:text-slate-500 ml-1">—— {dailyQuote.author}</span>
          </span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-cyan-100 dark:bg-cyan-900/30 rounded-lg">
              <Activity className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">进行中</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.activeTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">今日完成</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.completedToday}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-lg">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">需关注</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.failedTasks}</p>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-xl p-5 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
              <GitBranch className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">活跃仓库</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{stats.totalRepos}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 最近活动 */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
          <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              最近活动
            </h2>
            <Link
              to="/engine/dev"
              className="text-sm text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-1"
            >
              查看全部 <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {recentActivities.length === 0 ? (
              <div className="p-8 text-center text-slate-500 dark:text-slate-400">
                <Activity className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>暂无最近活动</p>
                <p className="text-sm mt-1">开始一个新任务吧</p>
              </div>
            ) : (
              recentActivities.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5">{getActivityIcon(activity.type)}</div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-slate-900 dark:text-white truncate">{activity.title}</p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-slate-500 dark:text-slate-400">
                        <span className="font-mono bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded">
                          {activity.project}
                        </span>
                        {activity.branch && (
                          <span className="flex items-center gap-1">
                            <GitBranch className="w-3 h-3" />
                            {activity.branch}
                          </span>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">{formatTime(activity.time)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* 右侧栏 */}
        <div className="space-y-4">
          {/* 当前任务 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-500" />
              进行中的任务
            </h3>
            {tasks.filter((t) => t.steps.current > 0 && t.steps.current < 10).length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400 py-4 text-center">暂无进行中的任务</p>
            ) : (
              <div className="space-y-2">
                {tasks
                  .filter((t) => t.steps.current > 0 && t.steps.current < 10)
                  .slice(0, 3)
                  .map((task) => (
                    <Link
                      key={task.repo.name}
                      to="/engine/dev"
                      className="block p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-900 dark:text-white truncate">
                          {task.task.name || task.branches.current}
                        </span>
                        <span className="text-xs text-slate-500">Step {task.steps.current}/10</span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 dark:bg-slate-600 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-cyan-500 transition-all"
                          style={{ width: `${(task.steps.current / 10) * 100}%` }}
                        />
                      </div>
                    </Link>
                  ))}
              </div>
            )}
          </div>

          {/* 快捷入口 */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3">快捷入口</h3>
            <div className="grid grid-cols-2 gap-2">
              <Link
                to="/engine"
                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Cpu className="w-4 h-4 text-cyan-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">能力概览</span>
              </Link>
              <Link
                to="/engine/tasks"
                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Activity className="w-4 h-4 text-purple-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">任务监控</span>
              </Link>
              <Link
                to="/engine/dev"
                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Code className="w-4 h-4 text-emerald-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">开发任务</span>
              </Link>
              <Link
                to="/cecilia"
                className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
              >
                <Bot className="w-4 h-4 text-orange-500" />
                <span className="text-sm text-slate-700 dark:text-slate-300">Cecilia</span>
              </Link>
            </div>
          </div>

          {/* Engine 能力 */}
          {engineInfo && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
                <Zap className="w-4 h-4 text-yellow-500" />
                Engine 能力
              </h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Skills</span>
                  <span className="font-medium text-slate-900 dark:text-white">{engineInfo.skills.length} 个</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>Hooks</span>
                  <span className="font-medium text-slate-900 dark:text-white">{engineInfo.hooks.length} 个</span>
                </div>
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>最近更新</span>
                  <span className="font-medium text-slate-900 dark:text-white">
                    {engineInfo.changelog[0]?.date || '-'}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
