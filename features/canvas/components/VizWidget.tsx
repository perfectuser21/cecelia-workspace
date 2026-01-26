import { useMemo } from 'react';
import { useVizDataSource, type DataSourceConfig } from '../hooks/useVizDataSource';
import { MermaidRenderer } from './MermaidRenderer';
import { EChartsRenderer } from './EChartsRenderer';
import { D3ForceRenderer } from './D3ForceRenderer';
import { Loader2, AlertCircle } from 'lucide-react';
import type { EChartsOption } from 'echarts';

type VizType = 'mermaid' | 'chart' | 'network';

interface VizWidgetProps {
  type: VizType;
  dataSource?: DataSourceConfig;
  staticData?: any;
}

export function VizWidget({ type, dataSource, staticData }: VizWidgetProps) {
  const shouldFetch = !!dataSource;
  const skipDataSource = !shouldFetch ? { url: '#skip', interval: 0 } : dataSource;

  const { data, loading, error, refresh } = useVizDataSource(skipDataSource);

  const displayData = useMemo(() => {
    return shouldFetch ? data : staticData;
  }, [shouldFetch, data, staticData]);

  if (dataSource && loading && !data) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
          <div className="text-slate-400 text-sm">Loading data...</div>
        </div>
      </div>
    );
  }

  if (dataSource && error) {
    return (
      <div className="flex items-center justify-center h-full p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <div>
            <div className="text-red-400 font-semibold mb-1">Data Load Error</div>
            <div className="text-red-300 text-sm">{error.message}</div>
          </div>
          <button
            onClick={refresh}
            className="mt-2 px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-300 rounded-md text-sm transition-colors"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (!displayData) {
    return (
      <div className="flex items-center justify-center h-full p-4">
        <div className="text-slate-400 text-sm">No data available</div>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {dataSource && loading && (
        <div className="absolute top-2 right-2 z-10">
          <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
        </div>
      )}
      
      {type === 'mermaid' && (
        <MermaidRenderer
          content={typeof displayData === 'string' ? displayData : (displayData?.content || '')}
        />
      )}

      {type === 'chart' && (
        <EChartsRenderer
          config={displayData as EChartsOption}
        />
      )}

      {type === 'network' && (
        <D3ForceRenderer
          nodes={displayData.nodes || []}
          links={displayData.links || []}
        />
      )}
    </div>
  );
}

export default VizWidget;
