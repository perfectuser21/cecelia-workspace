import React, { useState, useRef, useEffect } from 'react';
import type { ColumnDef } from './types';

const BADGE_COLORS: Record<string, string> = {
  red:    'bg-red-900/40 text-red-300 border border-red-700/40',
  amber:  'bg-amber-900/40 text-amber-300 border border-amber-700/40',
  green:  'bg-emerald-900/40 text-emerald-300 border border-emerald-700/40',
  blue:   'bg-blue-900/40 text-blue-300 border border-blue-700/40',
  purple: 'bg-purple-900/40 text-purple-300 border border-purple-700/40',
  gray:   'bg-slate-700/60 text-slate-300 border border-slate-600/40',
  cyan:   'bg-cyan-900/40 text-cyan-300 border border-cyan-700/40',
};

function BadgeDisplayInternal({ value, col }: { value: unknown; col: ColumnDef }) {
  const str = String(value ?? '');
  if (!str) return <span className="text-slate-600 text-sm">—</span>;
  const opt = col.options?.find((o) => o.value === str);
  const label = opt?.label ?? str;
  const color = opt?.color ?? 'gray';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_COLORS[color] ?? BADGE_COLORS.gray}`}>
      {label}
    </span>
  );
}

function ProgressBar({ value }: { value: unknown }) {
  const num = typeof value === 'number' ? value : parseFloat(String(value ?? '0'));
  const pct = isNaN(num) ? 0 : Math.max(0, Math.min(100, num));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? '#10b981' : pct >= 40 ? '#3b82f6' : '#f59e0b',
          }}
        />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}

interface InlineEditProps {
  value: unknown;
  col: ColumnDef;
  onSave?: (value: unknown) => void;
}

export function InlineEdit({ value, col, onSave }: InlineEditProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const inputRef = useRef<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  function startEdit() {
    if (!col.editable || !onSave) return;
    setDraft(String(value ?? ''));
    setEditing(true);
  }

  function commit() {
    setEditing(false);
    if (col.type === 'number' || col.type === 'progress') {
      onSave?.(parseFloat(draft) || 0);
    } else {
      onSave?.(draft);
    }
  }

  function cancel() {
    setEditing(false);
  }

  // Date type
  if (col.type === 'date') {
    if (editing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="date"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className="text-sm bg-slate-700 text-gray-100 border border-indigo-500 rounded px-2 py-0.5 outline-none"
        />
      );
    }
    const dateStr = String(value ?? '');
    return (
      <span
        onClick={startEdit}
        className={`text-sm cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-slate-700/50 ${dateStr ? 'text-gray-300' : 'text-slate-600'}`}
      >
        {dateStr || (col.editable ? '设置日期' : '—')}
      </span>
    );
  }

  // Select type
  if (col.type === 'select') {
    if (editing) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); }}
          onBlur={commit}
          className="text-sm bg-slate-700 text-gray-300 border border-indigo-500 rounded px-1 py-0.5 outline-none"
        >
          {(col.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    const opt = (col.options ?? []).find((o) => o.value === String(value ?? ''));
    return (
      <span
        onClick={startEdit}
        className={`text-sm cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-slate-700/50 ${opt ? 'text-gray-200' : 'text-slate-600'}`}
      >
        {opt?.label ?? (value ? String(value) : '—')}
      </span>
    );
  }

  // Badge type (select but displays as badge)
  if (col.type === 'badge') {
    if (editing && col.options?.length) {
      return (
        <select
          ref={inputRef as React.RefObject<HTMLSelectElement>}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); }}
          onBlur={commit}
          className="text-sm bg-slate-700 text-gray-300 border border-indigo-500 rounded px-1 py-0.5 outline-none"
        >
          {(col.options ?? []).map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      );
    }
    return (
      <span onClick={startEdit} className={col.editable ? 'cursor-pointer' : ''}>
        <BadgeDisplayInternal value={value} col={col} />
      </span>
    );
  }

  // Progress type
  if (col.type === 'progress') {
    if (editing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          min={0}
          max={100}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className="w-20 text-sm bg-slate-700 text-gray-300 border border-indigo-500 rounded px-2 py-0.5 outline-none"
        />
      );
    }
    return (
      <div onClick={startEdit} className={col.editable ? 'cursor-pointer' : ''}>
        <ProgressBar value={value} />
      </div>
    );
  }

  // Number type
  if (col.type === 'number') {
    if (editing) {
      return (
        <input
          ref={inputRef as React.RefObject<HTMLInputElement>}
          type="number"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
          className="w-20 text-sm bg-slate-700 text-gray-300 border border-indigo-500 rounded px-2 py-0.5 outline-none"
        />
      );
    }
    return (
      <span
        onClick={startEdit}
        className={`text-sm cursor-pointer rounded px-1 py-0.5 transition-colors hover:bg-slate-700/50 ${value !== undefined && value !== null && value !== '' ? 'text-gray-300' : 'text-slate-600'}`}
      >
        {value !== undefined && value !== null && value !== '' ? String(value) : '—'}
      </span>
    );
  }

  // Text type (default)
  if (editing) {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') cancel(); }}
        className="w-full text-sm bg-slate-700 text-gray-100 border border-indigo-500 rounded px-2 py-0.5 outline-none"
      />
    );
  }

  const str = String(value ?? '');
  return (
    <span
      onClick={startEdit}
      className={`text-sm rounded px-1 py-0.5 transition-colors ${col.editable ? 'cursor-pointer hover:bg-slate-700/50' : ''} ${str ? 'text-gray-100' : 'text-slate-600'}`}
    >
      {str || '—'}
    </span>
  );
}

// Exported version for use in BoardView — accepts options array directly
export function BadgeDisplay({ value, options }: { value: unknown; options?: Array<{ value: string; label: string; color?: string }> }) {
  const str = String(value ?? '');
  if (!str) return <span className="text-slate-600 text-sm">—</span>;
  const opt = options?.find((o) => o.value === str);
  const label = opt?.label ?? str;
  const color = opt?.color ?? 'gray';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_COLORS[color] ?? BADGE_COLORS.gray}`}>
      {label}
    </span>
  );
}

// Exported ProgressDisplay for use in GalleryView
export function ProgressDisplay({ value }: { value: number }) {
  const pct = isNaN(value) ? 0 : Math.max(0, Math.min(100, value));
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{
            width: `${pct}%`,
            background: pct >= 80 ? '#10b981' : pct >= 40 ? '#3b82f6' : '#f59e0b',
          }}
        />
      </div>
      <span className="text-xs text-slate-400 w-8 text-right shrink-0">{pct}%</span>
    </div>
  );
}
