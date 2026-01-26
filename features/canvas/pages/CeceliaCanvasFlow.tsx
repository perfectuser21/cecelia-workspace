/**
 * CeceliaCanvasFlow - React Flow 版本的语音画布
 * 使用 React Flow 实现可视化节点的自由拖拽布局
 */

import { useState, useCallback, useRef } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  NodeTypes,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { Mic, MicOff, Loader2, X } from 'lucide-react';
import { MermaidRenderer } from '../components/MermaidRenderer';
import { EChartsRenderer } from '../components/EChartsRenderer';
import { D3ForceRenderer } from '../components/D3ForceRenderer';
import type { EChartsOption } from 'echarts';

// 可用声音列表
const VOICES = [
  { id: 'alloy', name: 'Alloy', desc: '中性' },
  { id: 'shimmer', name: 'Shimmer', desc: '女声' },
  { id: 'echo', name: 'Echo', desc: '男声' },
  { id: 'coral', name: 'Coral', desc: '温暖' },
  { id: 'sage', name: 'Sage', desc: '沉稳' },
] as const;

type VoiceId = typeof VOICES[number]['id'];

// 基础图形节点
function ShapeNode({ data }: { data: { shape: string; color: string; text?: string; onDelete: () => void } }) {
  const shapes: Record<string, JSX.Element> = {
    circle: (
      <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center"
        style={{ borderColor: data.color, backgroundColor: `${data.color}20` }}>
        {data.text && <span className="text-sm font-medium" style={{ color: data.color }}>{data.text}</span>}
      </div>
    ),
    rectangle: (
      <div className="w-48 h-32 rounded-lg border-4 flex items-center justify-center"
        style={{ borderColor: data.color, backgroundColor: `${data.color}20` }}>
        {data.text && <span className="text-sm font-medium" style={{ color: data.color }}>{data.text}</span>}
      </div>
    ),
    ellipse: (
      <div className="w-48 h-32 rounded-full border-4 flex items-center justify-center"
        style={{ borderColor: data.color, backgroundColor: `${data.color}20` }}>
        {data.text && <span className="text-sm font-medium" style={{ color: data.color }}>{data.text}</span>}
      </div>
    ),
  };

  return (
    <div className="relative group">
      {shapes[data.shape] || shapes.rectangle}
      <button
        onClick={data.onDelete}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}

// 手绘/SVG 节点
function DrawingNode({ data }: { data: { svg: string; description: string; onDelete: () => void } }) {
  return (
    <div className="relative group">
      <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-600"
        style={{ minWidth: 200, minHeight: 200 }}>
        <div dangerouslySetInnerHTML={{ __html: data.svg }} />
        {data.description && (
          <p className="text-xs text-slate-400 mt-2 text-center">{data.description}</p>
        )}
      </div>
      <button
        onClick={data.onDelete}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}

// 文本节点
function TextNode({ data }: { data: { text: string; size: string; color: string; onDelete: () => void } }) {
  const sizeMap = {
    s: 'text-sm',
    m: 'text-base',
    l: 'text-lg',
    xl: 'text-2xl',
  };

  return (
    <div className="relative group">
      <div className={`px-4 py-2 rounded-lg bg-slate-800/80 backdrop-blur-sm border border-slate-600 ${sizeMap[data.size as keyof typeof sizeMap] || 'text-base'}`}
        style={{ color: data.color || '#f1f5f9' }}>
        {data.text}
      </div>
      <button
        onClick={data.onDelete}
        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center"
      >
        <X className="w-4 h-4 text-white" />
      </button>
    </div>
  );
}

// 自定义节点组件
function MermaidNode({ data }: { data: { content: string; onDelete: () => void } }) {
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 overflow-hidden" style={{ width: 600, height: 450 }}>
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border-b border-indigo-500/20">
        <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">流程图</span>
        <button onClick={data.onDelete} className="p-1 hover:bg-indigo-500/20 rounded transition-colors">
          <X className="w-4 h-4 text-indigo-400 hover:text-indigo-200" />
        </button>
      </div>
      <div className="w-full p-4" style={{ height: 'calc(100% - 52px)' }}>
        <MermaidRenderer content={data.content} onError={(err) => console.error('Mermaid error:', err)} />
      </div>
    </div>
  );
}

function ChartNode({ data }: { data: { config: EChartsOption; onDelete: () => void } }) {
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 overflow-hidden" style={{ width: 600, height: 450 }}>
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border-b border-indigo-500/20">
        <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">图表</span>
        <button onClick={data.onDelete} className="p-1 hover:bg-indigo-500/20 rounded transition-colors">
          <X className="w-4 h-4 text-indigo-400 hover:text-indigo-200" />
        </button>
      </div>
      <div className="w-full p-4" style={{ height: 'calc(100% - 52px)' }}>
        <EChartsRenderer config={data.config} />
      </div>
    </div>
  );
}

function NetworkNode({ data }: { data: { nodes: any[]; links: any[]; onDelete: () => void } }) {
  return (
    <div className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 overflow-hidden" style={{ width: 600, height: 450 }}>
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border-b border-indigo-500/20">
        <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">网络图</span>
        <button onClick={data.onDelete} className="p-1 hover:bg-indigo-500/20 rounded transition-colors">
          <X className="w-4 h-4 text-indigo-400 hover:text-indigo-200" />
        </button>
      </div>
      <div className="w-full p-4" style={{ height: 'calc(100% - 52px)' }}>
        <D3ForceRenderer nodes={data.nodes} links={data.links} />
      </div>
    </div>
  );
}

const nodeTypes: NodeTypes = {
  shapeNode: ShapeNode,
  textNode: TextNode,
  drawingNode: DrawingNode,
  mermaidNode: MermaidNode,
  chartNode: ChartNode,
  networkNode: NetworkNode,
};

// 画布工具定义
const CANVAS_TOOLS = [
  {
    type: 'function',
    name: 'canvas_draw_shape',
    description: '在画布上绘制基础图形（圆形、矩形、椭圆）。可以拖拽到任意位置。',
    parameters: {
      type: 'object',
      properties: {
        shape: {
          type: 'string',
          enum: ['circle', 'rectangle', 'ellipse'],
          description: '图形类型'
        },
        color: { type: 'string', description: '颜色（如 blue, red, green, #6366f1）', default: '#6366f1' },
        text: { type: 'string', description: '图形内的文字（可选）' }
      },
      required: ['shape']
    }
  },
  {
    type: 'function',
    name: 'canvas_add_text',
    description: '在画布上添加文本。可以拖拽到任意位置。',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '文本内容' },
        size: { type: 'string', enum: ['s', 'm', 'l', 'xl'], default: 'm', description: '字体大小' },
        color: { type: 'string', description: '文字颜色', default: '#f1f5f9' }
      },
      required: ['text']
    }
  },
  {
    type: 'function',
    name: 'canvas_draw_line',
    description: '在画布上绘制连接线。连接两个节点或创建自由线条。',
    parameters: {
      type: 'object',
      properties: {
        from: { type: 'string', description: '起点节点ID（可选，不提供则创建自由线条）' },
        to: { type: 'string', description: '终点节点ID（可选）' },
        label: { type: 'string', description: '线条上的标签文字（可选）' },
        color: { type: 'string', description: '线条颜色', default: '#6366f1' }
      }
    }
  },
  {
    type: 'function',
    name: 'canvas_draw_freehand',
    description: '绘制手绘风格的简单图形。例如：树、花、太阳、云朵、小动物轮廓等。使用 SVG 路径。',
    parameters: {
      type: 'object',
      properties: {
        shape: {
          type: 'string',
          enum: ['tree', 'flower', 'sun', 'cloud', 'star', 'heart', 'smiley'],
          description: '预设的简单图形'
        },
        description: { type: 'string', description: '图形描述（可选）' },
        color: { type: 'string', description: '颜色', default: '#10b981' }
      },
      required: ['shape']
    }
  },
  {
    type: 'function',
    name: 'render_mermaid',
    description: '在画布上添加 Mermaid 流程图。可以自由拖拽到任意位置。',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Mermaid 语法内容' }
      },
      required: ['content']
    }
  },
  {
    type: 'function',
    name: 'render_chart',
    description: '在画布上添加 ECharts 图表。可以自由拖拽到任意位置。',
    parameters: {
      type: 'object',
      properties: {
        type: { type: 'string', enum: ['line', 'bar', 'pie'], description: '图表类型' },
        data: { type: 'object', description: '图表数据' },
        title: { type: 'string', description: '图表标题' }
      },
      required: ['type', 'data']
    }
  },
  {
    type: 'function',
    name: 'render_network',
    description: '在画布上添加 D3 网络图。可以自由拖拽到任意位置。',
    parameters: {
      type: 'object',
      properties: {
        nodes: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string' },
              label: { type: 'string' },
              group: { type: 'number' }
            }
          }
        },
        links: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              source: { type: 'string' },
              target: { type: 'string' },
              value: { type: 'number' }
            }
          }
        }
      },
      required: ['nodes', 'links']
    }
  }
];

const SYSTEM_INSTRUCTIONS = `你是 Cecelia，主人的私人管家。

核心规则：
1. 主人说什么，立即执行，不要重复，不要确认，不要解释
2. 主人要求"模拟数据"或"随便"时，直接用合理的假数据，不要问细节
3. 回复只说"好的"或"完成"，不要啰嗦

你的工具：
- canvas_draw_shape - 画圆/矩形/椭圆
- canvas_add_text - 写文字
- canvas_draw_freehand - 画树/花/太阳/云/星星/爱心/笑脸
- render_mermaid - 画流程图/脑图
- render_chart - 画折线图/柱状图/饼图
- render_network - 画网络关系图

示例：
主人："显示30天营收趋势"
你：立即调用 render_chart，自动生成30天模拟数据，回复"完成"

主人："画个饼图"
你：立即调用 render_chart，自动生成3-5个分类的模拟数据，回复"好的"

主人："画一棵树"
你：立即调用 canvas_draw_freehand，回复"完成"

禁止：
- ❌ "您想要什么类型的数据？"
- ❌ "我来帮您绘制一个XXX"
- ❌ "这是一个XXX图表"
- ✅ 直接执行 + 回复"好的"或"完成"`;

export default function CeceliaCanvasFlow() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>('shimmer');

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // 节点计数器（用于自动布局）
  const nodeCountRef = useRef(0);

  // 删除节点
  const deleteNode = useCallback((nodeId: string) => {
    setNodes((nds) => nds.filter((n) => n.id !== nodeId));
  }, [setNodes]);

  // 碰撞检测 - 找一个不重叠的位置
  const findNonOverlappingPosition = useCallback((width: number, height: number): { x: number; y: number } => {
    const occupied = nodes.map(n => ({
      x: n.position.x,
      y: n.position.y,
      width: n.width || 600,
      height: n.height || 450,
    }));

    // 螺旋搜索空位
    const gridSize = 700; // 网格大小
    let radius = 0;
    const maxRadius = 10;

    while (radius < maxRadius) {
      for (let angle = 0; angle < 360; angle += 45) {
        const x = 100 + radius * gridSize * Math.cos(angle * Math.PI / 180);
        const y = 100 + radius * gridSize * Math.sin(angle * Math.PI / 180);

        // 检查是否与现有节点重叠
        const overlaps = occupied.some(rect => {
          return !(x + width < rect.x || x > rect.x + rect.width ||
                   y + height < rect.y || y > rect.y + rect.height);
        });

        if (!overlaps) {
          return { x, y };
        }
      }
      radius++;
    }

    // 如果都重叠，放在最右边
    return { x: 100 + nodeCountRef.current * 100, y: 100 };
  }, [nodes]);

  // 基础绘图工具
  const drawShape = useCallback((args: Record<string, unknown>) => {
    const { shape, color = '#6366f1', text } = args;
    if (!shape) {
      return { success: false, error: 'Missing required parameter: shape' };
    }

    const nodeId = `shape-${Date.now()}`;
    nodeCountRef.current++;
    const pos = findNonOverlappingPosition(200, 150);

    const newNode: Node = {
      id: nodeId,
      type: 'shapeNode',
      position: pos,
      data: {
        shape: shape as string,
        color: color as string,
        text: text as string | undefined,
        onDelete: () => deleteNode(nodeId),
      },
      draggable: true,
    };

    setNodes((nds) => [...nds, newNode]);
    return { success: true, node_id: nodeId, shape, color };
  }, [setNodes, deleteNode, findNonOverlappingPosition]);

  const addText = useCallback((args: Record<string, unknown>) => {
    const { text, size = 'm', color = '#f1f5f9' } = args;
    if (!text) {
      return { success: false, error: 'Missing required parameter: text' };
    }

    const nodeId = `text-${Date.now()}`;
    nodeCountRef.current++;
    const pos = findNonOverlappingPosition(300, 100);

    const newNode: Node = {
      id: nodeId,
      type: 'textNode',
      position: pos,
      data: {
        text: text as string,
        size: size as string,
        color: color as string,
        onDelete: () => deleteNode(nodeId),
      },
      draggable: true,
    };

    setNodes((nds) => [...nds, newNode]);
    return { success: true, node_id: nodeId, text };
  }, [setNodes, deleteNode, findNonOverlappingPosition]);

  const drawLine = useCallback((args: Record<string, unknown>) => {
    const { from, to, label, color = '#6366f1' } = args;

    if (!from || !to) {
      return { success: false, error: '需要指定起点和终点节点ID。先创建图形，再用连线连接。' };
    }

    const edgeId = `edge-${Date.now()}`;
    const newEdge: Edge = {
      id: edgeId,
      source: from as string,
      target: to as string,
      label: label as string | undefined,
      type: 'smoothstep',
      style: { stroke: color as string, strokeWidth: 2 },
      animated: true,
    };

    setEdges((eds) => [...eds, newEdge]);
    return { success: true, edge_id: edgeId, from, to };
  }, [setEdges]);

  const drawFreehand = useCallback((args: Record<string, unknown>) => {
    const { shape, description, color = '#10b981' } = args;
    if (!shape) {
      return { success: false, error: 'Missing required parameter: shape' };
    }

    // 预设简单图形的 SVG
    const svgShapes: Record<string, string> = {
      tree: `<svg viewBox="0 0 100 120" width="100" height="120">
        <rect x="40" y="80" width="20" height="40" fill="${color}" opacity="0.8"/>
        <circle cx="50" cy="60" r="35" fill="${color}"/>
        <circle cx="30" cy="50" r="25" fill="${color}" opacity="0.9"/>
        <circle cx="70" cy="50" r="25" fill="${color}" opacity="0.9"/>
      </svg>`,
      flower: `<svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="8" fill="${color}"/>
        <circle cx="50" cy="30" r="12" fill="${color}" opacity="0.7"/>
        <circle cx="70" cy="50" r="12" fill="${color}" opacity="0.7"/>
        <circle cx="50" cy="70" r="12" fill="${color}" opacity="0.7"/>
        <circle cx="30" cy="50" r="12" fill="${color}" opacity="0.7"/>
        <circle cx="35" cy="35" r="10" fill="${color}" opacity="0.6"/>
        <circle cx="65" cy="35" r="10" fill="${color}" opacity="0.6"/>
        <circle cx="65" cy="65" r="10" fill="${color}" opacity="0.6"/>
        <circle cx="35" cy="65" r="10" fill="${color}" opacity="0.6"/>
      </svg>`,
      sun: `<svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="20" fill="${color}"/>
        <line x1="50" y1="10" x2="50" y2="25" stroke="${color}" stroke-width="3"/>
        <line x1="50" y1="75" x2="50" y2="90" stroke="${color}" stroke-width="3"/>
        <line x1="10" y1="50" x2="25" y2="50" stroke="${color}" stroke-width="3"/>
        <line x1="75" y1="50" x2="90" y2="50" stroke="${color}" stroke-width="3"/>
        <line x1="20" y1="20" x2="32" y2="32" stroke="${color}" stroke-width="3"/>
        <line x1="68" y1="68" x2="80" y2="80" stroke="${color}" stroke-width="3"/>
        <line x1="80" y1="20" x2="68" y2="32" stroke="${color}" stroke-width="3"/>
        <line x1="32" y1="68" x2="20" y2="80" stroke="${color}" stroke-width="3"/>
      </svg>`,
      cloud: `<svg viewBox="0 0 120 60" width="120" height="60">
        <ellipse cx="30" cy="40" rx="25" ry="20" fill="${color}" opacity="0.8"/>
        <ellipse cx="60" cy="30" rx="30" ry="25" fill="${color}"/>
        <ellipse cx="90" cy="40" rx="25" ry="20" fill="${color}" opacity="0.8"/>
      </svg>`,
      star: `<svg viewBox="0 0 100 100" width="100" height="100">
        <path d="M50,10 L61,40 L92,40 L67,60 L78,90 L50,70 L22,90 L33,60 L8,40 L39,40 Z"
              fill="${color}" stroke="${color}" stroke-width="2"/>
      </svg>`,
      heart: `<svg viewBox="0 0 100 100" width="100" height="100">
        <path d="M50,85 C50,85 20,60 20,40 C20,25 30,20 40,25 C45,28 50,35 50,35 C50,35 55,28 60,25 C70,20 80,25 80,40 C80,60 50,85 50,85 Z"
              fill="${color}"/>
      </svg>`,
      smiley: `<svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="40" fill="${color}" opacity="0.2" stroke="${color}" stroke-width="3"/>
        <circle cx="35" cy="40" r="5" fill="${color}"/>
        <circle cx="65" cy="40" r="5" fill="${color}"/>
        <path d="M30,60 Q50,75 70,60" stroke="${color}" stroke-width="3" fill="none" stroke-linecap="round"/>
      </svg>`,
    };

    const svg = svgShapes[shape as string];
    if (!svg) {
      return { success: false, error: `Unknown shape: ${shape}. Available: tree, flower, sun, cloud, star, heart, smiley` };
    }

    const nodeId = `drawing-${Date.now()}`;
    nodeCountRef.current++;
    const pos = findNonOverlappingPosition(150, 150);

    const newNode: Node = {
      id: nodeId,
      type: 'drawingNode',
      position: pos,
      data: {
        svg,
        description: description as string || '',
        onDelete: () => deleteNode(nodeId),
      },
      draggable: true,
    };

    setNodes((nds) => [...nds, newNode]);
    return { success: true, node_id: nodeId, shape };
  }, [setNodes, deleteNode, findNonOverlappingPosition]);

  // Visualization tool handlers
  const renderMermaid = useCallback((args: Record<string, unknown>) => {
    const { content } = args;
    if (!content || typeof content !== 'string') {
      return { success: false, error: 'Invalid content parameter' };
    }

    const nodeId = `mermaid-${Date.now()}`;
    nodeCountRef.current++;
    const pos = findNonOverlappingPosition(600, 450);

    const newNode: Node = {
      id: nodeId,
      type: 'mermaidNode',
      position: pos,
      data: {
        content,
        onDelete: () => deleteNode(nodeId),
      },
      draggable: true,
    };

    setNodes((nds) => [...nds, newNode]);
    return { success: true, node_id: nodeId };
  }, [setNodes, deleteNode, findNonOverlappingPosition]);

  const renderChart = useCallback((args: Record<string, unknown>) => {
    const { type, data, title } = args;
    if (!type || !data) {
      return { success: false, error: 'Missing required parameters: type and data' };
    }

    let config: EChartsOption;
    const chartData = data as Record<string, unknown>;

    switch (type) {
      case 'line':
      case 'bar': {
        const xData = (chartData.xData as string[]) || ['A', 'B', 'C', 'D', 'E'];
        const yData = (chartData.yData as number[]) || [10, 20, 30, 40, 50];
        config = {
          title: title ? { text: title as string, textStyle: { color: '#f1f5f9' } } : undefined,
          xAxis: { type: 'category', data: xData },
          yAxis: { type: 'value' },
          series: [{ data: yData, type: type as 'line' | 'bar' }],
          backgroundColor: 'transparent'
        };
        break;
      }
      case 'pie': {
        // 修复饼图数据格式 - 支持多种格式
        let pieData: Array<{ name: string; value: number }>;

        if (chartData.pieData && Array.isArray(chartData.pieData)) {
          pieData = chartData.pieData as Array<{ name: string; value: number }>;
        } else if (Array.isArray(chartData.data)) {
          pieData = chartData.data as Array<{ name: string; value: number }>;
        } else if (chartData.labels && chartData.values) {
          // 兼容 labels + values 格式
          const labels = chartData.labels as string[];
          const values = chartData.values as number[];
          pieData = labels.map((label, i) => ({ name: label, value: values[i] || 0 }));
        } else {
          // 默认数据
          pieData = [
            { name: 'A', value: 335 },
            { name: 'B', value: 234 },
            { name: 'C', value: 123 }
          ];
        }

        config = {
          title: title ? { text: title as string, textStyle: { color: '#f1f5f9' } } : undefined,
          series: [{
            type: 'pie',
            data: pieData,
            radius: '60%',
            label: {
              color: '#f1f5f9'
            }
          }],
          backgroundColor: 'transparent'
        };
        break;
      }
      default:
        return { success: false, error: `Unsupported chart type: ${type}` };
    }

    const nodeId = `chart-${Date.now()}`;
    nodeCountRef.current++;
    const pos = findNonOverlappingPosition(600, 450);

    const newNode: Node = {
      id: nodeId,
      type: 'chartNode',
      position: pos,
      data: {
        config,
        onDelete: () => deleteNode(nodeId),
      },
      draggable: true,
    };

    setNodes((nds) => [...nds, newNode]);
    return { success: true, node_id: nodeId, chart_type: type };
  }, [setNodes, deleteNode, findNonOverlappingPosition]);

  const renderNetwork = useCallback((args: Record<string, unknown>) => {
    const { nodes, links } = args;
    if (!nodes || !links) {
      return { success: false, error: 'Missing required parameters: nodes and links' };
    }

    if (!Array.isArray(nodes) || !Array.isArray(links)) {
      return { success: false, error: 'nodes and links must be arrays' };
    }

    const nodeId = `network-${Date.now()}`;
    nodeCountRef.current++;
    const pos = findNonOverlappingPosition(600, 450);

    const newNode: Node = {
      id: nodeId,
      type: 'networkNode',
      position: pos,
      data: {
        nodes,
        links,
        onDelete: () => deleteNode(nodeId),
      },
      draggable: true,
    };

    setNodes((nds) => [...nds, newNode]);
    return { success: true, node_id: nodeId, nodes_count: nodes.length, links_count: links.length };
  }, [setNodes, deleteNode, findNonOverlappingPosition]);

  // Tool Call 处理器
  const handleToolCall = useCallback(async (toolName: string, args: Record<string, unknown>, callId: string) => {
    console.log('Tool call:', toolName, args);
    let result: unknown;

    switch (toolName) {
      case 'canvas_draw_shape':
        result = drawShape(args);
        break;
      case 'canvas_add_text':
        result = addText(args);
        break;
      case 'canvas_draw_line':
        result = drawLine(args);
        break;
      case 'canvas_draw_freehand':
        result = drawFreehand(args);
        break;
      case 'render_mermaid':
        result = renderMermaid(args);
        break;
      case 'render_chart':
        result = renderChart(args);
        break;
      case 'render_network':
        result = renderNetwork(args);
        break;
      default:
        result = { error: `Unknown tool: ${toolName}` };
    }

    // 回填工具结果
    if (dcRef.current && dcRef.current.readyState === 'open') {
      dcRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: {
          type: 'function_call_output',
          call_id: callId,
          output: JSON.stringify(result)
        }
      }));
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }

    return result;
  }, [drawShape, addText, drawLine, drawFreehand, renderMermaid, renderChart, renderNetwork]);

  // 启动语音（复用原有逻辑）
  const startListening = useCallback(async () => {
    if (isListening || isConnecting) return;

    setIsConnecting(true);
    setTranscript('正在连接...');
    setAiResponse('');

    try {
      const pc = new RTCPeerConnection({
        iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      });
      pcRef.current = pc;

      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;

      pc.ontrack = (e) => {
        audio.srcObject = e.streams[0];
      };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setIsConnecting(false);
        setIsListening(true);
        setTranscript('已连接，请说话...');

        const config = {
          type: 'session.update',
          session: {
            instructions: SYSTEM_INSTRUCTIONS,
            tools: CANVAS_TOOLS,
            tool_choice: 'auto',
            input_audio_transcription: { model: 'whisper-1' }
          }
        };
        dc.send(JSON.stringify(config));
      };

      dc.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === 'error') {
          console.error('Realtime error:', msg);
          setTranscript('错误: ' + (msg.error?.message || JSON.stringify(msg.error)));
        }

        if (msg.type === 'input_audio_buffer.speech_started') {
          setTranscript('正在听...');
          setAiResponse('');
        }

        if (msg.type === 'input_audio_buffer.speech_stopped') {
          setTranscript('处理中...');
        }

        if (msg.type === 'conversation.item.input_audio_transcription.completed') {
          setTranscript('你: ' + msg.transcript);
        }

        if (msg.type === 'response.output_audio_transcript.delta') {
          setAiResponse(prev => prev + (msg.delta || ''));
        }

        if (msg.type === 'response.function_call_arguments.done') {
          const { call_id, name, arguments: argsStr } = msg;
          try {
            const args = JSON.parse(argsStr);
            setTranscript(`正在执行: ${name}...`);
            handleToolCall(name, args, call_id);
          } catch (err) {
            console.error('Failed to parse function args:', err);
          }
        }
      };

      await pc.setLocalDescription();

      await new Promise<void>((resolve) => {
        if (pc.iceGatheringState === 'complete') {
          resolve();
        } else {
          pc.onicegatheringstatechange = () => {
            if (pc.iceGatheringState === 'complete') resolve();
          };
          setTimeout(resolve, 3000);
        }
      });

      const sdpResponse = await fetch('/api/cecelia/realtime-sdp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          model: 'gpt-4o-realtime-preview-2024-12-17',
        }),
      });

      const sdpData = await sdpResponse.json();
      if (!sdpData.success) {
        throw new Error(`SDP exchange failed: ${sdpData.error}`);
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: sdpData.sdp });

    } catch (err) {
      console.error('Failed to start voice:', err);
      setTranscript('启动失败: ' + (err instanceof Error ? err.message : String(err)));
      setIsConnecting(false);
      stopListening();
    }
  }, [isListening, isConnecting, handleToolCall]);

  const stopListening = useCallback(() => {
    dcRef.current?.close();
    dcRef.current = null;
    streamRef.current?.getTracks().forEach(track => track.stop());
    streamRef.current = null;
    pcRef.current?.close();
    pcRef.current = null;
    if (audioRef.current) {
      audioRef.current.srcObject = null;
      audioRef.current = null;
    }
    setIsListening(false);
    setIsConnecting(false);
  }, []);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column',
      backgroundColor: '#0f172a',
    }}>
      {/* React Flow 画布 */}
      <div style={{ flex: 1, position: 'relative' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          nodeTypes={nodeTypes}
          fitView
          style={{ backgroundColor: '#0f172a' }}
        >
          <Background color="#334155" gap={16} />
          <Controls />
        </ReactFlow>
      </div>

      {/* 底部控制栏 */}
      <div style={{
        height: 70,
        padding: '10px 16px',
        backgroundColor: '#0f172a',
        borderTop: '1px solid #334155',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        flexShrink: 0
      }}>
        {(transcript || aiResponse) && (
          <div style={{
            flex: 1,
            maxWidth: 400,
            padding: '6px 12px',
            backgroundColor: 'rgba(30, 41, 59, 0.9)',
            borderRadius: 8,
            fontSize: 12
          }}>
            {transcript && <span style={{ color: '#94a3b8' }}>{transcript}</span>}
            {aiResponse && <span style={{ color: '#c4b5fd', marginLeft: 8 }}>{aiResponse}</span>}
          </div>
        )}

        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isConnecting}
          style={{
            width: 50,
            height: 50,
            borderRadius: '50%',
            border: 'none',
            cursor: isConnecting ? 'wait' : 'pointer',
            backgroundColor: isListening ? '#ef4444' : isConnecting ? '#475569' : '#7c3aed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          {isConnecting ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : isListening ? (
            <MicOff className="w-6 h-6 text-white" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
