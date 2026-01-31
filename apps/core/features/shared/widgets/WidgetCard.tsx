import React, { Component, ReactNode } from 'react';
import { WidgetManifest, WidgetSize } from './types';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class WidgetErrorBoundary extends Component<
  { children: ReactNode; widgetId: string },
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-2 p-4">
          <AlertTriangle className="w-6 h-6 text-amber-400" />
          <p className="text-sm">Widget error</p>
          <p className="text-xs text-slate-500 truncate max-w-full">
            {this.state.error?.message}
          </p>
        </div>
      );
    }
    return this.props.children;
  }
}

interface WidgetCardProps {
  manifest: WidgetManifest;
  size?: Partial<WidgetSize>;
}

export function WidgetCard({ manifest, size }: WidgetCardProps) {
  const cols = size?.cols ?? manifest.defaultSize.cols;
  const rows = size?.rows ?? manifest.defaultSize.rows;
  const Component = manifest.component;

  return (
    <div
      className="bg-slate-800/50 backdrop-blur-sm border border-slate-700/50 rounded-xl overflow-hidden flex flex-col"
      style={{
        gridColumn: `span ${cols}`,
        gridRow: `span ${rows}`,
      }}
    >
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/50">
        <h3 className="text-sm font-medium text-slate-200">{manifest.title}</h3>
        <span className="text-xs text-slate-500 capitalize">{manifest.category}</span>
      </div>
      <div className="flex-1 p-4 overflow-auto">
        <WidgetErrorBoundary widgetId={manifest.id}>
          <Component />
        </WidgetErrorBoundary>
      </div>
    </div>
  );
}
