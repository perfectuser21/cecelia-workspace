import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { StreamEvent, StreamEventType } from '../../../api/workflow-tracker.api';

interface EventStreamProps {
  events: StreamEvent[];
}

const TYPE_STYLES: Record<StreamEventType, { border: string; bg: string }> = {
  info: { border: 'border-l-blue-400', bg: 'bg-blue-50' },
  ai: { border: 'border-l-purple-400', bg: 'bg-purple-50' },
  action: { border: 'border-l-yellow-400', bg: 'bg-yellow-50' },
  success: { border: 'border-l-green-400', bg: 'bg-green-50' },
  error: { border: 'border-l-red-400', bg: 'bg-red-50' },
};

function EventCard({ event }: { event: StreamEvent }) {
  const [expanded, setExpanded] = useState(false);
  const style = TYPE_STYLES[event.type];

  return (
    <div
      className={`rounded-lg border-l-4 ${style.border} ${style.bg} transition-all`}
    >
      <div
        className={`p-4 ${event.expandable ? 'cursor-pointer' : ''}`}
        onClick={() => event.expandable && setExpanded(!expanded)}
      >
        <div className="flex items-start gap-3">
          <span className="text-2xl flex-shrink-0">{event.icon}</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs text-gray-400 font-mono">{event.time}</span>
              <span className="font-medium text-gray-900">{event.title}</span>
              {event.expandable && (
                <span className="text-gray-400">
                  {expanded ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </span>
              )}
            </div>
            {event.content && (
              <p className="text-sm text-gray-600 mt-1">{event.content}</p>
            )}
          </div>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && event.details && (
        <div className="px-4 pb-4 pt-0">
          <div className="ml-11 p-3 bg-white/60 rounded-lg border border-gray-200">
            <DetailsRenderer details={event.details} />
          </div>
        </div>
      )}
    </div>
  );
}

function DetailsRenderer({ details }: { details: Record<string, any> }) {
  // 任务列表
  if (details.tasks && Array.isArray(details.tasks)) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-gray-500 font-medium mb-2">
          任务列表 ({details.tasks.length}个)
        </div>
        {details.tasks.map((task: any, idx: number) => (
          <div
            key={task.id || idx}
            className="flex items-center gap-2 text-sm"
          >
            <span className="text-gray-400">{idx + 1}.</span>
            <span className="font-medium">{task.name}</span>
            {task.complexity && (
              <span className="text-xs px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
                复杂度 {task.complexity}
              </span>
            )}
          </div>
        ))}
        {details.model && (
          <div className="text-xs text-gray-400 mt-2">
            模型: {details.model} | Token: {details.tokens_used}
          </div>
        )}
      </div>
    );
  }

  // PRD 内容
  if (details.content && details.file) {
    return (
      <div>
        <div className="text-xs text-gray-500 mb-1">文件: {details.file}</div>
        <div className="text-sm text-gray-700 italic">"{details.content}"</div>
      </div>
    );
  }

  // 文件写入
  if (details.path) {
    return (
      <div className="text-sm">
        <span className="font-mono text-blue-600">{details.path}</span>
        {details.lines && (
          <span className="text-gray-500 ml-2">({details.lines}行)</span>
        )}
        {details.summary && (
          <p className="text-gray-600 mt-1">{details.summary}</p>
        )}
      </div>
    );
  }

  // 质检结果
  if (details.score !== undefined) {
    return (
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium">得分:</span>
          <span
            className={`text-lg font-bold ${
              details.score >= 80
                ? 'text-green-600'
                : details.score >= 60
                ? 'text-yellow-600'
                : 'text-red-600'
            }`}
          >
            {details.score}
          </span>
        </div>
        {details.issues && details.issues.length > 0 && (
          <div className="text-sm text-gray-600">
            <div className="font-medium mb-1">问题:</div>
            <ul className="list-disc list-inside space-y-1">
              {details.issues.map((issue: string, idx: number) => (
                <li key={idx}>{issue}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    );
  }

  // 决策
  if (details.action) {
    return (
      <div>
        <span
          className={`inline-block px-2 py-1 rounded text-sm font-medium ${
            details.action === 'PASS'
              ? 'bg-green-100 text-green-700'
              : details.action === 'REWORK'
              ? 'bg-yellow-100 text-yellow-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {details.action}
        </span>
        {details.reason && (
          <p className="text-sm text-gray-600 mt-2">{details.reason}</p>
        )}
      </div>
    );
  }

  // 通用 JSON 显示
  return (
    <pre className="text-xs text-gray-600 overflow-x-auto">
      {JSON.stringify(details, null, 2)}
    </pre>
  );
}

export default function EventStream({ events }: EventStreamProps) {
  if (events.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>暂无事件</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {events.map((event) => (
        <EventCard key={event.id} event={event} />
      ))}
    </div>
  );
}
