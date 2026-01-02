// Types matching frontend ProjectPanorama.tsx LayerData structure

export interface PanoramaNode {
  id: string;
  x: number;
  y: number;
  name: string;
  desc?: string;
  status: 'completed' | 'in_progress' | 'not_started';
  type: 'core' | 'product' | 'dashboard' | 'feature' | 'workflow' | 'service' | 'project';
  hasChildren?: boolean;
  version?: string;
  current?: boolean;
}

export interface PanoramaEdge {
  from: string;
  to: string;
}

export interface Milestone {
  date: string;
  label: string;
}

export interface WorkflowNode {
  id: string;
  x: number;
  y: number;
  name: string;
  type: 'trigger' | 'action' | 'logic' | 'output';
  input?: string;
  output?: string;
  logic?: string;
}

export interface WorkflowEdge {
  from: string;
  to: string;
}

export interface LayerData {
  title: string;
  subtitle?: string;
  version?: string;
  scriptPath?: string;
  isLeaf?: boolean;
  milestones?: Milestone[];
  nodes?: PanoramaNode[];
  edges?: PanoramaEdge[];
  workflowNodes?: WorkflowNode[];
  workflowEdges?: WorkflowEdge[];
}

export interface ProjectInfo {
  name: string;
  path: string;
  hasPackageJson: boolean;
  hasDockerCompose: boolean;
  hasClaudeMd: boolean;
  lastModified: Date;
  type: 'nodejs' | 'python' | 'docker' | 'mixed' | 'other';
  description?: string;
}

export interface ServiceInfo {
  name: string;
  containerName: string;
  status: 'running' | 'stopped' | 'unknown';
  port?: number;
  uptime?: string;
  cpu?: string;
  memory?: string;
}

export interface PanoramaResponse {
  allData: Record<string, LayerData>;
  lastUpdated: number;
}
