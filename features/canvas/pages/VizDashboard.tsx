/**
 * VizDashboard - 可视化仪表盘
 */
import { useState, lazy, Suspense, Component, ErrorInfo, ReactNode } from 'react';
import { Plus, BarChart3, GitBranch, Network, Loader2, AlertTriangle } from 'lucide-react';

// Error Boundary for catching rendering errors
interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class WidgetErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Widget error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div className="flex items-center justify-center h-full bg-red-900/20 p-4">
          <div className="text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mx-auto mb-2" />
            <div className="text-red-400 text-sm">渲染错误</div>
            <div className="text-red-300 text-xs mt-1 max-w-xs truncate">{this.state.error?.message}</div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// Lazy load renderers
const EChartsRenderer = lazy(() => import('../components/EChartsRenderer').then(m => ({ default: m.EChartsRenderer })));
const D3ForceRenderer = lazy(() => import('../components/D3ForceRenderer').then(m => ({ default: m.D3ForceRenderer })));

type WidgetType = 'mermaid' | 'chart' | 'network';

interface Widget {
  id: string;
  type: WidgetType;
  title: string;
  data: any;
}

// Demo data
const DEMO_WIDGETS: Widget[] = [
  {
    id: 'chart-1',
    type: 'chart',
    title: '数据图表',
    data: {
      xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] },
      yAxis: { type: 'value' },
      series: [{ data: [820, 932, 901, 934, 1290, 1330, 1320], type: 'line', smooth: true }]
    }
  },
  {
    id: 'network-1',
    type: 'network',
    title: '网络关系图',
    data: {
      nodes: [
        { id: 'A', label: 'Node A', group: 1 },
        { id: 'B', label: 'Node B', group: 1 },
        { id: 'C', label: 'Node C', group: 2 },
        { id: 'D', label: 'Node D', group: 2 },
      ],
      links: [
        { source: 'A', target: 'B', value: 1 },
        { source: 'A', target: 'C', value: 2 },
        { source: 'B', target: 'D', value: 1 },
        { source: 'C', target: 'D', value: 3 },
      ]
    }
  }
];

function WidgetLoading() {
  return (
    <div className="flex items-center justify-center h-full bg-slate-800">
      <Loader2 className="w-8 h-8 text-slate-400 animate-spin" />
    </div>
  );
}

function WidgetContent({ widget }: { widget: Widget }) {
  // Mermaid disabled due to React compatibility issues
  if (widget.type === 'mermaid') {
    return (
      <div className="flex items-center justify-center h-full bg-slate-800/50">
        <div className="text-center">
          <div className="text-4xl mb-2">📋</div>
          <div className="text-slate-400 text-sm">Mermaid 流程图</div>
          <div className="text-slate-500 text-xs mt-1">暂不支持</div>
        </div>
      </div>
    );
  }

  return (
    <WidgetErrorBoundary>
      <Suspense fallback={<WidgetLoading />}>
        {widget.type === 'chart' && <EChartsRenderer config={widget.data} />}
        {widget.type === 'network' && <D3ForceRenderer nodes={widget.data.nodes} links={widget.data.links} />}
      </Suspense>
    </WidgetErrorBoundary>
  );
}

export function VizDashboard() {
  const [widgets, setWidgets] = useState<Widget[]>(DEMO_WIDGETS);

  const addWidget = (type: WidgetType) => {
    const id = `${type}-${Date.now()}`;
    let newWidget: Widget;

    switch (type) {
      case 'mermaid':
        newWidget = { id, type, title: '新流程图', data: 'flowchart TD\n    A[开始] --> B[结束]' };
        break;
      case 'chart':
        newWidget = {
          id, type, title: '新图表',
          data: {
            xAxis: { type: 'category', data: ['A', 'B', 'C', 'D', 'E'] },
            yAxis: { type: 'value' },
            series: [{ data: [100, 200, 150, 300, 250], type: 'bar' }]
          }
        };
        break;
      case 'network':
        newWidget = {
          id, type, title: '新网络图',
          data: {
            nodes: [
              { id: '1', label: 'Node 1', group: 1 },
              { id: '2', label: 'Node 2', group: 1 },
              { id: '3', label: 'Node 3', group: 2 }
            ],
            links: [
              { source: '1', target: '2', value: 1 },
              { source: '2', target: '3', value: 2 }
            ]
          }
        };
        break;
    }

    setWidgets([...widgets, newWidget!]);
  };

  const removeWidget = (id: string) => {
    setWidgets(widgets.filter(w => w.id !== id));
  };

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Header */}
      <div className="px-6 py-4 border-b border-slate-800 bg-slate-900 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-100">Visualization Dashboard</h1>
          <p className="text-sm text-slate-400 mt-1">实时可视化仪表盘</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => addWidget('mermaid')}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600/50 text-blue-200 rounded-lg text-sm cursor-not-allowed"
            disabled
            title="Mermaid 暂不支持"
          >
            <GitBranch size={16} /> 流程图
          </button>
          <button
            onClick={() => addWidget('chart')}
            className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg text-sm"
          >
            <BarChart3 size={16} /> 图表
          </button>
          <button
            onClick={() => addWidget('network')}
            className="flex items-center gap-2 px-3 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm"
          >
            <Network size={16} /> 网络图
          </button>
        </div>
      </div>

      {/* Widgets Grid */}
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {widgets.map(widget => (
          <div
            key={widget.id}
            className="bg-slate-900 border border-slate-700 rounded-xl overflow-hidden"
          >
            {/* Widget Header */}
            <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between bg-slate-800">
              <h3 className="text-sm font-medium text-slate-200">{widget.title}</h3>
              <button
                onClick={() => removeWidget(widget.id)}
                className="text-slate-400 hover:text-red-400 text-xs"
              >
                删除
              </button>
            </div>
            {/* Widget Content */}
            <div className="h-80">
              <WidgetContent widget={widget} />
            </div>
          </div>
        ))}

        {widgets.length === 0 && (
          <div className="col-span-full flex items-center justify-center h-96">
            <div className="text-center">
              <Plus className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <div className="text-slate-400 text-lg mb-2">暂无组件</div>
              <div className="text-slate-500 text-sm">点击上方按钮添加可视化组件</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default VizDashboard;
