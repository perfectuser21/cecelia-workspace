/**
 * Custom tldraw shapes for visualizations
 */

import {
  BaseBoxShapeUtil,
  TLBaseShape,
  HTMLContainer,
  RecordProps,
  T,
  resizeBox,
  Rectangle2d,
} from '@tldraw/tldraw';
import { MermaidRenderer } from './MermaidRenderer';
import { EChartsRenderer } from './EChartsRenderer';
import { D3ForceRenderer } from './D3ForceRenderer';
import type { EChartsOption } from 'echarts';

// ============================================
// Mermaid Shape
// ============================================

export type MermaidShape = TLBaseShape<
  'mermaid',
  {
    w: number;
    h: number;
    content: string;
  }
>;

export class MermaidShapeUtil extends BaseBoxShapeUtil<MermaidShape> {
  static override type = 'mermaid' as const;

  static override props: RecordProps<MermaidShape> = {
    w: T.number,
    h: T.number,
    content: T.string,
  };

  getDefaultProps(): MermaidShape['props'] {
    return {
      w: 600,
      h: 400,
      content: 'graph TD; A-->B;',
    };
  }

  component(shape: MermaidShape) {
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #334155',
        }}
      >
        <div style={{ padding: '16px', width: '100%', height: '100%' }}>
          <MermaidRenderer
            content={shape.props.content}
            onError={(err) => console.error('Mermaid error:', err)}
          />
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: MermaidShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  override getGeometry(shape: MermaidShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: MermaidShape, info: { newPoint: any; handle: any; scaleX: number; scaleY: number }) {
    return resizeBox(shape, info);
  }
}

// ============================================
// Chart Shape
// ============================================

export type ChartShape = TLBaseShape<
  'chart',
  {
    w: number;
    h: number;
    configJson: string;
  }
>;

export class ChartShapeUtil extends BaseBoxShapeUtil<ChartShape> {
  static override type = 'chart' as const;

  static override props: RecordProps<ChartShape> = {
    w: T.number,
    h: T.number,
    configJson: T.string,
  };

  getDefaultProps(): ChartShape['props'] {
    return {
      w: 600,
      h: 400,
      configJson: JSON.stringify({
        series: [{ type: 'pie', data: [{ value: 100, name: 'A' }] }],
      }),
    };
  }

  component(shape: ChartShape) {
    const config = JSON.parse(shape.props.configJson) as EChartsOption;
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #334155',
        }}
      >
        <div style={{ padding: '16px', width: '100%', height: '100%' }}>
          <EChartsRenderer config={config} />
        </div>
      </HTMLContainer>
    );
  }

  indicator(shape: ChartShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  override getGeometry(shape: ChartShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: ChartShape, info: { newPoint: any; handle: any; scaleX: number; scaleY: number }) {
    return resizeBox(shape, info);
  }
}

// ============================================
// Network Shape
// ============================================

export type NetworkShape = TLBaseShape<
  'network',
  {
    w: number;
    h: number;
    dataJson: string;
  }
>;

export class NetworkShapeUtil extends BaseBoxShapeUtil<NetworkShape> {
  static override type = 'network' as const;

  static override props: RecordProps<NetworkShape> = {
    w: T.number,
    h: T.number,
    dataJson: T.string,
  };

  getDefaultProps(): NetworkShape['props'] {
    return {
      w: 600,
      h: 400,
      dataJson: JSON.stringify({
        nodes: [
          { id: '1', label: 'Node 1', group: 1 },
          { id: '2', label: 'Node 2', group: 2 },
        ],
        links: [{ source: '1', target: '2', value: 1 }],
      }),
    };
  }

  component(shape: NetworkShape) {
    const data = JSON.parse(shape.props.dataJson) as {
      nodes: Array<{ id: string; label: string; group?: number }>;
      links: Array<{ source: string; target: string; value?: number }>;
    };
    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          borderRadius: '12px',
          overflow: 'hidden',
          border: '1px solid #334155',
        }}
      >
        <D3ForceRenderer nodes={data.nodes} links={data.links} />
      </HTMLContainer>
    );
  }

  indicator(shape: NetworkShape) {
    return <rect width={shape.props.w} height={shape.props.h} />;
  }

  override getGeometry(shape: NetworkShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: NetworkShape, info: { newPoint: any; handle: any; scaleX: number; scaleY: number }) {
    return resizeBox(shape, info);
  }
}
