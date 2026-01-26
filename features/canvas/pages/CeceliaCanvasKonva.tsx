import { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, { Node, Controls, Background, MiniMap, useNodesState, NodeTypes } from 'reactflow';
import 'reactflow/dist/style.css';
import { Mic, MicOff, Loader2, Maximize, Minimize } from 'lucide-react';
import { EChartsRenderer } from '../components/EChartsRenderer';
import { MermaidRenderer } from '../components/MermaidRenderer';

const SYSTEM_INSTRUCTIONS = `你是 Cecelia。主人说什么立即执行，回复"好的"或"完成"。

数据格式示例：
- 饼图: render_chart({ type: "pie", data: { pieData: [{ name: "A", value: 100 }, { name: "B", value: 200 }] }, title: "标题" })
- 柱状图: render_chart({ type: "bar", data: { labels: ["1月","2月"], values: [100,200] }, title: "标题" })
- 折线图: render_chart({ type: "line", data: { labels: ["周一","周二"], values: [150,230] }, title: "标题" })
- 手绘图形: canvas_draw_freehand({ shape: "tree", color: "#10b981" })

可用工具：canvas_draw_shape, canvas_add_text, render_chart, render_mermaid, canvas_draw_freehand

主人："画个饼图" → 直接用示例格式调用，回复"好的"
主人："画棵树" → canvas_draw_freehand({ shape: "tree" })，回复"好的"`;

const CANVAS_TOOLS = [
  {
    type: 'function',
    name: 'canvas_draw_shape',
    description: '画基础图形（圆形或矩形）',
    parameters: {
      type: 'object',
      properties: {
        shape: { type: 'string', enum: ['circle', 'rectangle'], description: '图形类型' },
        color: { type: 'string', default: '#6366f1', description: '颜色（十六进制）' },
        text: { type: 'string', description: '图形内的文字（可选）' }
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
        text: { type: 'string', description: '要显示的文本内容' },
        size: { type: 'string', enum: ['s', 'm', 'l', 'xl'], default: 'm', description: '字体大小' }
      },
      required: ['text']
    }
  },
  {
    type: 'function',
    name: 'render_chart',
    description: '画图表（饼图/柱状图/折线图）。数据格式：饼图用pieData数组，柱状图/折线图用labels+values数组',
    parameters: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['line', 'bar', 'pie'],
          description: '图表类型：line=折线图，bar=柱状图，pie=饼图'
        },
        data: {
          type: 'object',
          description: '图表数据。饼图格式：{ pieData: [{ name: "分类名", value: 数值 }] }。柱状图/折线图格式：{ labels: ["标签1","标签2"], values: [数值1,数值2] }'
        },
        title: {
          type: 'string',
          description: '图表标题（可选）'
        }
      },
      required: ['type', 'data']
    }
  },
  {
    type: 'function',
    name: 'render_mermaid',
    description: '画Mermaid流程图/脑图',
    parameters: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Mermaid语法内容，例如: graph TD; A-->B; B-->C;' }
      },
      required: ['content']
    }
  },
  {
    type: 'function',
    name: 'canvas_draw_freehand',
    description: '绘制手绘风格的简单图形，例如：树、花、太阳、云朵、星星、爱心、笑脸',
    parameters: {
      type: 'object',
      properties: {
        shape: {
          type: 'string',
          enum: ['tree', 'flower', 'sun', 'cloud', 'star', 'heart', 'smiley'],
          description: '预设的简单图形类型'
        },
        description: { type: 'string', description: '图形描述（可选）' },
        color: { type: 'string', description: '颜色（十六进制）', default: '#10b981' }
      },
      required: ['shape']
    }
  }
];

function ShapeNode({ data }: any) {
  if (data.shape === 'circle') {
    return (
      <div className="w-32 h-32 rounded-full border-4 flex items-center justify-center nodrag"
        style={{ borderColor: data.color, backgroundColor: `${data.color}20` }}>
        {data.text && <span className="text-sm font-medium" style={{ color: data.color }}>{data.text}</span>}
      </div>
    );
  }
  return (
    <div className="w-48 h-32 rounded-lg border-4 flex items-center justify-center nodrag"
      style={{ borderColor: data.color, backgroundColor: `${data.color}20` }}>
      {data.text && <span className="text-sm font-medium" style={{ color: data.color }}>{data.text}</span>}
    </div>
  );
}

function TextNode({ data }: any) {
  const sizeMap = { s: 'text-sm', m: 'text-base', l: 'text-2xl', xl: 'text-4xl' };
  return (
    <div className={`${sizeMap[data.size as keyof typeof sizeMap] || 'text-base'} font-medium nodrag`}
      style={{ color: data.color }}>
      {data.text}
    </div>
  );
}

function DrawingNode({ data }: any) {
  return (
    <div className="bg-slate-800/50 backdrop-blur-sm rounded-lg p-4 border border-slate-600 nodrag"
      style={{ minWidth: 200, minHeight: 200 }}>
      <div dangerouslySetInnerHTML={{ __html: data.svg }} />
      {data.description && (
        <p className="text-xs text-slate-400 mt-2 text-center">{data.description}</p>
      )}
    </div>
  );
}

function ChartNode({ data }: any) {
  const { chartType, chartData, title } = data;

  // 构建 ECharts 配置
  let config: any = {
    backgroundColor: 'transparent',
    title: { text: title || '', left: 'center', textStyle: { color: '#f1f5f9' } },
    tooltip: {},
    grid: { left: '10%', right: '10%', top: '20%', bottom: '10%' },
  };

  if (chartType === 'pie') {
    let pieData: Array<{ name: string; value: number }>;
    if (chartData.pieData && Array.isArray(chartData.pieData)) {
      pieData = chartData.pieData;
    } else if (Array.isArray(chartData.data)) {
      pieData = chartData.data;
    } else if (chartData.labels && chartData.values) {
      pieData = chartData.labels.map((label: string, i: number) => ({
        name: label,
        value: chartData.values[i] || 0
      }));
    } else {
      pieData = [{ name: 'A', value: 335 }, { name: 'B', value: 234 }, { name: 'C', value: 123 }];
    }

    config.tooltip = { trigger: 'item' };
    config.series = [{ type: 'pie', radius: '60%', data: pieData, label: { color: '#f1f5f9' } }];
  } else if (chartType === 'line' || chartType === 'bar') {
    const labels = chartData.labels || chartData.categories || ['1月', '2月', '3月', '4月', '5月'];
    const values = chartData.values || chartData.data || [120, 200, 150, 80, 70];

    config.tooltip = { trigger: 'axis' };
    config.xAxis = { type: 'category', data: labels, axisLabel: { color: '#94a3b8' } };
    config.yAxis = { type: 'value', axisLabel: { color: '#94a3b8' } };
    config.series = [{ type: chartType, data: values, itemStyle: { color: '#6366f1' } }];
  }

  return (
    <div className="bg-slate-900/95 rounded-xl border border-slate-700 p-4 nodrag" style={{ width: 500, height: 400 }}>
      <EChartsRenderer config={config} />
    </div>
  );
}

function MermaidNode({ data }: any) {
  return (
    <div className="bg-slate-900/95 rounded-xl border border-slate-700 p-4 nodrag" style={{ width: 500, height: 400 }}>
      <MermaidRenderer content={data.content} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  shape: ShapeNode,
  text: TextNode,
  chart: ChartNode,
  mermaid: MermaidNode,
  drawing: DrawingNode,
};

export default function CeceliaCanvasKonva() {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [isListening, setIsListening] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  const pcRef = useRef<RTCPeerConnection | null>(null);
  const dcRef = useRef<RTCDataChannel | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const nodeCountRef = useRef(0);

  // 碰撞检测 - 3列网格，绝对不重叠
  const findNonOverlappingPosition = useCallback((currentNodes: Node[]) => {
    const cols = 3;
    const cellWidth = 700;
    const cellHeight = 550;
    const padding = 50;

    for (let row = 0; row < 20; row++) {
      for (let col = 0; col < cols; col++) {
        const x = padding + col * cellWidth;
        const y = padding + row * cellHeight;

        const occupied = currentNodes.some(n => {
          const nodeX = n.position.x;
          const nodeY = n.position.y;
          return Math.abs(nodeX - x) < 600 && Math.abs(nodeY - y) < 500;
        });

        if (!occupied) {
          return { x, y };
        }
      }
    }

    return { x: padding, y: padding + currentNodes.length * cellHeight };
  }, []);

  const drawShape = useCallback((args: any) => {
    const { shape, color = '#6366f1', text } = args;
    if (!shape) return { success: false };

    const id = `shape-${Date.now()}`;
    nodeCountRef.current++;

    setNodes(prev => {
      const pos = findNonOverlappingPosition(prev);
      const newNode: Node = {
        id,
        type: 'shape',
        position: pos,
        data: { shape, color, text },
      };
      return [...prev, newNode];
    });

    return { success: true, element_id: id };
  }, [setNodes, findNonOverlappingPosition]);

  const addText = useCallback((args: any) => {
    const { text, size = 'm' } = args;
    if (!text) return { success: false };

    const id = `text-${Date.now()}`;
    nodeCountRef.current++;

    setNodes(prev => {
      const pos = findNonOverlappingPosition(prev);
      const newNode: Node = {
        id,
        type: 'text',
        position: pos,
        data: { text, size, color: '#f1f5f9' },
      };
      return [...prev, newNode];
    });

    return { success: true, element_id: id };
  }, [setNodes, findNonOverlappingPosition]);

  const renderChart = useCallback((args: any) => {
    console.log('📊 renderChart called with args:', JSON.stringify(args, null, 2));
    const { type, data, title } = args;
    if (!type || !data) {
      console.error('❌ renderChart failed: missing type or data', { type, data });
      return { success: false, error: 'Missing type or data' };
    }

    const id = `chart-${Date.now()}`;
    nodeCountRef.current++;

    console.log('✅ Creating chart node:', { id, type, dataKeys: Object.keys(data), title });

    setNodes(prev => {
      const pos = findNonOverlappingPosition(prev);
      const newNode: Node = {
        id,
        type: 'chart',
        position: pos,
        data: { chartType: type, chartData: data, title },
      };
      console.log('📍 Chart position:', pos, 'Total nodes:', prev.length + 1);
      return [...prev, newNode];
    });

    return { success: true, element_id: id };
  }, [setNodes, findNonOverlappingPosition]);

  const renderMermaid = useCallback((args: any) => {
    const { content } = args;
    if (!content) return { success: false };

    const id = `mermaid-${Date.now()}`;
    nodeCountRef.current++;

    setNodes(prev => {
      const pos = findNonOverlappingPosition(prev);
      const newNode: Node = {
        id,
        type: 'mermaid',
        position: pos,
        data: { content },
      };
      return [...prev, newNode];
    });

    return { success: true, element_id: id };
  }, [setNodes, findNonOverlappingPosition]);

  const drawFreehand = useCallback((args: any) => {
    const { shape, description, color = '#10b981' } = args;
    if (!shape) return { success: false };

    // SVG图形定义
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
        <line x1="20" y1="20" x2="30" y2="30" stroke="${color}" stroke-width="3"/>
        <line x1="70" y1="70" x2="80" y2="80" stroke="${color}" stroke-width="3"/>
        <line x1="80" y1="20" x2="70" y2="30" stroke="${color}" stroke-width="3"/>
        <line x1="30" y1="70" x2="20" y2="80" stroke="${color}" stroke-width="3"/>
      </svg>`,
      cloud: `<svg viewBox="0 0 120 60" width="120" height="60">
        <ellipse cx="30" cy="40" rx="25" ry="20" fill="${color}" opacity="0.8"/>
        <ellipse cx="60" cy="30" rx="30" ry="25" fill="${color}" opacity="0.9"/>
        <ellipse cx="90" cy="40" rx="25" ry="20" fill="${color}" opacity="0.8"/>
      </svg>`,
      star: `<svg viewBox="0 0 100 100" width="100" height="100">
        <polygon points="50,10 61,35 88,35 67,52 75,78 50,62 25,78 33,52 12,35 39,35" fill="${color}"/>
      </svg>`,
      heart: `<svg viewBox="0 0 100 100" width="100" height="100">
        <path d="M50,85 C50,85 20,60 20,40 C20,25 30,15 40,15 C45,15 50,20 50,20 C50,20 55,15 60,15 C70,15 80,25 80,40 C80,60 50,85 50,85 Z" fill="${color}"/>
      </svg>`,
      smiley: `<svg viewBox="0 0 100 100" width="100" height="100">
        <circle cx="50" cy="50" r="40" fill="${color}" opacity="0.8"/>
        <circle cx="35" cy="40" r="5" fill="#fff"/>
        <circle cx="65" cy="40" r="5" fill="#fff"/>
        <path d="M 30,60 Q 50,75 70,60" stroke="#fff" stroke-width="3" fill="none"/>
      </svg>`
    };

    const svg = svgShapes[shape] || svgShapes.star;
    const id = `drawing-${Date.now()}`;
    nodeCountRef.current++;

    setNodes(prev => {
      const pos = findNonOverlappingPosition(prev);
      const newNode: Node = {
        id,
        type: 'drawing',
        position: pos,
        data: { svg, description },
      };
      return [...prev, newNode];
    });

    return { success: true, element_id: id };
  }, [setNodes, findNonOverlappingPosition]);

  const handleToolCall = useCallback(async (toolName: string, args: any, callId: string) => {
    console.log('Tool call:', toolName, args);
    let result: any;

    switch (toolName) {
      case 'canvas_draw_shape':
        result = drawShape(args);
        break;
      case 'canvas_add_text':
        result = addText(args);
        break;
      case 'render_chart':
        result = renderChart(args);
        break;
      case 'render_mermaid':
        result = renderMermaid(args);
        break;
      case 'canvas_draw_freehand':
        result = drawFreehand(args);
        break;
      default:
        result = { error: `Unknown tool: ${toolName}` };
    }

    if (dcRef.current && dcRef.current.readyState === 'open') {
      dcRef.current.send(JSON.stringify({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: callId, output: JSON.stringify(result) }
      }));
      dcRef.current.send(JSON.stringify({ type: 'response.create' }));
    }

    return result;
  }, [drawShape, addText, renderChart, renderMermaid, drawFreehand]);

  const startListening = useCallback(async () => {
    if (isListening || isConnecting) return;

    setIsConnecting(true);
    setTranscript('正在连接...');

    try {
      const pc = new RTCPeerConnection({ iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] });
      pcRef.current = pc;

      const audio = document.createElement('audio');
      audio.autoplay = true;
      audioRef.current = audio;
      pc.ontrack = (e) => { audio.srcObject = e.streams[0]; };

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      pc.addTrack(stream.getTracks()[0]);

      const dc = pc.createDataChannel('oai-events');
      dcRef.current = dc;

      dc.onopen = () => {
        setIsConnecting(false);
        setIsListening(true);
        setTranscript('已连接');

        dc.send(JSON.stringify({
          type: 'session.update',
          session: {
            instructions: SYSTEM_INSTRUCTIONS,
            tools: CANVAS_TOOLS,
            tool_choice: 'auto',
            input_audio_transcription: { model: 'whisper-1' }
          }
        }));
      };

      dc.onmessage = (e) => {
        const msg = JSON.parse(e.data);

        if (msg.type === 'error') {
          console.error('Realtime error:', msg);
          setTranscript('错误: ' + (msg.error?.message || ''));
        }

        if (msg.type === 'input_audio_buffer.speech_started') {
          setTranscript('正在听...');
          setAiResponse('');
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
            setTranscript(`执行: ${name}`);
            handleToolCall(name, args, call_id);
          } catch (err) {
            console.error('Parse error:', err);
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
        throw new Error(`SDP failed: ${sdpData.error}`);
      }

      await pc.setRemoteDescription({ type: 'answer', sdp: sdpData.sdp });

    } catch (err) {
      console.error('Failed:', err);
      setTranscript('失败: ' + (err instanceof Error ? err.message : String(err)));
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

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // 键盘快捷键 (F = 全屏)
  useEffect(() => {
    const handleKeyPress = (e: KeyboardEvent) => {
      if (e.key === 'f' || e.key === 'F') {
        if (!e.ctrlKey && !e.metaKey && !e.altKey) {
          const target = e.target as HTMLElement;
          if (target.tagName !== 'INPUT' && target.tagName !== 'TEXTAREA') {
            e.preventDefault();
            toggleFullscreen();
          }
        }
      }
    };

    window.addEventListener('keydown', handleKeyPress);
    return () => window.removeEventListener('keydown', handleKeyPress);
  }, [toggleFullscreen]);

  return (
    <div
      className={`flex flex-col bg-slate-950 transition-all duration-300 ${isFullscreen ? 'fixed inset-0 z-50' : 'h-full'}`}
    >
      {/* 画布 */}
      <div className="flex-1 relative min-h-0">
        <ReactFlow
          nodes={nodes}
          onNodesChange={onNodesChange}
          nodeTypes={nodeTypes}
          fitView={false}
          minZoom={0.1}
          maxZoom={4}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
        >
          <Background color="#334155" gap={20} />
          <Controls />
          <MiniMap
            className="!bg-slate-900/95 !border !border-slate-700"
            nodeColor={(node) => {
              if (node.type === 'chart') return '#8b5cf6';
              if (node.type === 'mermaid') return '#06b6d4';
              if (node.type === 'drawing') return '#10b981';
              return '#6366f1';
            }}
            maskColor="rgba(15, 23, 42, 0.8)"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.95)',
              borderRadius: '0.5rem',
            }}
          />
        </ReactFlow>

        {/* 全屏切换按钮 */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-50 w-10 h-10 rounded-lg bg-slate-900/95 border border-slate-700 flex items-center justify-center hover:bg-slate-800 transition-colors"
          title={isFullscreen ? '退出全屏' : '进入全屏'}
        >
          {isFullscreen ? (
            <Minimize className="w-5 h-5 text-slate-400" />
          ) : (
            <Maximize className="w-5 h-5 text-slate-400" />
          )}
        </button>
      </div>

      {/* 底部控制 */}
      <div className="shrink-0 h-16 border-t border-slate-800 bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 flex items-center gap-3 px-4 shadow-lg">
        {/* 节点计数 */}
        {nodes.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800/50 rounded-lg border border-slate-700/50">
            <div className="w-2 h-2 rounded-full bg-violet-500 animate-pulse"></div>
            <span className="text-xs text-slate-400">{nodes.length} 元素</span>
          </div>
        )}

        <div className="flex-1"></div>

        {/* 语音反馈 */}
        {(transcript || aiResponse) && (
          <div className="flex-1 max-w-md bg-slate-900/90 backdrop-blur-sm rounded-lg px-4 py-2 text-xs border border-slate-700/50 animate-in fade-in slide-in-from-bottom-2">
            {transcript && <div className="text-slate-300 mb-0.5">💬 {transcript}</div>}
            {aiResponse && <div className="text-violet-400">✨ {aiResponse}</div>}
          </div>
        )}

        {/* 语音控制 */}
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isConnecting}
          className={`relative w-14 h-14 rounded-full flex items-center justify-center transition-all ${
            isListening
              ? 'bg-red-600 hover:bg-red-700 shadow-lg shadow-red-600/50 scale-110'
              : isConnecting
              ? 'bg-slate-700 cursor-wait'
              : 'bg-violet-600 hover:bg-violet-700 hover:scale-105 active:scale-95 shadow-lg shadow-violet-600/30'
          }`}
          title={isListening ? '停止录音' : '开始语音输入'}
        >
          {isListening && (
            <span className="absolute inset-0 rounded-full bg-red-600 animate-ping opacity-75"></span>
          )}
          {isConnecting ? (
            <Loader2 className="w-6 h-6 text-white animate-spin" />
          ) : isListening ? (
            <MicOff className="w-6 h-6 text-white relative z-10" />
          ) : (
            <Mic className="w-6 h-6 text-white" />
          )}
        </button>
      </div>
    </div>
  );
}
