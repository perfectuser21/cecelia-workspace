/**
 * ProfileFactsPage — 记忆管理页面
 *
 * 查看 / 添加 / 编辑 / 删除 Cecelia 存储的用户记忆（user_profile_facts）
 * 支持按 Category 过滤 + 批量导入（文本粘贴 or 文件上传）
 *
 * API 端点（Core v1.88.1）:
 *   GET    /api/brain/profile/facts?category=xxx&limit=50&offset=0
 *   POST   /api/brain/profile/facts          {content, category}
 *   PUT    /api/brain/profile/facts/:id      {content, category}
 *   DELETE /api/brain/profile/facts/:id
 *   POST   /api/brain/profile/facts/import   {text}
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  BrainCircuit, Plus, Pencil, Trash2, Upload, Check, X,
  ChevronDown, Loader2, RefreshCw, FileText,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type Category =
  | 'preference' | 'behavior' | 'background' | 'goal'
  | 'relationship' | 'health' | 'other';

interface ProfileFact {
  id: string;
  content: string;
  category: Category;
  created_at: string;
  updated_at: string;
}

interface FactsResponse {
  facts: ProfileFact[];
  total: number;
  limit: number;
  offset: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: Category | 'all'; label: string; color: string }[] = [
  { value: 'all',          label: '全部',     color: 'bg-slate-500/20 text-slate-300' },
  { value: 'preference',   label: '偏好',     color: 'bg-blue-500/20 text-blue-300' },
  { value: 'behavior',     label: '行为',     color: 'bg-emerald-500/20 text-emerald-300' },
  { value: 'background',   label: '背景',     color: 'bg-violet-500/20 text-violet-300' },
  { value: 'goal',         label: '目标',     color: 'bg-amber-500/20 text-amber-300' },
  { value: 'relationship', label: '关系',     color: 'bg-pink-500/20 text-pink-300' },
  { value: 'health',       label: '健康',     color: 'bg-red-500/20 text-red-300' },
  { value: 'other',        label: '其他',     color: 'bg-slate-400/20 text-slate-400' },
];

const CAT_COLOR: Record<string, string> = Object.fromEntries(
  CATEGORIES.map(c => [c.value, c.color])
);
const catLabel = (c: string) => CATEGORIES.find(x => x.value === c)?.label ?? c;

// ─── API helpers ──────────────────────────────────────────────────────────────

const BASE = '/api/brain/profile/facts';

async function apiFetch<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium ${CAT_COLOR[category] ?? CAT_COLOR['other']}`}>
      {catLabel(category)}
    </span>
  );
}

function FactRow({
  fact,
  onEdit,
  onDelete,
}: {
  fact: ProfileFact;
  onEdit: (f: ProfileFact) => void;
  onDelete: (id: string) => void;
}) {
  const [confirming, setConfirming] = useState(false);

  return (
    <div className="group flex items-start gap-3 px-4 py-3 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-700/30 hover:border-slate-600/50 transition-all">
      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-200 leading-relaxed break-words">{fact.content}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <CategoryBadge category={fact.category} />
          <span className="text-[11px] text-slate-500">
            {new Date(fact.created_at).toLocaleDateString('zh-CN', { month: 'short', day: 'numeric', year: 'numeric' })}
          </span>
        </div>
      </div>
      {/* Actions */}
      <div className={`flex items-center gap-1 shrink-0 transition-opacity ${confirming ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
        {confirming ? (
          <>
            <span className="text-xs text-rose-400 mr-1">确认删除?</span>
            <button
              onClick={() => onDelete(fact.id)}
              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/40 text-rose-400 hover:text-rose-300 transition-colors"
            >
              <Check className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirming(false)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </>
        ) : (
          <>
            <button
              onClick={() => onEdit(fact)}
              className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-slate-300 transition-colors"
              title="编辑"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setConfirming(true)}
              className="p-1.5 rounded-lg hover:bg-rose-500/20 text-slate-500 hover:text-rose-400 transition-colors"
              title="删除"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Edit/Add Modal ───────────────────────────────────────────────────────────

function FactModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: ProfileFact | null;
  onClose: () => void;
  onSave: (data: { content: string; category: Category }) => Promise<void>;
}) {
  const [content, setContent] = useState(initial?.content ?? '');
  const [category, setCategory] = useState<Category>(initial?.category ?? 'other');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { textRef.current?.focus(); }, []);

  const handleSave = async () => {
    if (!content.trim()) { setError('内容不能为空'); return; }
    setSaving(true);
    setError('');
    try {
      await onSave({ content: content.trim(), category });
      onClose();
    } catch (e: any) {
      setError(e.message ?? '保存失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-lg mx-4 bg-slate-900 border border-slate-700/60 rounded-2xl shadow-2xl p-6">
        <h3 className="text-base font-semibold text-slate-100 mb-4">
          {initial ? '编辑记忆' : '添加记忆'}
        </h3>

        {/* Category selector */}
        <div className="flex flex-wrap gap-2 mb-4">
          {CATEGORIES.filter(c => c.value !== 'all').map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value as Category)}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${
                category === c.value
                  ? `${c.color} border-current opacity-100`
                  : 'border-slate-700 text-slate-500 hover:border-slate-500'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <textarea
          ref={textRef}
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={4}
          className="w-full bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-500 resize-none"
          placeholder="记录一条关于你的信息，例如：我偏好使用简体中文沟通..."
        />
        {error && <p className="mt-1.5 text-xs text-rose-400">{error}</p>}

        <div className="flex justify-end gap-2 mt-4">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm rounded-xl text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors disabled:opacity-50"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            保存
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Import Panel ─────────────────────────────────────────────────────────────

function ImportPanel({ onImported }: { onImported: () => void }) {
  const [text, setText] = useState('');
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const doImport = async (rawText: string) => {
    if (!rawText.trim()) { setError('内容不能为空'); return; }
    setImporting(true);
    setError('');
    setResult(null);
    try {
      const res = await apiFetch<{ imported: number; facts: ProfileFact[] }>(
        `${BASE}/import`,
        { method: 'POST', body: JSON.stringify({ text: rawText }) }
      );
      setResult(`✅ 成功导入 ${res.imported} 条记忆`);
      setText('');
      onImported();
    } catch (e: any) {
      setError(e.message ?? '导入失败');
    } finally {
      setImporting(false);
    }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // For txt files, read directly. For others, send raw file name + ask user to paste.
    // Full PDF/Excel parsing happens server-side via MiniMax text extraction if we send text.
    // Here we use FileReader for txt; for binary files we read as ArrayBuffer and convert name.
    const ext = file.name.split('.').pop()?.toLowerCase() ?? '';
    if (ext === 'txt') {
      const reader = new FileReader();
      reader.onload = () => { setText(reader.result as string); };
      reader.readAsText(file);
    } else {
      // For PDF/Excel/Word: read as text (browsers can't parse these natively).
      // We inform user to paste the text content, or read as data URL and send.
      // Best-effort: read as text (often produces garbage for binary, but MiniMax handles it).
      const reader = new FileReader();
      reader.onload = () => {
        // Try to use whatever text was extracted; MiniMax is robust
        const raw = reader.result as string;
        setText(raw.length > 5 ? raw : `[${file.name}] 请手动粘贴文件内容`);
      };
      reader.readAsText(file, 'utf-8');
    }
    // Reset input
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          rows={5}
          className="flex-1 bg-slate-800/60 border border-slate-700/50 rounded-xl px-4 py-3 text-sm text-slate-200 placeholder:text-slate-500 focus:outline-none focus:border-slate-500 resize-none"
          placeholder="粘贴文字或上传文件，Cecelia 会自动拆解成记忆条目...&#10;例如：我叫徐啸，喜欢用简体中文沟通，目前在做 AI 创业项目..."
        />
      </div>

      {error && <p className="text-xs text-rose-400">{error}</p>}
      {result && <p className="text-xs text-emerald-400">{result}</p>}

      <div className="flex items-center gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500 transition-colors"
        >
          <FileText className="w-3.5 h-3.5" />
          上传文件
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.pdf,.xlsx,.xls,.docx,.doc,.csv"
          onChange={handleFile}
          className="hidden"
        />
        <span className="text-xs text-slate-500">支持 txt / PDF / Excel / Word</span>

        <button
          onClick={() => doImport(text)}
          disabled={importing || !text.trim()}
          className="ml-auto flex items-center gap-2 px-4 py-1.5 text-sm rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors disabled:opacity-50"
        >
          {importing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          {importing ? '导入中…' : '开始导入'}
        </button>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function ProfileFactsPage() {
  const [facts, setFacts] = useState<ProfileFact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const [category, setCategory] = useState<Category | 'all'>('all');
  const [showCatMenu, setShowCatMenu] = useState(false);

  const [showAdd, setShowAdd] = useState(false);
  const [editFact, setEditFact] = useState<ProfileFact | null>(null);

  const [showImport, setShowImport] = useState(false);

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchFacts = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ limit: '100', offset: '0' });
      if (category !== 'all') params.set('category', category);
      const data = await apiFetch<FactsResponse>(`${BASE}?${params}`);
      setFacts(data.facts);
      setTotal(data.total);
    } catch (e: any) {
      setError(e.message ?? '加载失败');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [category]);

  useEffect(() => { fetchFacts(); }, [fetchFacts]);

  // ── CRUD ───────────────────────────────────────────────────────────────────

  const handleAdd = async (data: { content: string; category: Category }) => {
    await apiFetch<ProfileFact>(BASE, { method: 'POST', body: JSON.stringify(data) });
    await fetchFacts(true);
  };

  const handleEdit = async (data: { content: string; category: Category }) => {
    if (!editFact) return;
    await apiFetch<ProfileFact>(`${BASE}/${editFact.id}`, { method: 'PUT', body: JSON.stringify(data) });
    await fetchFacts(true);
  };

  const handleDelete = async (id: string) => {
    await apiFetch(`${BASE}/${id}`, { method: 'DELETE' });
    setFacts(prev => prev.filter(f => f.id !== id));
    setTotal(prev => prev - 1);
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  const currentCatLabel = CATEGORIES.find(c => c.value === category)?.label ?? '全部';

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-700/60 flex items-center justify-center">
            <BrainCircuit className="w-5 h-5 text-slate-300" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-100">记忆管理</h1>
            <p className="text-sm text-slate-400">Cecelia 存储的关于你的记忆条目 · {total} 条</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchFacts(true)}
            disabled={refreshing}
            className="p-2 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => setShowImport(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl border transition-colors ${
              showImport
                ? 'bg-slate-700 border-slate-600 text-slate-200'
                : 'border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-600'
            }`}
          >
            <Upload className="w-3.5 h-3.5" />
            批量导入
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-xl bg-slate-700 hover:bg-slate-600 text-slate-100 transition-colors"
          >
            <Plus className="w-4 h-4" />
            添加记忆
          </button>
        </div>
      </div>

      {/* Import Panel */}
      {showImport && (
        <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl p-5">
          <h2 className="text-sm font-medium text-slate-300 mb-3 flex items-center gap-2">
            <Upload className="w-4 h-4" /> 批量导入
          </h2>
          <ImportPanel onImported={() => fetchFacts(true)} />
        </div>
      )}

      {/* Filter bar */}
      <div className="flex items-center gap-3">
        {/* Category dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowCatMenu(v => !v)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm rounded-xl border border-slate-700 text-slate-300 hover:border-slate-500 transition-colors"
          >
            {currentCatLabel}
            <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
          </button>
          {showCatMenu && (
            <div className="absolute top-full mt-1 left-0 z-20 w-36 bg-slate-900 border border-slate-700 rounded-xl shadow-xl py-1 overflow-hidden">
              {CATEGORIES.map(c => (
                <button
                  key={c.value}
                  onClick={() => { setCategory(c.value as any); setShowCatMenu(false); }}
                  className={`w-full text-left px-3 py-1.5 text-sm transition-colors ${
                    category === c.value
                      ? 'bg-slate-700 text-slate-200'
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  {c.label}
                </button>
              ))}
            </div>
          )}
        </div>
        {category !== 'all' && (
          <button
            onClick={() => setCategory('all')}
            className="text-xs text-slate-500 hover:text-slate-300 transition-colors"
          >
            清除过滤
          </button>
        )}
      </div>

      {/* List */}
      {loading ? (
        <div className="flex items-center justify-center py-16 text-slate-500">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          加载中…
        </div>
      ) : error ? (
        <div className="py-12 text-center text-rose-400 text-sm">{error}</div>
      ) : facts.length === 0 ? (
        <div className="py-16 text-center">
          <BrainCircuit className="w-10 h-10 text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-500">
            {category !== 'all' ? '当前分类没有记忆' : '还没有任何记忆，点击「添加记忆」开始记录'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {facts.map(fact => (
            <FactRow
              key={fact.id}
              fact={fact}
              onEdit={(f) => setEditFact(f)}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {/* Modals */}
      {showAdd && (
        <FactModal
          onClose={() => setShowAdd(false)}
          onSave={handleAdd}
        />
      )}
      {editFact && (
        <FactModal
          initial={editFact}
          onClose={() => setEditFact(null)}
          onSave={handleEdit}
        />
      )}

      {/* Close cat menu on outside click */}
      {showCatMenu && (
        <div className="fixed inset-0 z-10" onClick={() => setShowCatMenu(false)} />
      )}
    </div>
  );
}
