import React from 'react';
import type { ColumnDef } from './types';
import { BadgeDisplay } from './InlineEdit';

interface ListViewProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef[];
  renderListItem?: (row: T) => React.ReactNode;
  onCreate?: () => void;
}

export function ListView<T extends { id: string }>({ data, columns, renderListItem }: ListViewProps<T>) {
  const titleCol = columns.find((c) => c.id === 'title' || c.id === 'name') ?? columns.find((c) => c.type === 'text') ?? columns[0];
  const metaCols = columns.filter((c) => c.id !== titleCol?.id && (c.type === 'badge' || c.type === 'select')).slice(0, 3);

  return (
    <div className="overflow-auto h-full">
      {data.map((row) => {
        if (renderListItem) return <div key={row.id}>{renderListItem(row)}</div>;
        const title = titleCol ? String((row as Record<string, unknown>)[titleCol.id] ?? '') : row.id;
        return (
          <div key={row.id} className="flex items-center gap-3 px-4 py-3 border-b border-slate-700/30 hover:bg-slate-700/30 transition-colors">
            <span className="flex-1 text-sm text-gray-200 truncate">{title || '—'}</span>
            <div className="flex items-center gap-2 shrink-0">
              {metaCols.map((col) => {
                const val = (row as Record<string, unknown>)[col.id];
                if (!val) return null;
                return <BadgeDisplay key={col.id} value={String(val)} options={col.options} />;
              })}
            </div>
          </div>
        );
      })}
      {data.length === 0 && <div className="py-16 text-center text-slate-500 text-sm">无数据</div>}
    </div>
  );
}
