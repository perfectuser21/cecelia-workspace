/**
 * StatusPanel Component
 * Shows running tasks and system status
 */

import { ConnectionState } from '../hooks/useSSE';

interface Task {
  id: string;
  name: string;
  status: string;
  progress: number;
}

interface StatusPanelProps {
  tasks?: Task[];
  connectionState: ConnectionState;
}

export function StatusPanel({ tasks = [], connectionState }: StatusPanelProps) {
  const getConnectionColor = () => {
    switch (connectionState) {
      case 'connected':
        return 'bg-green-500';
      case 'connecting':
        return 'bg-yellow-500 animate-pulse';
      case 'error':
        return 'bg-red-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className="flex flex-col h-full bg-gray-50 rounded-lg border border-gray-200">
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 bg-white rounded-t-lg">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-800">Status</h2>
          <div className="flex items-center space-x-2">
            <div className={'w-2 h-2 rounded-full ' + getConnectionColor()} />
            <span className="text-sm text-gray-600 capitalize">{connectionState}</span>
          </div>
        </div>
      </div>

      {/* Running Tasks */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
        <h3 className="text-sm font-medium text-gray-700">Running Tasks ({tasks.length})</h3>

        {tasks.length === 0 && (
          <div className="text-center text-gray-400 mt-8">
            <p className="text-sm">No running tasks</p>
          </div>
        )}

        {tasks.map((task) => (
          <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3">
            <div className="flex items-center justify-between mb-2">
              <p className="font-medium text-gray-800 text-sm">{task.name}</p>
              <span className="text-xs text-gray-500">{task.status}</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                style={{ width: task.progress + '%' }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
