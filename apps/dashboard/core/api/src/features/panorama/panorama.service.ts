// Panorama service - generates real VPS project structure data
import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import {
  LayerData,
  PanoramaNode,
  PanoramaEdge,
  ProjectInfo,
  ServiceInfo,
  PanoramaResponse,
} from './panorama.types';
import logger from '../../shared/utils/logger';

const DEV_ROOT = '/home/xx/dev';
const NODE_W = 180;  // 与前端 NODE_W 保持一致
const NODE_H = 64;   // 与前端 NODE_H 保持一致

// Layout constants for auto-positioning
const GRID_X = 210;  // 节点间距（NODE_W + 30）
const GRID_Y = 100;  // 行间距（NODE_H + 36）
const START_X = 60;
const START_Y = 60;

// 服务分组定义
const SERVICE_GROUPS: Record<string, { name: string; desc: string; containers: string[] }> = {
  'core': {
    name: '核心服务',
    desc: 'API 和数据库',
    containers: ['social-metrics-api', 'social-metrics-postgres'],
  },
  'automation': {
    name: '自动化',
    desc: '工作流引擎',
    containers: ['n8n-self-hosted', 'social-metrics-n8n'],
  },
  'monitor': {
    name: '监控',
    desc: 'Claude 监控',
    containers: ['claude-monitor-backend-1', 'claude-monitor-frontend-1'],
  },
  'infra': {
    name: '基础设施',
    desc: '网关和安全',
    containers: ['nginx-proxy-manager', 'xray-reality'],
  },
  'tools': {
    name: '工具服务',
    desc: '辅助功能',
    containers: ['feishu-auth-backend', 'douyin-api'],
  },
};

class PanoramaService {
  private cache: PanoramaResponse | null = null;
  private cacheTime: number = 0;
  private readonly CACHE_TTL = 60 * 1000; // 1 minute cache

  /**
   * Get all panorama data (with caching)
   */
  async getAllData(): Promise<PanoramaResponse> {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < this.CACHE_TTL) {
      return this.cache;
    }

    const allData = await this.buildAllData();
    this.cache = {
      allData,
      lastUpdated: now,
    };
    this.cacheTime = now;
    return this.cache;
  }

  /**
   * Force refresh cache
   */
  async refreshData(): Promise<PanoramaResponse> {
    this.cache = null;
    return this.getAllData();
  }

  /**
   * Build complete panorama data from VPS
   * Provides separate root layers for different dimensions:
   * - runtime-root: 机器人状态（Docker服务）- 分组展示
   * - code-root: 项目列表 - 按活跃度分组
   * - dataflow-root: 任务流转 - 可钻取
   */
  private async buildAllData(): Promise<Record<string, LayerData>> {
    const projects = await this.scanProjects();
    const services = await this.getDockerServices();
    const allData: Record<string, LayerData> = {};

    // 运行维度：分组展示服务
    allData['runtime-root'] = this.buildRuntimeRootLayer(services);
    // 运行维度的子层：每个分组的详情
    this.buildRuntimeGroupLayers(services, allData);

    // 代码维度：按活跃度分组
    allData['code-root'] = this.buildCodeRootLayer(projects);
    // 代码维度的子层：每个活跃度分组
    this.buildCodeGroupLayers(projects, allData);

    // 数据流维度：可钻取的流程
    allData['dataflow-root'] = this.buildDataflowRootLayer();
    // 数据流维度的子层
    this.buildDataflowChildLayers(allData);

    // Individual project layers for drill-down
    for (const project of projects) {
      const projectData = await this.buildProjectLayer(project);
      if (projectData) {
        allData[project.name] = projectData;
      }
    }

    return allData;
  }

  /**
   * 运行维度根层：展示服务分组
   */
  private buildRuntimeRootLayer(services: ServiceInfo[]): LayerData {
    const runningCount = services.filter(s => s.status === 'running').length;
    const nodes: PanoramaNode[] = [];
    let col = 0;

    for (const [groupId, group] of Object.entries(SERVICE_GROUPS)) {
      const groupServices = services.filter(s => group.containers.includes(s.containerName));
      const runningInGroup = groupServices.filter(s => s.status === 'running').length;

      if (groupServices.length === 0) continue;

      nodes.push({
        id: `runtime-${groupId}`,
        x: START_X + (col % 3) * GRID_X,
        y: START_Y + Math.floor(col / 3) * GRID_Y,
        name: group.name,
        desc: `${runningInGroup}/${groupServices.length} 运行中`,
        status: runningInGroup === groupServices.length ? 'completed' :
                runningInGroup > 0 ? 'in_progress' : 'not_started',
        type: 'service',
        hasChildren: true,
      });
      col++;
    }

    // 未分组的服务
    const groupedContainers = Object.values(SERVICE_GROUPS).flatMap(g => g.containers);
    const ungrouped = services.filter(s => !groupedContainers.includes(s.containerName));
    if (ungrouped.length > 0) {
      const runningUngrouped = ungrouped.filter(s => s.status === 'running').length;
      nodes.push({
        id: 'runtime-other',
        x: START_X + (col % 3) * GRID_X,
        y: START_Y + Math.floor(col / 3) * GRID_Y,
        name: '其他服务',
        desc: `${runningUngrouped}/${ungrouped.length} 运行中`,
        status: runningUngrouped > 0 ? 'in_progress' : 'not_started',
        type: 'service',
        hasChildren: true,
      });
    }

    return {
      title: '服务状态',
      subtitle: `${runningCount} 个运行中`,
      nodes,
      edges: [],
    };
  }

  /**
   * 运行维度子层：每个分组的服务详情
   */
  private buildRuntimeGroupLayers(services: ServiceInfo[], allData: Record<string, LayerData>): void {
    const friendlyNames: Record<string, string> = {
      'nginx-proxy-manager': '网关',
      'social-metrics-api': 'API',
      'social-metrics-postgres': '数据库',
      'n8n-self-hosted': 'n8n',
      'social-metrics-n8n': 'n8n',
      'xray-reality': 'VPN',
      'feishu-auth-backend': '飞书登录',
      'claude-monitor-backend-1': '后端',
      'claude-monitor-frontend-1': '前端',
      'douyin-api': '抖音',
    };

    for (const [groupId, group] of Object.entries(SERVICE_GROUPS)) {
      const groupServices = services.filter(s => group.containers.includes(s.containerName));
      if (groupServices.length === 0) continue;

      const nodes: PanoramaNode[] = groupServices.map((service, i) => ({
        id: `svc-${service.containerName}`,
        x: START_X + (i % 2) * GRID_X,
        y: START_Y + Math.floor(i / 2) * GRID_Y,
        name: friendlyNames[service.containerName] || service.name,
        desc: service.status === 'running' ?
          (service.uptime ? `运行 ${service.uptime}` : '运行中') : '已停止',
        status: service.status === 'running' ? 'completed' : 'not_started',
        type: 'service',
      }));

      allData[`runtime-${groupId}`] = {
        title: group.name,
        subtitle: group.desc,
        nodes,
        edges: [],
      };
    }

    // 未分组服务的子层
    const groupedContainers = Object.values(SERVICE_GROUPS).flatMap(g => g.containers);
    const ungrouped = services.filter(s => !groupedContainers.includes(s.containerName));
    if (ungrouped.length > 0) {
      allData['runtime-other'] = {
        title: '其他服务',
        subtitle: '未分类的容器',
        nodes: ungrouped.map((service, i) => ({
          id: `svc-${service.containerName}`,
          x: START_X + (i % 3) * GRID_X,
          y: START_Y + Math.floor(i / 3) * GRID_Y,
          name: this.truncateName(service.containerName, 12),
          desc: service.status === 'running' ? '运行中' : '已停止',
          status: service.status === 'running' ? 'completed' : 'not_started',
          type: 'service',
        })),
        edges: [],
      };
    }
  }

  /**
   * 代码维度根层：按活跃度分组
   */
  private buildCodeRootLayer(projects: ProjectInfo[]): LayerData {
    const validProjects = projects.filter(p => p.hasPackageJson || p.hasDockerCompose || p.hasClaudeMd);
    const now = Date.now();

    // 分组统计
    const active = validProjects.filter(p => {
      const days = (now - p.lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return days < 3;
    });
    const recent = validProjects.filter(p => {
      const days = (now - p.lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 3 && days < 30;
    });
    const idle = validProjects.filter(p => {
      const days = (now - p.lastModified.getTime()) / (1000 * 60 * 60 * 24);
      return days >= 30;
    });

    const nodes: PanoramaNode[] = [
      {
        id: 'code-active',
        x: START_X,
        y: START_Y,
        name: '正在做',
        desc: `${active.length} 个项目`,
        status: 'in_progress',
        type: 'project',
        hasChildren: active.length > 0,
      },
      {
        id: 'code-recent',
        x: START_X + GRID_X,
        y: START_Y,
        name: '最近做过',
        desc: `${recent.length} 个项目`,
        status: 'completed',
        type: 'project',
        hasChildren: recent.length > 0,
      },
      {
        id: 'code-idle',
        x: START_X + GRID_X * 2,
        y: START_Y,
        name: '闲置中',
        desc: `${idle.length} 个项目`,
        status: 'not_started',
        type: 'project',
        hasChildren: idle.length > 0,
      },
    ];

    return {
      title: '我的项目',
      subtitle: `${validProjects.length} 个项目`,
      nodes,
      edges: [],
    };
  }

  /**
   * 代码维度子层：每个活跃度分组的项目列表
   */
  private buildCodeGroupLayers(projects: ProjectInfo[], allData: Record<string, LayerData>): void {
    const validProjects = projects.filter(p => p.hasPackageJson || p.hasDockerCompose || p.hasClaudeMd);
    const now = Date.now();

    const groups: Record<string, { title: string; subtitle: string; projects: ProjectInfo[] }> = {
      'code-active': {
        title: '正在做',
        subtitle: '最近 3 天有改动',
        projects: validProjects.filter(p => (now - p.lastModified.getTime()) / (1000 * 60 * 60 * 24) < 3),
      },
      'code-recent': {
        title: '最近做过',
        subtitle: '3-30 天内有改动',
        projects: validProjects.filter(p => {
          const days = (now - p.lastModified.getTime()) / (1000 * 60 * 60 * 24);
          return days >= 3 && days < 30;
        }),
      },
      'code-idle': {
        title: '闲置中',
        subtitle: '超过 30 天没动',
        projects: validProjects.filter(p => (now - p.lastModified.getTime()) / (1000 * 60 * 60 * 24) >= 30),
      },
    };

    for (const [groupId, group] of Object.entries(groups)) {
      const sorted = group.projects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

      allData[groupId] = {
        title: group.title,
        subtitle: group.subtitle,
        nodes: sorted.slice(0, 9).map((project, i) => {
          const days = Math.floor((now - project.lastModified.getTime()) / (1000 * 60 * 60 * 24));
          let timeDesc = '';
          if (days === 0) timeDesc = '今天';
          else if (days === 1) timeDesc = '昨天';
          else if (days < 7) timeDesc = `${days}天前`;
          else if (days < 30) timeDesc = `${Math.floor(days / 7)}周前`;
          else timeDesc = `${Math.floor(days / 30)}月前`;

          return {
            id: project.name,
            x: START_X + (i % 3) * GRID_X,
            y: START_Y + Math.floor(i / 3) * GRID_Y,
            name: this.truncateName(project.name, 12),
            desc: timeDesc,
            status: days < 3 ? 'in_progress' : days < 30 ? 'completed' : 'not_started',
            type: 'project' as const,
            hasChildren: project.hasClaudeMd,
          };
        }),
        edges: [],
      };
    }
  }

  /**
   * 数据流维度根层：可钻取的流程节点
   */
  private buildDataflowRootLayer(): LayerData {
    const nodes: PanoramaNode[] = [
      {
        id: 'flow-notion',
        x: 60,
        y: 100,
        name: 'Notion 任务',
        desc: '任务来源',
        status: 'completed',
        type: 'feature',
        hasChildren: true,
      },
      {
        id: 'flow-dispatch',
        x: 240,
        y: 100,
        name: '任务调度',
        desc: 'n8n 分发',
        status: 'in_progress',
        type: 'workflow',
        hasChildren: true,
      },
      {
        id: 'flow-execute',
        x: 420,
        y: 100,
        name: 'AI 执行',
        desc: 'Claude 写码',
        status: 'in_progress',
        type: 'core',
        hasChildren: true,
      },
      {
        id: 'flow-sync',
        x: 600,
        y: 100,
        name: '结果同步',
        desc: '回写 Notion',
        status: 'completed',
        type: 'feature',
        hasChildren: true,
      },
    ];

    return {
      title: '任务流转',
      subtitle: '从想法到完成',
      nodes,
      edges: [
        { from: 'flow-notion', to: 'flow-dispatch' },
        { from: 'flow-dispatch', to: 'flow-execute' },
        { from: 'flow-execute', to: 'flow-sync' },
      ],
    };
  }

  /**
   * 数据流维度子层：每个流程节点的详情
   */
  private buildDataflowChildLayers(allData: Record<string, LayerData>): void {
    // Notion 任务详情
    allData['flow-notion'] = {
      title: 'Notion 任务',
      subtitle: '任务来源和分类',
      nodes: [
        { id: 'notion-inbox', x: START_X, y: START_Y, name: '收集箱', desc: '新任务', status: 'in_progress', type: 'feature' },
        { id: 'notion-todo', x: START_X + GRID_X, y: START_Y, name: '待办', desc: '等待处理', status: 'not_started', type: 'feature' },
        { id: 'notion-doing', x: START_X, y: START_Y + GRID_Y, name: '进行中', desc: 'AI 在做', status: 'in_progress', type: 'feature' },
        { id: 'notion-done', x: START_X + GRID_X, y: START_Y + GRID_Y, name: '已完成', desc: '归档', status: 'completed', type: 'feature' },
      ],
      edges: [],
    };

    // 任务调度详情
    allData['flow-dispatch'] = {
      title: '任务调度',
      subtitle: 'n8n 工作流分发',
      nodes: [
        { id: 'dispatch-webhook', x: START_X, y: START_Y, name: 'Webhook', desc: '接收触发', status: 'completed', type: 'workflow' },
        { id: 'dispatch-filter', x: START_X + GRID_X, y: START_Y, name: '任务过滤', desc: '判断类型', status: 'in_progress', type: 'workflow' },
        { id: 'dispatch-assign', x: START_X, y: START_Y + GRID_Y, name: '分配执行', desc: '选择 Agent', status: 'in_progress', type: 'workflow' },
      ],
      edges: [
        { from: 'dispatch-webhook', to: 'dispatch-filter' },
        { from: 'dispatch-filter', to: 'dispatch-assign' },
      ],
    };

    // AI 执行详情
    allData['flow-execute'] = {
      title: 'AI 执行',
      subtitle: 'Claude 代码生成',
      nodes: [
        { id: 'exec-read', x: START_X, y: START_Y, name: '读取上下文', desc: '理解任务', status: 'completed', type: 'core' },
        { id: 'exec-plan', x: START_X + GRID_X, y: START_Y, name: '规划方案', desc: '设计实现', status: 'in_progress', type: 'core' },
        { id: 'exec-code', x: START_X, y: START_Y + GRID_Y, name: '编写代码', desc: '生成实现', status: 'in_progress', type: 'core' },
        { id: 'exec-test', x: START_X + GRID_X, y: START_Y + GRID_Y, name: '测试验证', desc: '确保正确', status: 'not_started', type: 'core' },
      ],
      edges: [
        { from: 'exec-read', to: 'exec-plan' },
        { from: 'exec-plan', to: 'exec-code' },
        { from: 'exec-code', to: 'exec-test' },
      ],
    };

    // 结果同步详情
    allData['flow-sync'] = {
      title: '结果同步',
      subtitle: '回写状态和通知',
      nodes: [
        { id: 'sync-commit', x: START_X, y: START_Y, name: 'Git 提交', desc: '保存代码', status: 'completed', type: 'feature' },
        { id: 'sync-notion', x: START_X + GRID_X, y: START_Y, name: '更新 Notion', desc: '标记完成', status: 'completed', type: 'feature' },
        { id: 'sync-notify', x: START_X, y: START_Y + GRID_Y, name: '发送通知', desc: '飞书提醒', status: 'completed', type: 'feature' },
      ],
      edges: [
        { from: 'sync-commit', to: 'sync-notion' },
        { from: 'sync-notion', to: 'sync-notify' },
      ],
    };
  }

  /**
   * Build layer for a specific project
   */
  private async buildProjectLayer(project: ProjectInfo): Promise<LayerData | null> {
    const projectPath = path.join(DEV_ROOT, project.name);
    const claudeMdPath = path.join(projectPath, 'CLAUDE.md');

    let description = project.description || '';

    // Try to read CLAUDE.md for description
    if (project.hasClaudeMd) {
      try {
        const content = fs.readFileSync(claudeMdPath, 'utf-8');
        const firstPara = content.split('\n\n')[1]?.replace(/[#\-*]/g, '').trim();
        if (firstPara) {
          description = firstPara.slice(0, 100);
        }
      } catch {
        // Ignore read errors
      }
    }

    // Get subdirectories as child nodes
    const nodes: PanoramaNode[] = [];
    const edges: PanoramaEdge[] = [];

    try {
      const items = fs.readdirSync(projectPath);
      const dirs = items.filter(item => {
        const fullPath = path.join(projectPath, item);
        return fs.statSync(fullPath).isDirectory() && !item.startsWith('.');
      }).slice(0, 8); // Limit to 8

      const cols = 2;
      dirs.forEach((dir, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const dirPath = path.join(projectPath, dir);

        let type: PanoramaNode['type'] = 'feature';
        if (dir === 'frontend' || dir === 'src') type = 'dashboard';
        if (dir === 'api' || dir === 'backend' || dir === 'core') type = 'core';
        if (dir.includes('workflow')) type = 'workflow';

        const hasSubdirs = fs.readdirSync(dirPath).some(f => {
          try {
            return fs.statSync(path.join(dirPath, f)).isDirectory();
          } catch {
            return false;
          }
        });

        nodes.push({
          id: `${project.name}-${dir}`,
          x: START_X + col * GRID_X,
          y: START_Y + row * GRID_Y,
          name: dir,
          desc: '',
          status: 'in_progress',
          type,
          hasChildren: hasSubdirs,
        });
      });
    } catch (error) {
      logger.warn(`Failed to read project directory: ${project.name}`, { error });
    }

    return {
      title: project.name,
      subtitle: description,
      nodes,
      edges,
    };
  }

  /**
   * Scan /home/xx/dev for projects
   */
  private async scanProjects(): Promise<ProjectInfo[]> {
    const projects: ProjectInfo[] = [];

    try {
      const items = fs.readdirSync(DEV_ROOT);

      for (const item of items) {
        const fullPath = path.join(DEV_ROOT, item);

        try {
          const stat = fs.statSync(fullPath);
          if (!stat.isDirectory() || item.startsWith('.')) continue;

          const hasPackageJson = fs.existsSync(path.join(fullPath, 'package.json'));
          const hasDockerCompose = fs.existsSync(path.join(fullPath, 'docker-compose.yml')) ||
                                   fs.existsSync(path.join(fullPath, 'docker-compose.yaml'));
          const hasClaudeMd = fs.existsSync(path.join(fullPath, 'CLAUDE.md'));
          const hasPyProject = fs.existsSync(path.join(fullPath, 'pyproject.toml')) ||
                               fs.existsSync(path.join(fullPath, 'requirements.txt'));

          let type: ProjectInfo['type'] = 'other';
          if (hasPackageJson && hasPyProject) type = 'mixed';
          else if (hasPackageJson) type = 'nodejs';
          else if (hasPyProject) type = 'python';
          else if (hasDockerCompose) type = 'docker';

          // Get description from CLAUDE.md or package.json
          let description = '';
          if (hasClaudeMd) {
            try {
              const content = fs.readFileSync(path.join(fullPath, 'CLAUDE.md'), 'utf-8');
              const match = content.match(/^#\s+(.+)/m);
              if (match) description = match[1];
            } catch {}
          } else if (hasPackageJson) {
            try {
              const pkg = JSON.parse(fs.readFileSync(path.join(fullPath, 'package.json'), 'utf-8'));
              description = pkg.description || pkg.name || '';
            } catch {}
          }

          projects.push({
            name: item,
            path: fullPath,
            hasPackageJson,
            hasDockerCompose,
            hasClaudeMd,
            lastModified: stat.mtime,
            type,
            description,
          });
        } catch (error) {
          logger.warn(`Failed to stat project: ${item}`, { error });
        }
      }
    } catch (error) {
      logger.error('Failed to scan projects', { error });
    }

    return projects;
  }

  /**
   * Get Docker services status
   */
  private async getDockerServices(): Promise<ServiceInfo[]> {
    const services: ServiceInfo[] = [];

    try {
      const output = execSync(
        'docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"',
        { encoding: 'utf-8', timeout: 5000 }
      ).trim();

      const lines = output.split('\n').filter(line => line.trim());

      for (const line of lines) {
        const [name, status, ports] = line.split('\t');

        // Parse port number
        let port: number | undefined;
        const portMatch = ports?.match(/(\d+)->(\d+)/);
        if (portMatch) {
          port = parseInt(portMatch[1]);
        }

        // Parse uptime
        let uptime: string | undefined;
        if (status.startsWith('Up')) {
          uptime = status.replace(/^Up\s+/, '').split(' ')[0];
        }

        services.push({
          name: this.containerToServiceName(name),
          containerName: name,
          status: status.startsWith('Up') ? 'running' : 'stopped',
          port,
          uptime,
        });
      }
    } catch (error) {
      logger.error('Failed to get Docker services', { error });
    }

    return services;
  }

  /**
   * Convert container name to friendly service name
   */
  private containerToServiceName(containerName: string): string {
    const nameMap: Record<string, string> = {
      'nginx-proxy-manager': 'Nginx 反向代理',
      'social-metrics-api': 'Dashboard API',
      'social-metrics-postgres': 'PostgreSQL',
      'social-metrics-n8n': 'n8n 工作流',
      'n8n-self-hosted': 'n8n 工作流',
      'xray-reality': 'VPN 服务',
      'feishu-auth-backend': '飞书认证',
      'claude-monitor-backend-1': 'Claude 监控后端',
      'claude-monitor-frontend-1': 'Claude 监控前端',
      'douyin-api': '抖音 API',
    };

    return nameMap[containerName] || containerName;
  }

  /**
   * Determine project status based on files
   */
  private getProjectStatus(project: ProjectInfo): 'completed' | 'in_progress' | 'not_started' {
    // Recently modified (within 7 days) = in_progress
    const daysSinceModified = (Date.now() - project.lastModified.getTime()) / (1000 * 60 * 60 * 24);
    if (daysSinceModified < 7) return 'in_progress';
    if (project.hasDockerCompose || project.hasPackageJson) return 'completed';
    return 'not_started';
  }

  /**
   * Truncate name for display
   */
  private truncateName(name: string, maxLen: number = 15): string {
    if (name.length <= maxLen) return name;
    return name.slice(0, maxLen - 2) + '..';
  }
}

export const panoramaService = new PanoramaService();
