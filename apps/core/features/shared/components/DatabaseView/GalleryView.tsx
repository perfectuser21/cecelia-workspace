import React from 'react';
import type { ColumnDef } from './types';
import { BadgeDisplay, ProgressDisplay } from './InlineEdit';

interface GalleryViewProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef[];
  renderGalleryCard?: (row: T) => React.ReactNode;
  onUpdate?: (id: string, field: string, value: unknown) => Promise<void>;
  onDelete?: (id: string) => Promise<void>;
  onCreate?: () => void;
}

export function GalleryView<T extends { id: string }>({ data, columns, renderGalleryCard }: GalleryViewProps<T>) {
  const titleCol = columns.find((c) => c.id === 'title' || c.id === 'name') ?? columns.find((c) => c.type === 'text') ?? columns[0];

  return (
    <div className="overflow-auto h-full p-4">
      <div className="grid grid-cols-3 gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))' }}>
        {data.map((row) => {
          if (renderGalleryCard) return <div key={row.id}>{renderGalleryCard(row)}</div>;
          const title = titleCol ? String((row as Record<string, unknown>)[titleCol.id] ?? '') : row.id;
          return (
            <div key={row.id} className="bg-slate-800 rounded-xl border border-slate-700 p-4 hover:border-slate-600 transition-all hover:shadow-lg cursor-pointer">
              <h3 className="text-sm font-medium text-gray-200 leading-snug mb-3">{title || '—'}</h3>
              <div className="space-y-1.5">
                {columns.filter((c) => c.id !== titleCol?.id).slice(0, 4).map((col) => {
                  const val = (row as Record<string, unknown>)[col.id];
                  if (val === null || val === undefined || String(val) === '') return null;
                  return (
                    <div key={col.id} className="flex items-center gap-2">
                      <span className="text-xs text-slate-500 w-16 shrink-0">{col.label}</span>
                      <div className="flex-1">
                        {col.type === 'badge' ? <BadgeDisplay value={String(val)} options={col.options} /> :
                         col.type === 'progress' ? <ProgressDisplay value={Number(val)} /> :
                         <span className="text-xs text-gray-300">{String(val)}</span>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <div className="col-span-3 py-16 text-center text-slate-500 text-sm">无数据</div>
        )}
      </div>
    </div>
  );
}
