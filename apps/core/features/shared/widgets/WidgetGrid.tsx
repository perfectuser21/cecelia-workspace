import React from 'react';
import { WidgetLayout } from './types';
import { WidgetCard } from './WidgetCard';
import { WidgetRegistry } from './registry';

interface WidgetGridProps {
  layout: WidgetLayout[];
  columns?: number;
}

export function WidgetGrid({ layout, columns = 4 }: WidgetGridProps) {
  return (
    <div
      className="grid gap-4 auto-rows-[200px]"
      style={{
        gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
      }}
    >
      {layout.map((item) => {
        const manifest = WidgetRegistry.getById(item.widgetId);
        if (!manifest) return null;
        return <WidgetCard key={item.widgetId} manifest={manifest} size={item.size} />;
      })}
    </div>
  );
}
