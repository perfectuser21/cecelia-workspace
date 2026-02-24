/**
 * Projects Dashboard - DatabaseView 表格模式
 * 数据源: /api/tasks/goals + /api/tasks/projects
 */

import { useState, useEffect, useCallback } from 'react';
import { DatabaseView } from '../../shared/components/DatabaseView';
import type { ColumnDef } from '../../shared/components/DatabaseView';

interface Goal {
  id: string;
  title: string;
  type: string;
  parent_id: string | null;
}

interface Project {
  id: string;
  name: string;
  type: string;
  status: string;
  priority: string;
  progress?: number;
  parent_id: string | null;
  kr_id: string | null;
  goal_id: string | null;
  repo_path: string | null;
}

interface ProjectRow {
  id: string;
  type_label: string;
  name: string;
  area: string;
  status: string;
  priority: string;
  progress: number;
  repo_path: string;
  [key: string]: unknown;
}

const COLUMNS: ColumnDef[] = [
  { id: 'type_label', label: '类型', type: 'badge', sortable: true, width: 100,
    options: [
      { value: 'project', label: 'Project', color: '#8b5cf6' },
      { value: 'initiative', label: 'Initiative', color: '#3b82f6' },
    ],
  },
  { id: 'name', label: '名称', type: 'text', sortable: true, width: 300 },
  { id: 'area', label: 'Area', type: 'text', sortable: true, width: 140 },
  { id: 'priority', label: '优先级', type: 'badge', sortable: true, width: 90,
    options: [
      { value: 'P0', label: 'P0', color: '#ef4444' },
      { value: 'P1', label: 'P1', color: '#f59e0b' },
      { value: 'P2', label: 'P2', color: '#6b7280' },
    ],
  },
  { id: 'status', label: '状态', type: 'badge', sortable: true, width: 110,
    options: [
      { value: 'active', label: '活跃', color: '#10b981' },
      { value: 'in_progress', label: '进行中', color: '#3b82f6' },
      { value: 'pending', label: '待开始', color: '#6b7280' },
      { value: 'completed', label: '已完成', color: '#10b981' },
      { value: 'paused', label: '暂停', color: '#f59e0b' },
    ],
  },
  { id: 'progress', label: '进度 %', type: 'number', sortable: true, width: 90 },
  { id: 'repo_path', label: 'Repo', type: 'text', sortable: false, width: 180 },
];

export default function ProjectsDashboard() {
  const [rows, setRows] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [goalsRes, projectsRes] = await Promise.all([
        fetch('/api/tasks/goals'),
        fetch('/api/tasks/projects'),
      ]);
      const goals: Goal[] = await goalsRes.json();
      const projects: Project[] = await projectsRes.json();

      const areaMap = new Map<string, string>();
      goals.filter(g => g.type === 'area_okr').forEach(a => areaMap.set(a.id, a.title));
      const krToArea = new Map<string, string>();
      goals.filter(g => g.type === 'kr').forEach(k => {
        if (k.parent_id) {
          const area = areaMap.get(k.parent_id);
          if (area) krToArea.set(k.id, area);
        }
      });

      const projectAreaMap = new Map<string, string>();
      projects.filter(p => p.type === 'project').forEach(p => {
        const kr = p.kr_id || p.goal_id;
        if (kr) {
          const area = krToArea.get(kr);
          if (area) projectAreaMap.set(p.id, area);
        }
      });

      const po: Record<string, number> = { P0: 0, P1: 1, P2: 2 };
      const mapped: ProjectRow[] = projects.map(p => ({
        id: p.id,
        type_label: p.type,
        name: p.name,
        area: p.type === 'initiative' && p.parent_id
          ? (projectAreaMap.get(p.parent_id) ?? '—')
          : (projectAreaMap.get(p.id) ?? '—'),
        status: p.status,
        priority: p.priority ?? 'P2',
        progress: p.progress ?? 0,
        repo_path: p.repo_path ?? '',
      }));

      mapped.sort((a, b) => {
        if (a.type_label !== b.type_label) return a.type_label === 'project' ? -1 : 1;
        return (po[a.priority] ?? 9) - (po[b.priority] ?? 9);
      });

      setRows(mapped);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleUpdate = async (id: string, field: string, value: unknown) => {
    const isCustom = !COLUMNS.find(c => c.id === field);
    const body = isCustom ? { custom_props: { [field]: value } } : { [field]: value };
    await fetch(`/api/tasks/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    setRows(prev => prev.map(r => r.id === id ? { ...r, [field]: value } : r));
  };

  return (
    <DatabaseView
      data={rows}
      columns={COLUMNS}
      onUpdate={handleUpdate}
      loading={loading}
      defaultView="table"
      stateKey="initiatives"
      stats={{ total: rows.length, byStatus: {
        active: rows.filter(r => r.status === 'active').length || undefined,
        in_progress: rows.filter(r => r.status === 'in_progress').length || undefined,
      }}}
      boardGroupField="status"
    />
  );
}
