/**
 * CeceliaCanvas - 万能语音画布
 *
 * Phase 1: tldraw 自由画布 + 声音切换
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { Tldraw, Editor, createShapeId, TLShapeId } from '@tldraw/tldraw';
import '@tldraw/tldraw/tldraw.css';
import { Mic, MicOff, Loader2, X } from 'lucide-react';
import type { EChartsOption } from 'echarts';
import { MermaidRenderer } from '../components/MermaidRenderer';
import { EChartsRenderer } from '../components/EChartsRenderer';
import { D3ForceRenderer } from '../components/D3ForceRenderer';

// 可用声音列表
const VOICES = [
  { id: 'alloy', name: 'Alloy', desc: '中性' },
  { id: 'shimmer', name: 'Shimmer', desc: '女声' },
  { id: 'echo', name: 'Echo', desc: '男声' },
  { id: 'coral', name: 'Coral', desc: '温暖' },
  { id: 'sage', name: 'Sage', desc: '沉稳' },
] as const;

type VoiceId = typeof VOICES[number]['id'];

// 画布工具定义
const CANVAS_TOOLS = [
  {
    type: 'function',
    name: 'canvas_draw_shape',
    description: '在画布上绘制形状。支持矩形、圆形、箭头、线条等。',
    parameters: {
      type: 'object',
      properties: {
        shape: {
          type: 'string',
          enum: ['rectangle', 'ellipse', 'arrow', 'line', 'text'],
          description: '形状类型'
        },
        x: { type: 'number', description: 'X 坐标', default: 200 },
        y: { type: 'number', description: 'Y 坐标', default: 200 },
        width: { type: 'number', description: '宽度', default: 200 },
        height: { type: 'number', description: '高度', default: 100 },
        color: { type: 'string', description: '颜色', default: 'blue' },
        text: { type: 'string', description: '文本内容（用于 text 类型）' }
      },
      required: ['shape']
    }
  },
  {
    type: 'function',
    name: 'canvas_add_text',
    description: '在画布上添加文本',
    parameters: {
      type: 'object',
      properties: {
        text: { type: 'string', description: '文本内容' },
        x: { type: 'number', description: 'X 坐标', default: 200 },
        y: { type: 'number', description: 'Y 坐标', default: 200 },
        size: { type: 'string', enum: ['s', 'm', 'l', 'xl'], default: 'm' }
      },
      required: ['text']
    }
  },
  {
    type: 'function',
    name: 'canvas_draw_flowchart',
    description: '绘制流程图。提供节点和连接，自动布局。',
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
              type: { type: 'string', enum: ['start', 'end', 'process', 'decision'] }
            }
          },
          description: '节点列表'
        },
        edges: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              from: { type: 'string' },
              to: { type: 'string' },
              label: { type: 'string' }
            }
          },
          description: '连接列表'
        }
      },
      required: ['nodes', 'edges']
    }
  },
  {
    type: 'function',
    name: 'canvas_clear',
    description: '清空画布',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    type: 'function',
    name: 'render_mermaid',
    description: '渲染 Mermaid 图表（流程图、脑图、时序图）。切换到 Mermaid 渲染器显示图表。',
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
    description: '渲染 ECharts 图表。切换到 ECharts 渲染器显示统计图表。',
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
    description: '渲染 D3 力导向网络图。切换到 D3 渲染器显示网络关系图。',
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
          },
          description: '节点列表'
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
          },
          description: '连接列表'
        }
      },
      required: ['nodes', 'links']
    }
  },
  {
    type: 'function',
    name: 'query_viz_data',
    description: '查询可视化数据',
    parameters: {
      type: 'object',
      properties: {
        source: { type: 'string', description: '数据源（如 cecelia_runs, system_metrics）' },
        type: { type: 'string', description: '数据类型（如 timeline, stats, overview）' },
        range: { type: 'string', description: '时间范围（如 24h, 7d, 30d）' }
      },
      required: ['source', 'type']
    }
  },
  {
    type: 'function',
    name: 'cecelia_create_task',
    description: '创建开发任务',
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '任务标题' },
        description: { type: 'string', description: '任务描述' }
      },
      required: ['title', 'description']
    }
  },
  {
    type: 'function',
    name: 'cecelia_list_tasks',
    description: '列出所有任务',
    parameters: { type: 'object', properties: {}, required: [] }
  },
  {
    type: 'function',
    name: 'cecelia_health_check',
    description: '检查系统状态',
    parameters: { type: 'object', properties: {}, required: [] }
  }
];

const SYSTEM_INSTRUCTIONS = `你是 Cecelia，主人的私人管家。你运行在主人的 VPS 上，配合无限画布为主人服务。

你的能力：
1. 画布操作：canvas_draw_shape, canvas_add_text, canvas_draw_flowchart, canvas_clear
2. 可视化渲染：render_mermaid, render_chart, render_network
3. 数据查询：query_viz_data
4. 任务管理：cecelia_create_task, cecelia_list_tasks
5. 系统状态：cecelia_health_check

当主人想要可视化想法时：
- "画一个流程图" → 使用 render_mermaid 在画布上添加 Mermaid 流程图
- "显示柱状图/折线图/饼图" → 使用 render_chart 在画布上添加 ECharts 图表
- "画网络关系图" → 使用 render_network 在画布上添加 D3 力导向图
- "查询数据" → 使用 query_viz_data 获取数据
- "画一个矩形/圆形" → 使用 canvas_draw_shape (tldraw 画布)
- "写点文字" → 使用 canvas_add_text (tldraw 画布)
- "清空画布" → 使用 canvas_clear

Mermaid 示例：
- 流程图: "graph TD; A-->B; A-->C; B-->D; C-->D;"
- 脑图: "mindmap\\n  root((核心))\\n    A\\n    B\\n    C"
- 时序图: "sequenceDiagram\\n  A->>B: Hello\\n  B->>A: Hi"

ECharts 示例：
- 折线图: { xAxis: { type: 'category', data: ['Mon', 'Tue', 'Wed'] }, yAxis: { type: 'value' }, series: [{ data: [120, 200, 150], type: 'line' }] }
- 柱状图: { xAxis: { type: 'category', data: ['A', 'B', 'C'] }, yAxis: { type: 'value' }, series: [{ data: [10, 20, 30], type: 'bar' }] }
- 饼图: { series: [{ type: 'pie', data: [{ value: 335, name: 'A' }, { value: 234, name: 'B' }] }] }

D3 网络图示例：
- nodes: [{ id: '1', label: 'Node 1', group: 1 }, { id: '2', label: 'Node 2', group: 2 }]
- links: [{ source: '1', target: '2', value: 1 }]

规则：
- 必须通过工具执行操作
- 极简回复（"好的"、"完成"、"明白"），不要重复主人说的内容
- render_mermaid/render_chart/render_network 会在画布上添加可视化组件
- 多个可视化可以同时存在，可拖拽缩放`;

interface VizWidget {
  id: string;
  type: 'mermaid' | 'chart' | 'network';
  data: unknown;
  shapeId: TLShapeId; // 对应的 tldraw shape
}

export default function CeceliaCanvas() {
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [textInput, setTextInput] = useState('');
  const [selectedVoice, setSelectedVoice] = useState<VoiceId>('shimmer');
  const [showSettings, setShowSettings] = useState(false);
  const [editor, setEditor] = useState<Editor | null>(null);

  // Visualization widgets
  const [widgets, setWidgets] = useState<VizWidget[]>([]);

  // WebRTC refs
  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Editor ref - 解决闭包问题，确保回调始终使用最新的 editor
  const editorRef = useRef<Editor | null>(null);

  // 画布操作 - 使用 ref 获取最新的 editor
  const drawShape = useCallback((args: Record<string, unknown>) => {
    const currentEditor = editorRef.current;
    console.log('[drawShape] editorRef.current:', currentEditor, 'args:', args);
    if (!currentEditor) {
      console.error('[drawShape] Editor not ready!');
      return { success: false, error: 'Editor not ready' };
    }

    const { shape, x = 200, y = 200, width = 200, height = 100, color = 'blue', text } = args;
    const id = createShapeId();

    try {
      switch (shape) {
        case 'rectangle':
          currentEditor.createShape({
            id,
            type: 'geo',
            x: x as number,
            y: y as number,
            props: {
              geo: 'rectangle',
              w: width as number,
              h: height as number,
              color: color as string,
            }
          });
          currentEditor.zoomToFit({ animation: { duration: 200 } });
          break;
        case 'ellipse':
          console.log('[drawShape] Creating ellipse at', x, y, 'size', width, height);
          currentEditor.createShape({
            id,
            type: 'geo',
            x: x as number,
            y: y as number,
            props: {
              geo: 'ellipse',
              w: width as number,
              h: height as number,
              color: color as string,
            }
          });
          // 自动聚焦到新创建的形状
          currentEditor.zoomToFit({ animation: { duration: 200 } });
          console.log('[drawShape] Ellipse created with id:', id);
          // 验证形状是否真的创建了
          const shapes = currentEditor.getCurrentPageShapes();
          console.log('[drawShape] Current page shapes:', shapes.length, shapes);
          break;
        case 'text':
          currentEditor.createShape({
            id,
            type: 'text',
            x: x as number,
            y: y as number,
            props: {
              text: text as string || 'Text',
              color: color as string,
              size: 'm',
            }
          });
          break;
        case 'arrow':
          currentEditor.createShape({
            id,
            type: 'arrow',
            x: x as number,
            y: y as number,
            props: {
              color: color as string,
            }
          });
          break;
      }
      return { success: true, shape_id: id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, []); // 不依赖 editor state，使用 ref

  const addText = useCallback((args: Record<string, unknown>) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return { success: false, error: 'Editor not ready' };

    const { text, x = 200, y = 200, size = 'm' } = args;
    const id = createShapeId();

    try {
      currentEditor.createShape({
        id,
        type: 'text',
        x: x as number,
        y: y as number,
        props: {
          text: text as string,
          size: size as 's' | 'm' | 'l' | 'xl',
        }
      });
      return { success: true, shape_id: id };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, []);

  const drawFlowchart = useCallback((args: Record<string, unknown>) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return { success: false, error: 'Editor not ready' };

    const { nodes = [], edges = [] } = args as {
      nodes: Array<{ id: string; label: string; type?: string }>;
      edges: Array<{ from: string; to: string; label?: string }>;
    };

    const nodePositions = new Map<string, { x: number; y: number; shapeId: TLShapeId }>();
    const startX = 100;
    const startY = 100;
    const nodeWidth = 150;
    const nodeHeight = 60;
    const gapX = 200;
    const gapY = 120;

    try {
      // 创建节点
      nodes.forEach((node, index) => {
        const row = Math.floor(index / 3);
        const col = index % 3;
        const x = startX + col * gapX;
        const y = startY + row * gapY;
        const id = createShapeId();

        currentEditor.createShape({
          id,
          type: 'geo',
          x,
          y,
          props: {
            geo: node.type === 'decision' ? 'diamond' : 'rectangle',
            w: nodeWidth,
            h: nodeHeight,
            color: node.type === 'start' ? 'green' : node.type === 'end' ? 'red' : 'blue',
            text: node.label,
          }
        });

        nodePositions.set(node.id, { x: x + nodeWidth / 2, y: y + nodeHeight / 2, shapeId: id });
      });

      // 创建连线（使用箭头）
      edges.forEach((edge) => {
        const from = nodePositions.get(edge.from);
        const to = nodePositions.get(edge.to);
        if (from && to) {
          const arrowId = createShapeId();
          currentEditor.createShape({
            id: arrowId,
            type: 'arrow',
            props: {
              color: 'black',
              start: { x: from.x, y: from.y + nodeHeight / 2 },
              end: { x: to.x, y: to.y - nodeHeight / 2 },
            }
          });
        }
      });

      currentEditor.zoomToFit({ animation: { duration: 200 } });
      return { success: true, nodes_created: nodes.length, edges_created: edges.length };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, []);

  const clearCanvas = useCallback(() => {
    const currentEditor = editorRef.current;
    if (!currentEditor) return { success: false, error: 'Editor not ready' };

    try {
      const allShapeIds = currentEditor.getCurrentPageShapeIds();
      currentEditor.deleteShapes([...allShapeIds]);
      return { success: true };
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, []);

  // Visualization tool handlers
  const renderMermaid = useCallback((args: Record<string, unknown>) => {
    const { content } = args;
    if (!content || typeof content !== 'string') {
      return { success: false, error: 'Invalid content parameter' };
    }

    const newWidget: VizWidget = {
      id: `mermaid-${Date.now()}`,
      type: 'mermaid',
      data: content,
      shapeId: '' as TLShapeId, // placeholder
    };
    setWidgets(prev => [...prev, newWidget]);

    return { success: true, widget_id: newWidget.id };
  }, []);

  const renderChart = useCallback((args: Record<string, unknown>) => {
    const currentEditor = editorRef.current;
    if (!currentEditor) {
      return { success: false, error: 'Editor not ready' };
    }

    const { type, data, title } = args;
    if (!type || !data) {
      return { success: false, error: 'Missing required parameters: type and data' };
    }

    // Build ECharts config based on chart type
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
        const pieData = (chartData.pieData as Array<{ name: string; value: number }>) || [
          { name: 'A', value: 335 },
          { name: 'B', value: 234 }
        ];
        config = {
          title: title ? { text: title as string, textStyle: { color: '#f1f5f9' } } : undefined,
          series: [{ type: 'pie', data: pieData }],
          backgroundColor: 'transparent'
        };
        break;
      }
      default:
        return { success: false, error: `Unsupported chart type: ${type}` };
    }

    const shapeId = createShapeId();
    const newWidget: VizWidget = {
      id: `chart-${Date.now()}`,
      type: 'chart',
      data: config,
      shapeId,
    };
    setWidgets(prev => [...prev, newWidget]);

    return { success: true, widget_id: newWidget.id, chart_type: type };
  }, []);

  const renderNetwork = useCallback((args: Record<string, unknown>) => {
    const { nodes, links } = args;
    if (!nodes || !links) {
      return { success: false, error: 'Missing required parameters: nodes and links' };
    }

    if (!Array.isArray(nodes) || !Array.isArray(links)) {
      return { success: false, error: 'nodes and links must be arrays' };
    }

    const shapeId = createShapeId();
    const newWidget: VizWidget = {
      id: `network-${Date.now()}`,
      type: 'network',
      data: { nodes, links },
      shapeId,
    };
    setWidgets(prev => [...prev, newWidget]);

    return { success: true, widget_id: newWidget.id, nodes_count: nodes.length, links_count: links.length };
  }, []);

  const queryVizData = useCallback(async (args: Record<string, unknown>) => {
    const { source, type, range } = args;

    try {
      // Query data based on source
      if (source === 'cecelia_runs') {
        const res = await fetch('/api/cecelia/runs');
        const data = await res.json();
        return { success: true, source, data };
      } else if (source === 'system_metrics') {
        const res = await fetch('/api/cecelia/health');
        const data = await res.json();
        return { success: true, source, data };
      } else {
        return { success: false, error: `Unknown data source: ${source}` };
      }
    } catch (err) {
      return { success: false, error: String(err) };
    }
  }, []);

  // Tool Call 处理器
  const handleToolCall = useCallback(async (toolName: string, args: Record<string, unknown>, callId: string) => {
    console.log('Tool call:', toolName, args);
    console.log('[handleToolCall] drawShape function:', typeof drawShape, drawShape);
    let result: unknown;

    switch (toolName) {
      case 'canvas_draw_shape':
        console.log('[handleToolCall] Calling drawShape...');
        result = drawShape(args);
        console.log('[handleToolCall] drawShape result:', result);
        break;
      case 'canvas_add_text':
        result = addText(args);
        break;
      case 'canvas_draw_flowchart':
        result = drawFlowchart(args);
        break;
      case 'canvas_clear':
        result = clearCanvas();
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
      case 'query_viz_data':
        result = await queryVizData(args);
        break;
      case 'cecelia_create_task': {
        const res = await fetch('/api/cecelia/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(args)
        });
        result = await res.json();
        break;
      }
      case 'cecelia_list_tasks': {
        const res = await fetch('/api/cecelia/runs');
        result = await res.json();
        break;
      }
      case 'cecelia_health_check': {
        const res = await fetch('/api/cecelia/health');
        result = await res.json();
        break;
      }
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
  }, [drawShape, addText, drawFlowchart, clearCanvas, renderMermaid, renderChart, renderNetwork, queryVizData]);

  // 启动语音
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

        // 发送配置 - 使用 OpenAI Realtime API 正确格式
        const config = {
          type: 'session.update',
          session: {
            instructions: SYSTEM_INSTRUCTIONS,
            tools: CANVAS_TOOLS,
            tool_choice: 'auto',
            input_audio_transcription: { model: 'whisper-1' }
          }
        };
        console.log('[Cecelia] session.update:', JSON.stringify(config, null, 2));
        dc.send(JSON.stringify(config));
      };

      dc.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        // 调试：显示所有消息类型
        console.log('[Cecelia] 收到消息:', msg.type);

        // 显示完整消息（用于调试）
        if (msg.type.includes('session') || msg.type.includes('error') || msg.type.includes('function') || msg.type.includes('response')) {
          console.log('[Cecelia] 详情:', msg);
        }

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

      // 使用服务器端 SDP 交换（避免 CORS 和认证问题）
      const sdpResponse = await fetch('/api/cecelia/realtime-sdp', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          sdp: pc.localDescription?.sdp,
          model: 'gpt-4o-realtime-preview-2024-12-17',
        }),
      });

      const sdpData = await sdpResponse.json();
      if (!sdpData.success) {
        console.error('SDP exchange error:', sdpData.error);
        throw new Error(`SDP exchange failed: ${sdpData.error}`);
      }

      const answerSdp = sdpData.sdp;
      await pc.setRemoteDescription({ type: 'answer', sdp: answerSdp });

    } catch (err) {
      console.error('Failed to start voice:', err);
      setTranscript('启动失败: ' + (err instanceof Error ? err.message : String(err)));
      setIsConnecting(false);
      stopListening();
    }
  }, [isListening, isConnecting, selectedVoice, handleToolCall]);

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

  // 文本输入
  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim() || !dcRef.current || dcRef.current.readyState !== 'open') return;

    dcRef.current.send(JSON.stringify({
      type: 'conversation.item.create',
      item: {
        type: 'message',
        role: 'user',
        content: [{ type: 'input_text', text: textInput }],
      }
    }));
    dcRef.current.send(JSON.stringify({ type: 'response.create' }));

    setTranscript('你: ' + textInput);
    setAiResponse('');
    setTextInput('');
  }, [textInput]);

  // 切换声音（需要重新连接）
  const handleVoiceChange = useCallback((voice: VoiceId) => {
    setSelectedVoice(voice);
    if (isListening) {
      // 如果正在连接，发送 session.update 更新声音
      if (dcRef.current && dcRef.current.readyState === 'open') {
        dcRef.current.send(JSON.stringify({
          type: 'session.update',
          session: {
            audio: {
              output: { voice }
            }
          }
        }));
      }
    }
    setShowSettings(false);
  }, [isListening]);

  // 调试：检查是什么覆盖了画布
  console.log('[CeceliaCanvas] Render - transcript:', transcript, 'aiResponse:', aiResponse, 'isListening:', isListening);

  return (
    <div style={{
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* 可视化区域 - 占据剩余空间 */}
      <div style={{ flex: 1, position: 'relative' }}>
        {/* tldraw 底层画布 */}
        <Tldraw
          onMount={(e) => {
            console.log('[Tldraw] Editor mounted');
            editorRef.current = e;
            setEditor(e);
          }}
        />

        {/* Widgets Overlay - 简化为固定2列 */}
        {widgets.length > 0 && (
          <div
            style={{
              position: 'absolute',
              top: 40,
              left: 40,
              right: 40,
              bottom: 80,
              pointerEvents: 'none',
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)', // 固定2列
              gap: '24px',
              alignContent: 'start',
            }}
          >
            {widgets.map((widget) => (
              <div
                key={widget.id}
                className="bg-slate-900/95 backdrop-blur-xl rounded-2xl shadow-2xl border border-indigo-500/30 overflow-hidden"
                style={{
                  pointerEvents: 'auto',
                  height: '450px',
                }}
              >
                {/* Widget header */}
                <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-r from-indigo-950/80 to-purple-950/80 border-b border-indigo-500/20">
                  <span className="text-xs font-semibold text-indigo-300 uppercase tracking-wider">
                    {widget.type === 'mermaid' ? '流程图' : widget.type === 'chart' ? '图表' : '网络图'}
                  </span>
                  <button
                    onClick={() => setWidgets(prev => prev.filter(w => w.id !== widget.id))}
                    className="p-1 hover:bg-indigo-500/20 rounded transition-colors"
                  >
                    <X className="w-4 h-4 text-indigo-400 hover:text-indigo-200" />
                  </button>
                </div>

                {/* Widget content */}
                <div className="w-full h-full p-4" style={{ height: 'calc(100% - 52px)' }}>
                  {widget.type === 'mermaid' && (
                    <MermaidRenderer
                      content={widget.data as string}
                      onError={(err) => console.error('Mermaid error:', err)}
                    />
                  )}
                  {widget.type === 'chart' && (
                    <EChartsRenderer config={widget.data as EChartsOption} />
                  )}
                  {widget.type === 'network' && (
                    <D3ForceRenderer
                      nodes={(widget.data as { nodes: Array<{ id: string; label: string; group?: number }> }).nodes}
                      links={(widget.data as { links: Array<{ source: string; target: string; value?: number }> }).links}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 底部控制栏 - 固定高度 */}
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
        {/* 对话显示 */}
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

        {/* 麦克风按钮 */}
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
