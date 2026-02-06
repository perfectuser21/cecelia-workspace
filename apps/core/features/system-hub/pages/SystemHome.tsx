import { Monitor, Bot, Cpu, Workflow, Users, Activity, Server, Shield, GitBranch, Compass, Brain } from 'lucide-react';
import GenericHome from '../../shared/pages/GenericHome';
import type { HomeGroup } from '../../shared/pages/GenericHome';

const groups: HomeGroup[] = [
  {
    title: 'Cecelia',
    items: [
      { id: 'planner', label: 'Planner', icon: Bot, path: '/system/planner' },
      { id: 'cecelia', label: 'Cecelia Overview', icon: Bot, path: '/system/cecelia' },
      { id: 'runs', label: 'Runs', icon: Bot, path: '/system/cecelia/runs' },
    ],
  },
  {
    title: 'Engine',
    items: [
      { id: 'engine', label: 'Engine Dashboard', icon: Cpu, path: '/system/engine' },
      { id: 'capabilities', label: 'Capabilities', icon: Cpu, path: '/system/engine/capabilities' },
      { id: 'brain', label: 'Brain', icon: Brain, path: '/system/brain' },
      { id: 'orchestrator', label: 'Orchestrator', icon: Cpu, path: '/system/orchestrator' },
    ],
  },
  {
    title: 'N8N',
    items: [
      { id: 'workflows', label: 'Workflows', icon: Workflow, path: '/system/n8n/workflows' },
      { id: 'live-status', label: 'Live Status', icon: Workflow, path: '/system/n8n/live-status' },
    ],
  },
  {
    title: 'Workers',
    items: [
      { id: 'workers', label: 'Workers Overview', icon: Users, path: '/system/workers' },
      { id: 'session-monitor', label: 'Session Monitor', icon: Users, path: '/system/session-monitor' },
    ],
  },
  {
    title: 'Monitoring',
    items: [
      { id: 'vps-monitor', label: 'VPS Monitor', icon: Server, path: '/system/vps-monitor' },
      { id: 'performance', label: 'Performance', icon: Activity, path: '/system/performance' },
      { id: 'claude-monitor', label: 'Claude Monitor', icon: Bot, path: '/system/claude-monitor' },
      { id: 'claude-stats', label: 'Claude Stats', icon: Bot, path: '/system/claude-stats' },
      { id: 'quality', label: 'Quality', icon: Shield, path: '/system/quality' },
      { id: 'devgate', label: 'DevGate', icon: GitBranch, path: '/system/devgate' },
      { id: 'live', label: 'Live Dashboard', icon: Activity, path: '/system/live' },
    ],
  },
  {
    title: 'Panorama',
    items: [
      { id: 'canvas', label: 'Canvas', icon: Compass, path: '/system/canvas' },
      { id: 'project-panorama', label: 'Project Panorama', icon: Compass, path: '/system/project-panorama' },
      { id: 'panorama', label: 'Dev Panorama', icon: Compass, path: '/system/panorama' },
    ],
  },
];

export default function SystemHome() {
  return <GenericHome title="System" icon={Monitor} groups={groups} minCardWidth={200} />;
}
