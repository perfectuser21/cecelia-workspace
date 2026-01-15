"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.panoramaService = void 0;
// Panorama service - generates real VPS project structure data
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const child_process_1 = require("child_process");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const DEV_ROOT = '/home/xx/dev';
const NODE_W = 180; // 与前端 NODE_W 保持一致
const NODE_H = 64; // 与前端 NODE_H 保持一致
// 白板项目存储路径（使用应用程序目录下的 data 目录）
const DATA_DIR = process.env.DATA_DIR || path_1.default.join(process.cwd(), 'data');
const PROJECTS_FILE = path_1.default.join(DATA_DIR, 'whiteboard-projects.json');
// Layout constants for auto-positioning
const GRID_X = 210; // 节点间距（NODE_W + 30）
const GRID_Y = 100; // 行间距（NODE_H + 36）
const START_X = 60;
const START_Y = 60;
// 服务分组定义
const SERVICE_GROUPS = {
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
    constructor() {
        this.cache = null;
        this.cacheTime = 0;
        this.CACHE_TTL = 60 * 1000; // 1 minute cache
        // 工作区数据（内存存储，后续可持久化）
        this.workspace = {
            nodes: [],
            edges: [],
            title: '工作区',
            subtitle: '实时规划中',
            lastUpdated: Date.now(),
        };
    }
    /**
     * Get all panorama data (with caching)
     */
    async getAllData() {
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
    async refreshData() {
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
    async buildAllData() {
        const projects = await this.scanProjects();
        const services = await this.getDockerServices();
        const allData = {};
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
    buildRuntimeRootLayer(services) {
        const runningCount = services.filter(s => s.status === 'running').length;
        const nodes = [];
        let col = 0;
        for (const [groupId, group] of Object.entries(SERVICE_GROUPS)) {
            const groupServices = services.filter(s => group.containers.includes(s.containerName));
            const runningInGroup = groupServices.filter(s => s.status === 'running').length;
            if (groupServices.length === 0)
                continue;
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
    buildRuntimeGroupLayers(services, allData) {
        const friendlyNames = {
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
            if (groupServices.length === 0)
                continue;
            const nodes = groupServices.map((service, i) => ({
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
    buildCodeRootLayer(projects) {
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
        const nodes = [
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
    buildCodeGroupLayers(projects, allData) {
        const validProjects = projects.filter(p => p.hasPackageJson || p.hasDockerCompose || p.hasClaudeMd);
        const now = Date.now();
        const groups = {
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
                    if (days === 0)
                        timeDesc = '今天';
                    else if (days === 1)
                        timeDesc = '昨天';
                    else if (days < 7)
                        timeDesc = `${days}天前`;
                    else if (days < 30)
                        timeDesc = `${Math.floor(days / 7)}周前`;
                    else
                        timeDesc = `${Math.floor(days / 30)}月前`;
                    return {
                        id: project.name,
                        x: START_X + (i % 3) * GRID_X,
                        y: START_Y + Math.floor(i / 3) * GRID_Y,
                        name: this.truncateName(project.name, 12),
                        desc: timeDesc,
                        status: days < 3 ? 'in_progress' : days < 30 ? 'completed' : 'not_started',
                        type: 'project',
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
    buildDataflowRootLayer() {
        const nodes = [
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
    buildDataflowChildLayers(allData) {
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
        // AI 工厂 - 4 阶段执行
        allData['flow-execute'] = {
            title: 'AI 工厂',
            subtitle: '4 阶段自动执行',
            nodes: [
                { id: 'stage-prepare', x: START_X, y: START_Y, name: '1. 准备', desc: '读取任务/构建Prompt', status: 'completed', type: 'core', hasChildren: true },
                { id: 'stage-execute', x: START_X + GRID_X, y: START_Y, name: '2. 执行', desc: '调用Claude', status: 'completed', type: 'core', hasChildren: true },
                { id: 'stage-quality', x: START_X, y: START_Y + GRID_Y, name: '3. 质检', desc: '硬检查+软检查', status: 'completed', type: 'core', hasChildren: true },
                { id: 'stage-cleanup', x: START_X + GRID_X, y: START_Y + GRID_Y, name: '4. 收尾', desc: 'Git提交/通知', status: 'completed', type: 'core', hasChildren: true },
            ],
            edges: [
                { from: 'stage-prepare', to: 'stage-execute' },
                { from: 'stage-execute', to: 'stage-quality' },
                { from: 'stage-quality', to: 'stage-cleanup' },
                { from: 'stage-quality', to: 'stage-execute' }, // 返工循环
            ],
        };
        // 准备阶段详情
        allData['stage-prepare'] = {
            title: '1. 准备阶段',
            subtitle: 'prepare.sh',
            nodes: [
                { id: 'prep-notion', x: START_X, y: START_Y, name: '读取 Notion', desc: '任务名/描述/类型', status: 'completed', type: 'core' },
                { id: 'prep-prompt', x: START_X + GRID_X, y: START_Y, name: '构建 Prompt', desc: '上下文+约束', status: 'completed', type: 'core' },
                { id: 'prep-dir', x: START_X + GRID_X * 2, y: START_Y, name: '创建工作目录', desc: '/data/runs/{id}', status: 'completed', type: 'core' },
            ],
            edges: [
                { from: 'prep-notion', to: 'prep-prompt' },
                { from: 'prep-prompt', to: 'prep-dir' },
            ],
        };
        // 执行阶段详情
        allData['stage-execute'] = {
            title: '2. 执行阶段',
            subtitle: 'execute.sh',
            nodes: [
                { id: 'exec-claude', x: START_X, y: START_Y, name: '调用 Claude', desc: 'claude -p $PROMPT', status: 'completed', type: 'core' },
                { id: 'exec-timeout', x: START_X + GRID_X, y: START_Y, name: '超时控制', desc: '10分钟限制', status: 'completed', type: 'core' },
                { id: 'exec-detect', x: START_X + GRID_X * 2, y: START_Y, name: '检测变更', desc: 'unstaged+staged+untracked', status: 'completed', type: 'core' },
            ],
            edges: [
                { from: 'exec-claude', to: 'exec-timeout' },
                { from: 'exec-timeout', to: 'exec-detect' },
            ],
        };
        // 质检阶段详情
        allData['stage-quality'] = {
            title: '3. 质检阶段',
            subtitle: 'quality-check.sh',
            nodes: [
                { id: 'qc-exist', x: START_X, y: START_Y, name: '产出物检查', desc: '文件是否生成', status: 'completed', type: 'core' },
                { id: 'qc-security', x: START_X + GRID_X, y: START_Y, name: '安全扫描', desc: '密钥/敏感信息', status: 'completed', type: 'core' },
                { id: 'qc-git', x: START_X, y: START_Y + GRID_Y, name: 'Git 检查', desc: '冲突标记', status: 'completed', type: 'core' },
                { id: 'qc-accept', x: START_X + GRID_X, y: START_Y + GRID_Y, name: '验收标准', desc: 'required:false', status: 'in_progress', type: 'core' },
            ],
            edges: [
                { from: 'qc-exist', to: 'qc-security' },
                { from: 'qc-security', to: 'qc-git' },
                { from: 'qc-git', to: 'qc-accept' },
            ],
        };
        // 收尾阶段详情
        allData['stage-cleanup'] = {
            title: '4. 收尾阶段',
            subtitle: 'cleanup.sh',
            nodes: [
                { id: 'clean-report', x: START_X, y: START_Y, name: '生成报告', desc: 'execution_report.md', status: 'completed', type: 'core' },
                { id: 'clean-git', x: START_X + GRID_X, y: START_Y, name: 'Git 提交', desc: '创建分支/推送', status: 'completed', type: 'core' },
                { id: 'clean-notion', x: START_X, y: START_Y + GRID_Y, name: '更新 Notion', desc: '状态→AI Done', status: 'completed', type: 'core' },
                { id: 'clean-webhook', x: START_X + GRID_X, y: START_Y + GRID_Y, name: 'Webhook', desc: '触发回调/飞书', status: 'completed', type: 'core' },
            ],
            edges: [
                { from: 'clean-report', to: 'clean-git' },
                { from: 'clean-git', to: 'clean-notion' },
                { from: 'clean-notion', to: 'clean-webhook' },
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
    async buildProjectLayer(project) {
        const projectPath = path_1.default.join(DEV_ROOT, project.name);
        const claudeMdPath = path_1.default.join(projectPath, 'CLAUDE.md');
        let description = project.description || '';
        // Try to read CLAUDE.md for description
        if (project.hasClaudeMd) {
            try {
                const content = fs_1.default.readFileSync(claudeMdPath, 'utf-8');
                const firstPara = content.split('\n\n')[1]?.replace(/[#\-*]/g, '').trim();
                if (firstPara) {
                    description = firstPara.slice(0, 100);
                }
            }
            catch {
                // Ignore read errors
            }
        }
        // Get subdirectories as child nodes
        const nodes = [];
        const edges = [];
        try {
            const items = fs_1.default.readdirSync(projectPath);
            const dirs = items.filter(item => {
                const fullPath = path_1.default.join(projectPath, item);
                return fs_1.default.statSync(fullPath).isDirectory() && !item.startsWith('.');
            }).slice(0, 8); // Limit to 8
            const cols = 2;
            dirs.forEach((dir, i) => {
                const col = i % cols;
                const row = Math.floor(i / cols);
                const dirPath = path_1.default.join(projectPath, dir);
                let type = 'feature';
                if (dir === 'frontend' || dir === 'src')
                    type = 'dashboard';
                if (dir === 'api' || dir === 'backend' || dir === 'core')
                    type = 'core';
                if (dir.includes('workflow'))
                    type = 'workflow';
                const hasSubdirs = fs_1.default.readdirSync(dirPath).some(f => {
                    try {
                        return fs_1.default.statSync(path_1.default.join(dirPath, f)).isDirectory();
                    }
                    catch {
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
        }
        catch (error) {
            logger_1.default.warn(`Failed to read project directory: ${project.name}`, { error });
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
    async scanProjects() {
        const projects = [];
        try {
            const items = fs_1.default.readdirSync(DEV_ROOT);
            for (const item of items) {
                const fullPath = path_1.default.join(DEV_ROOT, item);
                try {
                    const stat = fs_1.default.statSync(fullPath);
                    if (!stat.isDirectory() || item.startsWith('.'))
                        continue;
                    const hasPackageJson = fs_1.default.existsSync(path_1.default.join(fullPath, 'package.json'));
                    const hasDockerCompose = fs_1.default.existsSync(path_1.default.join(fullPath, 'docker-compose.yml')) ||
                        fs_1.default.existsSync(path_1.default.join(fullPath, 'docker-compose.yaml'));
                    const hasClaudeMd = fs_1.default.existsSync(path_1.default.join(fullPath, 'CLAUDE.md'));
                    const hasPyProject = fs_1.default.existsSync(path_1.default.join(fullPath, 'pyproject.toml')) ||
                        fs_1.default.existsSync(path_1.default.join(fullPath, 'requirements.txt'));
                    let type = 'other';
                    if (hasPackageJson && hasPyProject)
                        type = 'mixed';
                    else if (hasPackageJson)
                        type = 'nodejs';
                    else if (hasPyProject)
                        type = 'python';
                    else if (hasDockerCompose)
                        type = 'docker';
                    // Get description from CLAUDE.md or package.json
                    let description = '';
                    if (hasClaudeMd) {
                        try {
                            const content = fs_1.default.readFileSync(path_1.default.join(fullPath, 'CLAUDE.md'), 'utf-8');
                            const match = content.match(/^#\s+(.+)/m);
                            if (match)
                                description = match[1];
                        }
                        catch { }
                    }
                    else if (hasPackageJson) {
                        try {
                            const pkg = JSON.parse(fs_1.default.readFileSync(path_1.default.join(fullPath, 'package.json'), 'utf-8'));
                            description = pkg.description || pkg.name || '';
                        }
                        catch { }
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
                }
                catch (error) {
                    logger_1.default.warn(`Failed to stat project: ${item}`, { error });
                }
            }
        }
        catch (error) {
            logger_1.default.error('Failed to scan projects', { error });
        }
        return projects;
    }
    /**
     * Get Docker services status
     */
    async getDockerServices() {
        const services = [];
        try {
            const output = (0, child_process_1.execSync)('docker ps -a --format "{{.Names}}\t{{.Status}}\t{{.Ports}}"', { encoding: 'utf-8', timeout: 5000 }).trim();
            const lines = output.split('\n').filter(line => line.trim());
            for (const line of lines) {
                const [name, status, ports] = line.split('\t');
                // Parse port number
                let port;
                const portMatch = ports?.match(/(\d+)->(\d+)/);
                if (portMatch) {
                    port = parseInt(portMatch[1]);
                }
                // Parse uptime
                let uptime;
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
        }
        catch (error) {
            logger_1.default.error('Failed to get Docker services', { error });
        }
        return services;
    }
    /**
     * Convert container name to friendly service name
     */
    containerToServiceName(containerName) {
        const nameMap = {
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
    getProjectStatus(project) {
        // Recently modified (within 7 days) = in_progress
        const daysSinceModified = (Date.now() - project.lastModified.getTime()) / (1000 * 60 * 60 * 24);
        if (daysSinceModified < 7)
            return 'in_progress';
        if (project.hasDockerCompose || project.hasPackageJson)
            return 'completed';
        return 'not_started';
    }
    /**
     * Truncate name for display
     */
    truncateName(name, maxLen = 15) {
        if (name.length <= maxLen)
            return name;
        return name.slice(0, maxLen - 2) + '..';
    }
    // ========== 工作区 CRUD 方法 ==========
    /**
     * 获取工作区数据
     */
    getWorkspace() {
        return {
            ...this.workspace,
            layerData: {
                title: this.workspace.title,
                subtitle: this.workspace.subtitle,
                nodes: this.workspace.nodes,
                edges: this.workspace.edges,
            },
        };
    }
    /**
     * 推送节点到工作区（Claude 调用）
     */
    pushNodes(nodes, edges, options) {
        const now = Date.now();
        if (options?.replace) {
            // 替换模式：清空后添加
            this.workspace.nodes = [];
            this.workspace.edges = [];
        }
        // 添加节点，自动布局
        const existingCount = this.workspace.nodes.length;
        const newNodes = nodes.map((n, i) => {
            const idx = existingCount + i;
            const cols = 4;
            return {
                id: n.id || `node-${now}-${i}`,
                x: n.x ?? START_X + (idx % cols) * GRID_X,
                y: n.y ?? START_Y + Math.floor(idx / cols) * GRID_Y,
                name: n.name || '未命名',
                desc: n.desc || '',
                status: n.status || 'not_started',
                type: n.type || 'feature',
                hasChildren: n.hasChildren || false,
                createdAt: now,
                updatedAt: now,
            };
        });
        this.workspace.nodes.push(...newNodes);
        if (edges) {
            this.workspace.edges.push(...edges);
        }
        if (options?.title)
            this.workspace.title = options.title;
        if (options?.subtitle)
            this.workspace.subtitle = options.subtitle;
        this.workspace.lastUpdated = now;
        logger_1.default.info('Workspace nodes pushed', { count: newNodes.length, total: this.workspace.nodes.length });
        return this.workspace;
    }
    /**
     * 更新工作区（前端编辑）
     */
    updateWorkspace(data) {
        const now = Date.now();
        if (data.nodes) {
            this.workspace.nodes = data.nodes.map(n => ({
                ...n,
                updatedAt: now,
            }));
        }
        if (data.edges) {
            this.workspace.edges = data.edges;
        }
        if (data.title)
            this.workspace.title = data.title;
        if (data.subtitle)
            this.workspace.subtitle = data.subtitle;
        this.workspace.lastUpdated = now;
        logger_1.default.info('Workspace updated', { nodes: this.workspace.nodes.length, edges: this.workspace.edges.length });
        return this.workspace;
    }
    /**
     * 更新单个节点
     */
    updateNode(nodeId, updates) {
        const idx = this.workspace.nodes.findIndex(n => n.id === nodeId);
        if (idx === -1)
            return null;
        this.workspace.nodes[idx] = {
            ...this.workspace.nodes[idx],
            ...updates,
            updatedAt: Date.now(),
        };
        this.workspace.lastUpdated = Date.now();
        return this.workspace.nodes[idx];
    }
    /**
     * 删除节点
     */
    deleteNode(nodeId) {
        const idx = this.workspace.nodes.findIndex(n => n.id === nodeId);
        if (idx === -1)
            return false;
        this.workspace.nodes.splice(idx, 1);
        // 删除相关的边
        this.workspace.edges = this.workspace.edges.filter(e => e.from !== nodeId && e.to !== nodeId);
        this.workspace.lastUpdated = Date.now();
        return true;
    }
    /**
     * 添加边
     */
    addEdge(from, to) {
        // 检查节点是否存在
        const fromExists = this.workspace.nodes.some(n => n.id === from);
        const toExists = this.workspace.nodes.some(n => n.id === to);
        if (!fromExists || !toExists)
            return null;
        // 检查边是否已存在
        const exists = this.workspace.edges.some(e => e.from === from && e.to === to);
        if (exists)
            return null;
        const edge = { from, to };
        this.workspace.edges.push(edge);
        this.workspace.lastUpdated = Date.now();
        return edge;
    }
    /**
     * 删除边
     */
    deleteEdge(from, to) {
        const idx = this.workspace.edges.findIndex(e => e.from === from && e.to === to);
        if (idx === -1)
            return false;
        this.workspace.edges.splice(idx, 1);
        this.workspace.lastUpdated = Date.now();
        return true;
    }
    /**
     * 清空工作区
     */
    clearWorkspace() {
        this.workspace = {
            nodes: [],
            edges: [],
            title: '工作区',
            subtitle: '实时规划中',
            lastUpdated: Date.now(),
        };
        logger_1.default.info('Workspace cleared');
    }
    // ========== 白板项目管理方法 ==========
    /**
     * 从文件加载项目数据
     */
    loadProjects() {
        try {
            if (fs_1.default.existsSync(PROJECTS_FILE)) {
                const data = fs_1.default.readFileSync(PROJECTS_FILE, 'utf-8');
                const projects = JSON.parse(data);
                // 转换日期字符串为 Date 对象
                return projects.map(p => ({
                    ...p,
                    createdAt: new Date(p.createdAt),
                    updatedAt: new Date(p.updatedAt),
                }));
            }
        }
        catch (error) {
            logger_1.default.error('Failed to load projects', { error });
        }
        return [];
    }
    /**
     * 保存项目数据到文件
     */
    saveProjects(projects) {
        try {
            // 确保目录存在
            const dir = path_1.default.dirname(PROJECTS_FILE);
            if (!fs_1.default.existsSync(dir)) {
                fs_1.default.mkdirSync(dir, { recursive: true });
            }
            fs_1.default.writeFileSync(PROJECTS_FILE, JSON.stringify(projects, null, 2), 'utf-8');
            logger_1.default.info('Projects saved', { count: projects.length });
        }
        catch (error) {
            logger_1.default.error('Failed to save projects', { error });
            throw error;
        }
    }
    /**
     * 获取所有项目列表（不包含 nodes 和 edges）
     */
    getAllProjects() {
        const projects = this.loadProjects();
        return projects.map(({ id, name, createdAt, updatedAt }) => ({
            id,
            name,
            createdAt,
            updatedAt,
        }));
    }
    /**
     * 获取单个项目（包含 nodes 和 edges）
     */
    getProject(id) {
        const projects = this.loadProjects();
        return projects.find(p => p.id === id) || null;
    }
    /**
     * 创建新项目
     */
    createProject(name) {
        const projects = this.loadProjects();
        const now = new Date();
        const newProject = {
            id: `project-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name,
            nodes: [],
            edges: [],
            createdAt: now,
            updatedAt: now,
        };
        projects.push(newProject);
        this.saveProjects(projects);
        logger_1.default.info('Project created', { id: newProject.id, name });
        return newProject;
    }
    /**
     * 更新项目（保存 nodes 和 edges）
     */
    updateProject(id, data) {
        const projects = this.loadProjects();
        const idx = projects.findIndex(p => p.id === id);
        if (idx === -1)
            return null;
        const updated = {
            ...projects[idx],
            ...(data.name && { name: data.name }),
            ...(data.nodes && { nodes: data.nodes }),
            ...(data.edges && { edges: data.edges }),
            updatedAt: new Date(),
        };
        projects[idx] = updated;
        this.saveProjects(projects);
        logger_1.default.info('Project updated', { id, name: updated.name });
        return updated;
    }
    /**
     * 重命名项目
     */
    renameProject(id, name) {
        return this.updateProject(id, { name });
    }
    /**
     * 删除项目
     */
    deleteProject(id) {
        const projects = this.loadProjects();
        const idx = projects.findIndex(p => p.id === id);
        if (idx === -1)
            return false;
        projects.splice(idx, 1);
        this.saveProjects(projects);
        logger_1.default.info('Project deleted', { id });
        return true;
    }
}
exports.panoramaService = new PanoramaService();
//# sourceMappingURL=panorama.service.js.map