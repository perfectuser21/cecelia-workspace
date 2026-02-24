import React, { useState } from 'react';
import { ArrowUp, ArrowDown, ArrowUpDown, Plus, ChevronLeft, ChevronRight, Maximize2, Trash2, GripHorizontal } from 'lucide-react';
import type { ColumnDef } from './types';
import { InlineEdit } from './InlineEdit';

const PAGE_SIZE = 25;

interface TableViewProps<T extends { id: string }> {
  data: T[];
  columns: ColumnDef[];
  visibleCols: ColumnDef[];
  sortField: string;
  sortDir: 'asc' | 'desc';
  onSortChange: (field: string, dir: 'asc' | 'desc') => void;
  onUpdate?: (id: string, field: string, value: unknown) => Promise<void>;
  onCreate?: () => void;
  onRowClick?: (id: string) => void;
  onDelete?: (id: string) => Promise<void>;
  onReorderCols?: (fromId: string, toId: string) => void;
  selectedRowId?: string | null;
}

export function TableView<T extends { id: string }>({
  data,
  visibleCols,
  sortField,
  sortDir,
  onSortChange,
  onUpdate,
  onCreate,
  onRowClick,
  onDelete,
  onReorderCols,
  selectedRowId,
}: TableViewProps<T>) {
  const [page, setPage] = useState(0);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>({});
  const [dragColId, setDragColId] = useState<string | null>(null);
  const [dragOverColId, setDragOverColId] = useState<string | null>(null);

  const totalPages = Math.ceil(data.length / PAGE_SIZE);
  const pageData = data.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  function handleSort(colId: string) {
    if (sortField === colId) {
      onSortChange(colId, sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      onSortChange(colId, 'asc');
    }
  }

  function handleResizeStart(colId: string, startX: number, startWidth: number) {
    const onMove = (e: MouseEvent) => {
      const delta = e.clientX - startX;
      setColumnWidths((prev) => ({ ...prev, [colId]: Math.max(80, startWidth + delta) }));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function SortIcon({ colId }: { colId: string }) {
    if (sortField !== colId) return <ArrowUpDown className="w-3 h-3 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3 text-blue-400" /> : <ArrowDown className="w-3 h-3 text-blue-400" />;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-slate-700/50">
              <th className="w-10 py-2 px-2 sticky left-0 bg-slate-900 z-10" />
              {visibleCols.map((col) => {
                const colWidth = columnWidths[col.id] || col.width || 150;
                const isDragOver = dragOverColId === col.id && dragColId !== col.id;
                return (
                  <th
                    key={col.id}
                    draggable={!!onReorderCols}
                    onDragStart={(e) => {
                      setDragColId(col.id);
                      e.dataTransfer.effectAllowed = 'move';
                    }}
                    onDragOver={(e) => { e.preventDefault(); setDragOverColId(col.id); }}
                    onDragLeave={() => setDragOverColId(null)}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragColId && dragColId !== col.id && onReorderCols) {
                        onReorderCols(dragColId, col.id);
                      }
                      setDragColId(null);
                      setDragOverColId(null);
                    }}
                    onDragEnd={() => { setDragColId(null); setDragOverColId(null); }}
                    className={`py-2 px-3 text-left text-xs font-semibold bg-slate-900 group select-none transition-colors ${
                      col.sortable ? 'cursor-pointer hover:text-white' : ''
                    } ${isDragOver ? 'bg-indigo-900/30 text-indigo-300' : 'text-slate-400'} ${
                      dragColId === col.id ? 'opacity-50' : ''
                    }`}
                    style={{ width: colWidth, minWidth: 80, position: 'relative', userSelect: 'none' }}
                    onClick={() => col.sortable && !dragColId && handleSort(col.id)}
                  >
                    <div className="flex items-center gap-1.5">
                      {onReorderCols && (
                        <GripHorizontal className="w-3 h-3 text-slate-600 opacity-0 group-hover:opacity-100 cursor-grab shrink-0" />
                      )}
                      {col.label}
                      {col.sortable && <SortIcon colId={col.id} />}
                    </div>
                    {/* Resize handle */}
                    <div
                      onMouseDown={(e) => { e.preventDefault(); e.stopPropagation(); handleResizeStart(col.id, e.clientX, colWidth); }}
                      onClick={(e) => e.stopPropagation()}
                      style={{ position: 'absolute', right: 0, top: 0, bottom: 0, width: 4, cursor: 'col-resize', backgroundColor: 'transparent' }}
                      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'rgba(99,102,241,0.5)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                    />
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageData.map((row) => {
              const isSelected = selectedRowId === row.id;
              return (
                <tr
                  key={row.id}
                  className={`group border-b border-slate-700/30 transition-colors ${isSelected ? 'bg-slate-700/80' : 'hover:bg-slate-700/40'}`}
                >
                  <td className={`py-2 px-2 sticky left-0 z-10 ${isSelected ? 'bg-slate-700/80' : 'bg-slate-800 group-hover:bg-slate-700/40'}`}>
                    <div className="flex items-center gap-1">
                      <div className="w-4 h-4 rounded border border-slate-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                      {onRowClick && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onRowClick(row.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-slate-600 rounded text-slate-400 hover:text-blue-400 shrink-0"
                          title="展开详情"
                        >
                          <Maximize2 className="w-3 h-3" />
                        </button>
                      )}
                      {onDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); onDelete(row.id); }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 hover:bg-red-900/40 rounded text-slate-400 hover:text-red-400 shrink-0"
                          title="删除"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      )}
                    </div>
                  </td>
                  {visibleCols.map((col) => {
                    const rawVal = (row as Record<string, unknown>)[col.id];
                    return (
                      <td key={col.id} className="py-1.5 px-3 align-middle text-gray-100">
                        <InlineEdit value={rawVal} col={col} onSave={(value) => onUpdate?.(row.id, col.id, value)} />
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            {pageData.length === 0 && (
              <tr>
                <td colSpan={visibleCols.length + 1} className="py-12 text-center text-slate-500 text-sm">无数据</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-slate-700/50 bg-slate-800/50 shrink-0">
        {onCreate ? (
          <button onClick={onCreate} className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-400 transition-colors">
            <Plus className="w-3.5 h-3.5" />新建
          </button>
        ) : (
          <span className="text-xs text-slate-500">{data.length} 条记录</span>
        )}
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">第 {page + 1} / {totalPages} 页</span>
            <button onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-slate-400" />
            </button>
            <button onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1} className="p-1 hover:bg-slate-700 rounded disabled:opacity-30 transition-colors">
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
