/**
 * ProjectCard Component
 * Card display for a single repository in the overview page
 */

import { Link } from 'react-router-dom';
import {
  Package,
  GitBranch,
  Activity,
  CheckCircle2,
  XCircle,
  ChevronRight,
  ExternalLink,
} from 'lucide-react';
import { ProjectGroup } from '../api/agents.api';

interface ProjectCardProps {
  project: ProjectGroup;
}

export default function ProjectCard({ project }: ProjectCardProps) {
  const completedCount = project.features.reduce((sum, f) => {
    return sum + f.history.filter(v => v.status === 'completed').length;
  }, 0);

  const failedCount = project.features.reduce((sum, f) => {
    return sum + f.history.filter(v => v.status === 'failed').length;
  }, 0);

  return (
    <Link
      to={`/cecelia/project/${encodeURIComponent(project.name)}`}
      className="block bg-slate-800 rounded-xl border border-slate-700 p-5 hover:border-violet-500/50 hover:bg-slate-800/80 transition-all group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl">
            <Package className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold text-white">{project.name}</h3>
              {project.repoUrl && (
                <a
                  href={project.repoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
                  className="text-gray-500 hover:text-blue-400 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-500 group-hover:text-violet-400 transition-colors" />
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {/* Features */}
        <div className="flex items-center gap-2 text-sm">
          <GitBranch className="w-4 h-4 text-cyan-400" />
          <span className="text-gray-400">{project.features.length} Features</span>
        </div>

        {/* Running */}
        <div className="flex items-center gap-2 text-sm">
          {project.runningCount > 0 ? (
            <>
              <Activity className="w-4 h-4 text-blue-400 animate-pulse" />
              <span className="text-blue-400">{project.runningCount} 运行中</span>
            </>
          ) : (
            <>
              <Activity className="w-4 h-4 text-gray-500" />
              <span className="text-gray-500">0 运行中</span>
            </>
          )}
        </div>

        {/* Completed */}
        <div className="flex items-center gap-2 text-sm">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span className="text-gray-400">{completedCount} 已完成</span>
        </div>

        {/* Failed */}
        <div className="flex items-center gap-2 text-sm">
          <XCircle className="w-4 h-4 text-red-400" />
          <span className="text-gray-400">{failedCount} 失败</span>
        </div>
      </div>

      {/* Running indicator bar */}
      {project.runningCount > 0 && (
        <div className="mt-4 pt-3 border-t border-slate-700">
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-slate-700 rounded-full overflow-hidden">
              <div className="h-full w-1/3 bg-blue-500 rounded-full animate-pulse" />
            </div>
            <span className="text-xs text-blue-400">执行中...</span>
          </div>
        </div>
      )}
    </Link>
  );
}
