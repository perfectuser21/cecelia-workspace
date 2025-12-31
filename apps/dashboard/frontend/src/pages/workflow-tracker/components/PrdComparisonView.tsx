import { useMemo } from 'react';
import { FileText, Brain, Check, Plus, AlertCircle } from 'lucide-react';
import { StreamEvent } from '../../../api/workflow-tracker.api';

interface PrdComparisonViewProps {
  events: StreamEvent[];
}

interface PrdStep {
  index: number;
  content: string;
}

interface AiTask {
  id: string;
  name: string;
  description?: string;
  complexity?: number;
}

interface ComparisonResult {
  prdSteps: PrdStep[];
  aiTasks: AiTask[];
}

function parsePrdSteps(prdContent: string): PrdStep[] {
  const steps: PrdStep[] = [];

  // 匹配 "1. xxx" 或 "1、xxx" 或 "第一步" 等格式
  const patterns = [
    /(\d+)[.、]\s*(.+?)(?=\d+[.、]|$)/gs,
    /第([一二三四五六七八九十]+)步[：:]\s*(.+?)(?=第[一二三四五六七八九十]+步|$)/gs,
    /[-•]\s*(.+?)(?=[-•]|$)/gs,
  ];

  // 首先尝试数字格式
  const numPattern = /(\d+)[.、]\s*([^\d]+?)(?=\d+[.、]|$)/gs;
  let match;
  while ((match = numPattern.exec(prdContent)) !== null) {
    const content = match[2].trim();
    if (content.length > 2) {
      steps.push({
        index: parseInt(match[1]),
        content: content.replace(/\s+/g, ' ').substring(0, 100),
      });
    }
  }

  // 如果没找到，尝试分行
  if (steps.length === 0) {
    const lines = prdContent.split(/[。\n]/).filter(l => l.trim().length > 5);
    lines.forEach((line, idx) => {
      steps.push({
        index: idx + 1,
        content: line.trim().substring(0, 100),
      });
    });
  }

  return steps.slice(0, 10); // 最多显示10步
}

function extractComparisonData(events: StreamEvent[]): ComparisonResult | null {
  let prdContent = '';
  let aiTasks: AiTask[] = [];

  for (const event of events) {
    if (event.details) {
      // 查找 PRD 内容
      if (event.details.content && event.details.file === 'prd.md') {
        prdContent = event.details.content;
      }
      // 查找 AI 任务
      if (event.details.tasks && Array.isArray(event.details.tasks)) {
        aiTasks = event.details.tasks;
      }
    }
  }

  if (!prdContent && aiTasks.length === 0) {
    return null;
  }

  return {
    prdSteps: parsePrdSteps(prdContent),
    aiTasks: aiTasks.slice(0, 10),
  };
}

function getMatchStatus(step: PrdStep, tasks: AiTask[]): 'match' | 'partial' | 'missing' {
  const stepLower = step.content.toLowerCase();

  for (const task of tasks) {
    const taskLower = (task.name + ' ' + (task.description || '')).toLowerCase();
    // 简单的关键词匹配
    const keywords = stepLower.split(/\s+/).filter(w => w.length > 2);
    const matchCount = keywords.filter(kw => taskLower.includes(kw)).length;

    if (matchCount >= keywords.length * 0.5) {
      return 'match';
    } else if (matchCount >= keywords.length * 0.3) {
      return 'partial';
    }
  }

  return 'missing';
}

function getTaskOrigin(task: AiTask, steps: PrdStep[]): 'from_prd' | 'ai_added' {
  const taskLower = (task.name + ' ' + (task.description || '')).toLowerCase();

  for (const step of steps) {
    const stepLower = step.content.toLowerCase();
    const keywords = stepLower.split(/\s+/).filter(w => w.length > 2);
    const matchCount = keywords.filter(kw => taskLower.includes(kw)).length;

    if (matchCount >= keywords.length * 0.3) {
      return 'from_prd';
    }
  }

  return 'ai_added';
}

export default function PrdComparisonView({ events }: PrdComparisonViewProps) {
  const comparison = useMemo(() => extractComparisonData(events), [events]);

  if (!comparison || (comparison.prdSteps.length === 0 && comparison.aiTasks.length === 0)) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">PRD vs AI 理解对比</h2>

      <div className="grid grid-cols-2 gap-6">
        {/* 左侧: PRD 步骤 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-gray-700">你写的 PRD</span>
            <span className="text-xs text-gray-400">({comparison.prdSteps.length} 步)</span>
          </div>
          <div className="space-y-2">
            {comparison.prdSteps.map((step) => {
              const status = getMatchStatus(step, comparison.aiTasks);
              return (
                <div
                  key={step.index}
                  className={`p-3 rounded-lg border-l-4 ${
                    status === 'match'
                      ? 'border-l-green-400 bg-green-50'
                      : status === 'partial'
                      ? 'border-l-yellow-400 bg-yellow-50'
                      : 'border-l-red-400 bg-red-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm font-mono">{step.index}.</span>
                    <span className="text-sm text-gray-700 flex-1">{step.content}</span>
                    {status === 'match' && (
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                    )}
                    {status === 'partial' && (
                      <AlertCircle className="w-4 h-4 text-yellow-500 flex-shrink-0" />
                    )}
                  </div>
                </div>
              );
            })}
            {comparison.prdSteps.length === 0 && (
              <div className="text-sm text-gray-400 italic">未检测到步骤</div>
            )}
          </div>
        </div>

        {/* 右侧: AI 理解的任务 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-5 h-5 text-purple-500" />
            <span className="font-medium text-gray-700">AI 理解的任务</span>
            <span className="text-xs text-gray-400">({comparison.aiTasks.length} 个)</span>
          </div>
          <div className="space-y-2">
            {comparison.aiTasks.map((task, idx) => {
              const origin = getTaskOrigin(task, comparison.prdSteps);
              return (
                <div
                  key={task.id || idx}
                  className={`p-3 rounded-lg border-l-4 ${
                    origin === 'from_prd'
                      ? 'border-l-purple-400 bg-purple-50'
                      : 'border-l-blue-400 bg-blue-50'
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <span className="text-gray-400 text-sm font-mono">{idx + 1}.</span>
                    <div className="flex-1">
                      <span className="text-sm text-gray-700">{task.name}</span>
                      {task.complexity && (
                        <span className="ml-2 text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                          复杂度 {task.complexity}
                        </span>
                      )}
                    </div>
                    {origin === 'ai_added' && (
                      <span className="flex items-center gap-1 text-xs text-blue-600">
                        <Plus className="w-3 h-3" />
                        AI新增
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
            {comparison.aiTasks.length === 0 && (
              <div className="text-sm text-gray-400 italic">暂无任务</div>
            )}
          </div>
        </div>
      </div>

      {/* 图例 */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-400" />
          <span>完全匹配</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-400" />
          <span>部分匹配</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-400" />
          <span>未匹配</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-400" />
          <span>AI 自动添加</span>
        </div>
      </div>
    </div>
  );
}
