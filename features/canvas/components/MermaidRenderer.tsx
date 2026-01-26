import { useEffect, useRef, useState } from 'react';
import mermaid from 'mermaid';

interface MermaidRendererProps {
  content: string;
  onError?: (error: string) => void;
}

let mermaidInitialized = false;

export function MermaidRenderer({ content, onError }: MermaidRendererProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [svgContent, setSvgContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!mermaidInitialized) {
      mermaid.initialize({
        startOnLoad: false,
        theme: 'dark',
        themeVariables: {
          primaryColor: '#3b82f6',
          primaryTextColor: '#f1f5f9',
          primaryBorderColor: '#1e40af',
          lineColor: '#64748b',
          secondaryColor: '#8b5cf6',
          tertiaryColor: '#06b6d4',
        },
        // Suppress mermaid's internal DOM operations
        suppressErrorRendering: true,
      });
      mermaidInitialized = true;
    }
  }, []);

  useEffect(() => {
    if (!content) return;

    let cancelled = false;

    const renderDiagram = async () => {
      try {
        setError(null);
        setSvgContent(null);

        const id = `mermaid-${Date.now()}-${Math.random().toString(36).substring(7)}`;

        // Create a detached container for mermaid to render into
        const tempContainer = document.createElement('div');
        tempContainer.id = id;
        tempContainer.style.cssText = 'position: absolute; left: -9999px; visibility: hidden;';
        document.body.appendChild(tempContainer);

        try {
          const { svg } = await mermaid.render(id, content);

          if (!cancelled) {
            setSvgContent(svg);
          }
        } finally {
          // Clean up temp container - wrap in try/catch to handle race conditions
          try {
            if (tempContainer.parentNode) {
              tempContainer.parentNode.removeChild(tempContainer);
            }
          } catch {
            // Ignore cleanup errors
          }

          // Also clean up any orphaned mermaid elements
          const orphans = document.querySelectorAll(`[id^="${id}"]`);
          orphans.forEach(el => {
            try {
              if (el.parentNode) el.parentNode.removeChild(el);
            } catch {
              // Ignore
            }
          });
        }
      } catch (err) {
        if (!cancelled) {
          const errorMessage = err instanceof Error ? err.message : 'Mermaid syntax error';
          setError(errorMessage);
          onError?.(errorMessage);
        }
      }
    };

    renderDiagram();

    return () => {
      cancelled = true;
    };
  }, [content, onError]);

  if (error) {
    return (
      <div className="flex items-center justify-center h-full p-4 bg-red-900/20 border border-red-600/30 rounded-lg">
        <div className="text-center">
          <div className="text-red-400 font-semibold mb-2">Mermaid Render Error</div>
          <div className="text-red-300 text-sm">{error}</div>
        </div>
      </div>
    );
  }

  if (!svgContent) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-slate-400 text-sm">Rendering diagram...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="mermaid-container w-full h-full flex items-center justify-center overflow-auto"
      style={{ minHeight: '200px' }}
      dangerouslySetInnerHTML={{ __html: svgContent }}
    />
  );
}

export default MermaidRenderer;
