import { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface D3Node {
  id: string;
  label: string;
  group?: number;
  x?: number;
  y?: number;
  fx?: number | null;
  fy?: number | null;
}

interface D3Link {
  source: string | D3Node;
  target: string | D3Node;
  value?: number;
}

interface D3ForceRendererProps {
  nodes: Array<{ id: string; label: string; group?: number }>;
  links: Array<{ source: string; target: string; value?: number }>;
}

export function D3ForceRenderer({ nodes, links }: D3ForceRendererProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!svgRef.current || !containerRef.current) return;

    const svg = d3.select(svgRef.current);

    // Safely clear previous content
    try {
      svg.selectAll('*').remove();
    } catch {
      // Ignore if already removed
    }

    let width = containerRef.current.clientWidth || 800;
    let height = containerRef.current.clientHeight || 600;

    svg.attr('width', width).attr('height', height);

    const nodeData: D3Node[] = nodes.map((n) => ({ ...n }));
    const linkData: D3Link[] = links.map((l) => ({ ...l }));

    const color = d3.scaleOrdinal(d3.schemeCategory10);

    const simulation = d3
      .forceSimulation<D3Node>(nodeData)
      .force(
        'link',
        d3
          .forceLink<D3Node, D3Link>(linkData)
          .id((d) => d.id)
          .distance(100)
      )
      .force('charge', d3.forceManyBody().strength(-300))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collision', d3.forceCollide().radius(30));

    const link = svg
      .append('g')
      .attr('class', 'links')
      .selectAll('line')
      .data(linkData)
      .enter()
      .append('line')
      .attr('stroke', '#64748b')
      .attr('stroke-opacity', 0.6)
      .attr('stroke-width', (d) => Math.sqrt((d.value || 1) * 2));

    const node = svg
      .append('g')
      .attr('class', 'nodes')
      .selectAll('g')
      .data(nodeData)
      .enter()
      .append('g')
      .call(
        d3
          .drag<SVGGElement, D3Node>()
          .on('start', dragStarted)
          .on('drag', dragged)
          .on('end', dragEnded)
      );

    node
      .append('circle')
      .attr('r', 10)
      .attr('fill', (d) => color(String(d.group || 0)));

    node
      .append('text')
      .text((d) => d.label)
      .attr('x', 15)
      .attr('y', 4)
      .attr('font-size', '12px')
      .attr('fill', '#f1f5f9');

    simulation.on('tick', () => {
      link
        .attr('x1', (d) => (d.source as D3Node).x || 0)
        .attr('y1', (d) => (d.source as D3Node).y || 0)
        .attr('x2', (d) => (d.target as D3Node).x || 0)
        .attr('y2', (d) => (d.target as D3Node).y || 0);

      node.attr('transform', (d) => `translate(${d.x || 0},${d.y || 0})`);
    });

    function dragStarted(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragEnded(event: d3.D3DragEvent<SVGGElement, D3Node, D3Node>) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    const handleResize = () => {
      if (!containerRef.current) return;
      const newWidth = containerRef.current.clientWidth || 800;
      const newHeight = containerRef.current.clientHeight || 600;

      if (newWidth !== width || newHeight !== height) {
        width = newWidth;
        height = newHeight;
        svg.attr('width', width).attr('height', height);
        simulation.force('center', d3.forceCenter(width / 2, height / 2));
        simulation.alpha(0.3).restart();
      }
    };

    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      simulation.stop();
      // Clean up D3 elements safely
      try {
        svg.selectAll('*').remove();
      } catch {
        // Ignore if already removed
      }
    };
  }, [nodes, links]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full"
      style={{ minHeight: '400px', backgroundColor: '#0f172a' }}
    >
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}

export default D3ForceRenderer;
