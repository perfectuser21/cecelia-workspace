import { Briefcase, ListTodo, FolderKanban, Target, Map, GitBranch, Layers, PenTool, Compass } from 'lucide-react';
import GenericHome from '../../shared/pages/GenericHome';
import type { HomeCard } from '../../shared/pages/GenericHome';

const cards: HomeCard[] = [
  { id: 'projects', label: 'Projects', icon: FolderKanban, path: '/work/projects', desc: 'Project list & details' },
  { id: 'tasks', label: 'Tasks', icon: ListTodo, path: '/work/tasks', desc: 'Kanban & time-slot view' },
  { id: 'okr', label: 'OKR', icon: Target, path: '/work/okr', desc: 'Objectives & key results' },
  { id: 'roadmap', label: 'Roadmap', icon: Map, path: '/work/roadmap', desc: 'Repo scan & feature list' },
  { id: 'dev-tasks', label: 'Dev Tasks', icon: GitBranch, path: '/work/dev-tasks', desc: 'Development task tracking' },
  { id: 'features', label: 'Features', icon: Layers, path: '/work/features', desc: 'Feature registry' },
  { id: 'panorama', label: 'Panorama', icon: Compass, path: '/work/panorama', desc: 'Full view' },
  { id: 'whiteboard', label: 'Whiteboard', icon: PenTool, path: '/work/whiteboard', desc: 'Whiteboard & mind map' },
];

export default function WorkHome() {
  return <GenericHome title="Work" icon={Briefcase} cards={cards} />;
}
