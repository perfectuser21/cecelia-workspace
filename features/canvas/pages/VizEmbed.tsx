/**
 * Embed 页面：纯净的可视化组件，供 tldraw embed shape 使用
 */

import { useEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { MermaidRenderer } from '../components/MermaidRenderer';
import { EChartsRenderer } from '../components/EChartsRenderer';
import { D3ForceRenderer } from '../components/D3ForceRenderer';
import type { EChartsOption } from 'echarts';

export default function VizEmbed() {
  const { type, id } = useParams<{ type: string; id: string }>();
  const [searchParams] = useSearchParams();
  const [data, setData] = useState<unknown>(null);

  useEffect(() => {
    // 从 localStorage 获取数据
    const storageKey = `viz-data-${id}`;
    const storedData = localStorage.getItem(storageKey);
    if (storedData) {
      setData(JSON.parse(storedData));
    }
  }, [id]);

  if (!data) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-950 text-slate-400">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-slate-950 p-4">
      {type === 'mermaid' && (
        <MermaidRenderer
          content={data as string}
          onError={(err) => console.error('Mermaid error:', err)}
        />
      )}
      {type === 'chart' && <EChartsRenderer config={data as EChartsOption} />}
      {type === 'network' && (
        <D3ForceRenderer
          nodes={(data as { nodes: Array<{ id: string; label: string; group?: number }> }).nodes}
          links={(data as { links: Array<{ source: string; target: string; value?: number }> }).links}
        />
      )}
    </div>
  );
}
