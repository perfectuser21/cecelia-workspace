import { useMemo, useState } from 'react';
import {
  FileText,
  Brain,
  Code,
  CheckCircle,
  Play,
  AlertCircle,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import { StreamEvent } from '../../../api/workflow-tracker.api';

interface WorkflowGraphProps {
  events: StreamEvent[];
}

interface WorkflowNode {
  id: string;
  type: 'prd' | 'ai' | 'task' | 'qc' | 'done';
  title: string;
  status: 'pending' | 'running' | 'success' | 'fail';
  details?: any;
  children?: WorkflowNode[];
}

const NODE_STYLES = {
  prd: {
    bg: 'bg-blue-500',
    border: 'border-blue-600',
    icon: FileText,
    label: 'PRD',
  },
  ai: {
    bg: 'bg-purple-500',
    border: 'border-purple-600',
    icon: Brain,
    label: 'AI 解析',
  },
  task: {
    bg: 'bg-yellow-500',
    border: 'border-yellow-600',
    icon: Code,
    label: '任务',
  },
  qc: {
    bg: 'bg-orange-500',
    border: 'border-orange-600',
    icon: CheckCircle,
    label: '质检',
  },
  done: {
    bg: 'bg-green-500',
    border: 'border-green-600',
    icon: CheckCircle,
    label: '完成',
  },
};

const STATUS_STYLES = {
  pending: 'opacity-50',
  running: 'ring-2 ring-blue-400 ring-offset-2 animate-pulse',
  success: '',
  fail: 'ring-2 ring-red-400 ring-offset-2',
};

function buildWorkflowNodes(events: StreamEvent[]): WorkflowNode[] {
  const nodes: WorkflowNode[] = [];
  let prdContent = '';
  let aiTasks: any[] = [];

  for (const event of events) {
    if (event.details?.content && event.details?.file === 'prd.md') {
      prdContent = event.details.content;
    }
    if (event.details?.tasks && Array.isArray(event.details.tasks)) {
      aiTasks = event.details.tasks;
    }
  }

  // 1. PRD 节点
  nodes.push({
    id: 'prd',
    type: 'prd',
    title: '需求输入',
    status: prdContent ? 'success' : 'pending',
    details: { content: prdContent },
  });

  // 2. AI 解析节点
  nodes.push({
    id: 'ai-parse',
    type: 'ai',
    title: 'Claude 分解任务',
    status: aiTasks.length > 0 ? 'success' : prdContent ? 'running' : 'pending',
    details: { tasks: aiTasks },
  });

  // 3. 任务节点（从 AI 解析的任务中获取）
  if (aiTasks.length > 0) {
    const taskNodes: WorkflowNode[] = aiTasks.map((task, idx) => {
      // 从事件中查找任务状态
      const taskEvent = events.find(
        (e) =>
          e.details?.task_id === task.id ||
          e.title?.includes(task.name) ||
          e.title?.includes(`task_${idx + 1}`)
      );

      let status: 'pending' | 'running' | 'success' | 'fail' = 'pending';
      if (taskEvent) {
        if (taskEvent.type === 'success') status = 'success';
        else if (taskEvent.type === 'error') status = 'fail';
        else if (taskEvent.type === 'action') status = 'running';
      }

      return {
        id: task.id || `task-${idx}`,
        type: 'task' as const,
        title: task.name,
        status,
        details: task,
      };
    });

    nodes.push({
      id: 'tasks',
      type: 'task',
      title: `执行任务 (${aiTasks.length})`,
      status: taskNodes.some((t) => t.status === 'running')
        ? 'running'
        : taskNodes.every((t) => t.status === 'success')
        ? 'success'
        : taskNodes.some((t) => t.status === 'fail')
        ? 'fail'
        : 'pending',
      children: taskNodes,
    });
  }

  // 4. 质检节点
  const qcEvents = events.filter(
    (e) => e.details?.score !== undefined || e.title?.includes('质检')
  );
  if (qcEvents.length > 0 || aiTasks.length > 0) {
    nodes.push({
      id: 'qc',
      type: 'qc',
      title: '质量检查',
      status: qcEvents.length > 0 ? 'success' : 'pending',
      details: qcEvents[0]?.details,
    });
  }

  // 5. 完成节点
  const doneEvent = events.find((e) => e.type === 'success' && e.title?.includes('完成'));
  if (doneEvent || aiTasks.length > 0) {
    nodes.push({
      id: 'done',
      type: 'done',
      title: '交付完成',
      status: doneEvent ? 'success' : 'pending',
    });
  }

  return nodes;
}

function NodeCard({
  node,
  isLast,
  expanded,
  onToggle,
}: {
  node: WorkflowNode;
  isLast: boolean;
  expanded: boolean;
  onToggle: () => void;
}) {
  const style = NODE_STYLES[node.type];
  const Icon = style.icon;
  const hasChildren = node.children && node.children.length > 0;
  const hasDetails = node.details && Object.keys(node.details).length > 0;
  const isExpandable = hasChildren || hasDetails;

  return (
    <div className="flex items-start">
      {/* 节点 */}
      <div
        className={`
          relative flex-shrink-0 w-48 rounded-xl border-2 overflow-hidden
          ${style.border} ${STATUS_STYLES[node.status]}
          ${isExpandable ? 'cursor-pointer' : ''}
          transition-all duration-200 hover:shadow-lg
        `}
        onClick={isExpandable ? onToggle : undefined}
      >
        {/* 头部 */}
        <div className={`${style.bg} text-white px-3 py-2 flex items-center gap-2`}>
          <Icon className="w-4 h-4" />
          <span className="text-xs font-medium">{style.label}</span>
          {node.status === 'running' && (
            <Play className="w-3 h-3 ml-auto animate-pulse" />
          )}
          {node.status === 'success' && (
            <CheckCircle className="w-3 h-3 ml-auto" />
          )}
          {node.status === 'fail' && (
            <AlertCircle className="w-3 h-3 ml-auto" />
          )}
        </div>

        {/* 内容 */}
        <div className="bg-white px-3 py-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-800 truncate">
              {node.title}
            </span>
            {isExpandable && (
              <span className="text-gray-400 ml-1">
                {expanded ? (
                  <ChevronDown className="w-4 h-4" />
                ) : (
                  <ChevronRight className="w-4 h-4" />
                )}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 连接线 */}
      {!isLast && (
        <div className="flex items-center h-12 ml-0">
          <div
            className={`w-12 h-0.5 ${
              node.status === 'success' ? 'bg-green-400' : 'bg-gray-300'
            }`}
          />
          <div
            className={`w-0 h-0 border-t-4 border-b-4 border-l-8 border-transparent ${
              node.status === 'success' ? 'border-l-green-400' : 'border-l-gray-300'
            }`}
          />
        </div>
      )}
    </div>
  );
}

function NodeDetails({ node }: { node: WorkflowNode }) {
  if (node.children && node.children.length > 0) {
    return (
      <div className="mt-3 ml-6 space-y-2">
        {node.children.map((child, idx) => (
          <div
            key={child.id}
            className={`
              flex items-center gap-3 px-3 py-2 rounded-lg border
              ${
                child.status === 'success'
                  ? 'bg-green-50 border-green-200'
                  : child.status === 'fail'
                  ? 'bg-red-50 border-red-200'
                  : child.status === 'running'
                  ? 'bg-blue-50 border-blue-200'
                  : 'bg-gray-50 border-gray-200'
              }
            `}
          >
            <span className="text-xs text-gray-400 font-mono w-5">{idx + 1}</span>
            <span className="text-sm text-gray-700 flex-1">{child.title}</span>
            {child.details?.complexity && (
              <span className="text-xs px-1.5 py-0.5 bg-white rounded border text-gray-500">
                L{child.details.complexity}
              </span>
            )}
            {child.status === 'success' && (
              <CheckCircle className="w-4 h-4 text-green-500" />
            )}
            {child.status === 'running' && (
              <Play className="w-4 h-4 text-blue-500 animate-pulse" />
            )}
          </div>
        ))}
      </div>
    );
  }

  if (node.details) {
    if (node.type === 'prd' && node.details.content) {
      return (
        <div className="mt-3 ml-6 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <div className="text-xs text-blue-600 font-medium mb-1">PRD 内容</div>
          <div className="text-sm text-gray-700 whitespace-pre-wrap max-h-32 overflow-y-auto">
            {node.details.content.substring(0, 500)}
            {node.details.content.length > 500 && '...'}
          </div>
        </div>
      );
    }

    if (node.type === 'ai' && node.details.tasks) {
      return (
        <div className="mt-3 ml-6 p-3 bg-purple-50 rounded-lg border border-purple-200">
          <div className="text-xs text-purple-600 font-medium mb-2">
            解析出 {node.details.tasks.length} 个任务
          </div>
          <div className="space-y-1">
            {node.details.tasks.slice(0, 5).map((task: any, idx: number) => (
              <div key={idx} className="text-sm text-gray-700 flex items-center gap-2">
                <span className="text-purple-400">•</span>
                <span>{task.name}</span>
              </div>
            ))}
            {node.details.tasks.length > 5 && (
              <div className="text-xs text-gray-400">
                ... 还有 {node.details.tasks.length - 5} 个
              </div>
            )}
          </div>
        </div>
      );
    }

    if (node.details.score !== undefined) {
      return (
        <div className="mt-3 ml-6 p-3 bg-orange-50 rounded-lg border border-orange-200">
          <div className="flex items-center gap-2">
            <span className="text-xs text-orange-600 font-medium">质检得分:</span>
            <span
              className={`text-lg font-bold ${
                node.details.score >= 80
                  ? 'text-green-600'
                  : node.details.score >= 60
                  ? 'text-yellow-600'
                  : 'text-red-600'
              }`}
            >
              {node.details.score}
            </span>
          </div>
        </div>
      );
    }
  }

  return null;
}

export default function WorkflowGraph({ events }: WorkflowGraphProps) {
  const nodes = useMemo(() => buildWorkflowNodes(events), [events]);
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set());

  const toggleNode = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(nodeId)) {
        next.delete(nodeId);
      } else {
        next.add(nodeId);
      }
      return next;
    });
  };

  if (nodes.length === 0) {
    return null;
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">执行流程</h2>

      {/* 横向节点流 */}
      <div className="overflow-x-auto pb-4">
        <div className="flex items-start min-w-max">
          {nodes.map((node, idx) => (
            <div key={node.id} className="flex flex-col">
              <NodeCard
                node={node}
                isLast={idx === nodes.length - 1}
                expanded={expandedNodes.has(node.id)}
                onToggle={() => toggleNode(node.id)}
              />
              {expandedNodes.has(node.id) && <NodeDetails node={node} />}
            </div>
          ))}
        </div>
      </div>

      {/* 图例 */}
      <div className="mt-4 pt-4 border-t border-gray-100 flex flex-wrap gap-4 text-xs text-gray-500">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-blue-500" />
          <span>需求输入</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-purple-500" />
          <span>AI 解析</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-yellow-500" />
          <span>任务执行</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-orange-500" />
          <span>质量检查</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500" />
          <span>完成</span>
        </div>
      </div>
    </div>
  );
}
