/**
 * CommandCenter - 四个卡片入口
 */

import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bot, Share2, Briefcase, TrendingUp, ChevronRight } from 'lucide-react';

interface CardData {
  id: string;
  title: string;
  subtitle: string;
  value: string | number;
  unit?: string;
  icon: React.ElementType;
  color: string;
  path: string;
  available: boolean;
}

export default function CommandCenter() {
  const navigate = useNavigate();
  const [aiTasks, setAiTasks] = useState<number>(0);

  useEffect(() => {
    // Fetch AI tasks count
    fetch('/api/cecelia/overview')
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setAiTasks(data.completed || 0);
        }
      })
      .catch(() => {});
  }, []);

  const cards: CardData[] = [
    {
      id: 'ai',
      title: 'AI Workforce',
      subtitle: 'Cecelia + N8N',
      value: aiTasks,
      unit: 'tasks done',
      icon: Bot,
      color: 'blue',
      path: '/command/ai',
      available: true,
    },
    {
      id: 'media',
      title: 'Media',
      subtitle: 'Content & Growth',
      value: '-',
      unit: 'posts',
      icon: Share2,
      color: 'purple',
      path: '/command/media',
      available: false,
    },
    {
      id: 'clients',
      title: 'Clients',
      subtitle: 'Project Delivery',
      value: '-',
      unit: 'projects',
      icon: Briefcase,
      color: 'emerald',
      path: '/command/clients',
      available: false,
    },
    {
      id: 'portfolio',
      title: 'Portfolio',
      subtitle: 'Investments',
      value: '-',
      unit: '',
      icon: TrendingUp,
      color: 'amber',
      path: '/command/portfolio',
      available: false,
    },
  ];

  const colorClasses: Record<string, { bg: string; icon: string; hover: string }> = {
    blue: {
      bg: 'bg-blue-50 dark:bg-blue-900/20',
      icon: 'text-blue-500',
      hover: 'hover:border-blue-300 dark:hover:border-blue-700',
    },
    purple: {
      bg: 'bg-purple-50 dark:bg-purple-900/20',
      icon: 'text-purple-500',
      hover: 'hover:border-purple-300 dark:hover:border-purple-700',
    },
    emerald: {
      bg: 'bg-emerald-50 dark:bg-emerald-900/20',
      icon: 'text-emerald-500',
      hover: 'hover:border-emerald-300 dark:hover:border-emerald-700',
    },
    amber: {
      bg: 'bg-amber-50 dark:bg-amber-900/20',
      icon: 'text-amber-500',
      hover: 'hover:border-amber-300 dark:hover:border-amber-700',
    },
  };

  const handleClick = (card: CardData) => {
    if (card.available) {
      navigate(card.path);
    }
  };

  return (
    <div className="min-h-screen -m-8 -mt-8 p-8 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12 text-center">
          <h1 className="text-3xl font-bold text-slate-800 dark:text-white">Command Center</h1>
          <p className="text-slate-500 dark:text-slate-400 mt-2">Personal Dashboard</p>
        </div>

        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {cards.map((card) => {
            const colors = colorClasses[card.color];
            const Icon = card.icon;

            return (
              <button
                key={card.id}
                onClick={() => handleClick(card)}
                disabled={!card.available}
                className={`
                  relative p-8 rounded-2xl text-left
                  bg-white dark:bg-slate-800/80
                  border-2 border-slate-200 dark:border-slate-700
                  transition-all duration-200
                  ${card.available ? `cursor-pointer ${colors.hover} hover:shadow-lg` : 'cursor-not-allowed opacity-60'}
                `}
              >
                {/* Icon */}
                <div className={`w-14 h-14 rounded-xl ${colors.bg} flex items-center justify-center mb-6`}>
                  <Icon className={`w-7 h-7 ${colors.icon}`} />
                </div>

                {/* Title */}
                <h2 className="text-xl font-semibold text-slate-800 dark:text-white">
                  {card.title}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  {card.subtitle}
                </p>

                {/* Value */}
                <div className="mt-6">
                  <span className="text-4xl font-bold text-slate-800 dark:text-white">
                    {card.value}
                  </span>
                  {card.unit && (
                    <span className="text-sm text-slate-500 dark:text-slate-400 ml-2">
                      {card.unit}
                    </span>
                  )}
                </div>

                {/* Arrow */}
                {card.available && (
                  <ChevronRight className="absolute right-6 top-1/2 -translate-y-1/2 w-6 h-6 text-slate-300 dark:text-slate-600" />
                )}

                {/* Coming soon badge */}
                {!card.available && (
                  <span className="absolute top-4 right-4 text-xs px-2 py-1 bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 rounded-full">
                    Coming soon
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
