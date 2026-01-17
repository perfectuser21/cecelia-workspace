import { Link } from 'react-router-dom';
import { Activity } from 'lucide-react';

const ToolsPage: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto">
      <h2 className="text-xl font-semibold mb-6 text-gray-900 dark:text-white">工具箱</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link
          to="/tools/session-monitor"
          className="bg-white dark:bg-slate-800 rounded-lg shadow p-6 hover:shadow-md transition-shadow border border-slate-200 dark:border-slate-700"
        >
          <Activity className="w-10 h-10 text-blue-500 mb-3" />
          <h3 className="font-medium text-gray-900 dark:text-white mb-1">登录状态</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">查看各平台登录状态和持续时间</p>
        </Link>
      </div>
    </div>
  );
};

export default ToolsPage;
