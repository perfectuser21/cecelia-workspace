import { LayerData, PanoramaNode, PanoramaEdge, PanoramaResponse, WhiteboardProject } from './panorama.types';
interface WorkspaceNode extends PanoramaNode {
    createdAt?: number;
    updatedAt?: number;
}
interface WorkspaceData {
    nodes: WorkspaceNode[];
    edges: PanoramaEdge[];
    title: string;
    subtitle: string;
    lastUpdated: number;
}
declare class PanoramaService {
    private cache;
    private cacheTime;
    private readonly CACHE_TTL;
    private workspace;
    /**
     * Get all panorama data (with caching)
     */
    getAllData(): Promise<PanoramaResponse>;
    /**
     * Force refresh cache
     */
    refreshData(): Promise<PanoramaResponse>;
    /**
     * Build complete panorama data from VPS
     * Provides separate root layers for different dimensions:
     * - runtime-root: 机器人状态（Docker服务）- 分组展示
     * - code-root: 项目列表 - 按活跃度分组
     * - dataflow-root: 任务流转 - 可钻取
     */
    private buildAllData;
    /**
     * 运行维度根层：展示服务分组
     */
    private buildRuntimeRootLayer;
    /**
     * 运行维度子层：每个分组的服务详情
     */
    private buildRuntimeGroupLayers;
    /**
     * 代码维度根层：按活跃度分组
     */
    private buildCodeRootLayer;
    /**
     * 代码维度子层：每个活跃度分组的项目列表
     */
    private buildCodeGroupLayers;
    /**
     * 数据流维度根层：可钻取的流程节点
     */
    private buildDataflowRootLayer;
    /**
     * 数据流维度子层：每个流程节点的详情
     */
    private buildDataflowChildLayers;
    /**
     * Build layer for a specific project
     */
    private buildProjectLayer;
    /**
     * Scan /home/xx/dev for projects
     */
    private scanProjects;
    /**
     * Get Docker services status
     */
    private getDockerServices;
    /**
     * Convert container name to friendly service name
     */
    private containerToServiceName;
    /**
     * Determine project status based on files
     */
    private getProjectStatus;
    /**
     * Truncate name for display
     */
    private truncateName;
    /**
     * 获取工作区数据
     */
    getWorkspace(): WorkspaceData & {
        layerData: LayerData;
    };
    /**
     * 推送节点到工作区（Claude 调用）
     */
    pushNodes(nodes: Partial<WorkspaceNode>[], edges?: PanoramaEdge[], options?: {
        replace?: boolean;
        title?: string;
        subtitle?: string;
    }): WorkspaceData;
    /**
     * 更新工作区（前端编辑）
     */
    updateWorkspace(data: {
        nodes?: WorkspaceNode[];
        edges?: PanoramaEdge[];
        title?: string;
        subtitle?: string;
    }): WorkspaceData;
    /**
     * 更新单个节点
     */
    updateNode(nodeId: string, updates: Partial<WorkspaceNode>): WorkspaceNode | null;
    /**
     * 删除节点
     */
    deleteNode(nodeId: string): boolean;
    /**
     * 添加边
     */
    addEdge(from: string, to: string): PanoramaEdge | null;
    /**
     * 删除边
     */
    deleteEdge(from: string, to: string): boolean;
    /**
     * 清空工作区
     */
    clearWorkspace(): void;
    /**
     * 从文件加载项目数据
     */
    private loadProjects;
    /**
     * 保存项目数据到文件
     */
    private saveProjects;
    /**
     * 获取所有项目列表（不包含 nodes 和 edges）
     */
    getAllProjects(): Omit<WhiteboardProject, 'nodes' | 'edges'>[];
    /**
     * 获取单个项目（包含 nodes 和 edges）
     */
    getProject(id: string): WhiteboardProject | null;
    /**
     * 创建新项目
     */
    createProject(name: string): WhiteboardProject;
    /**
     * 更新项目（保存 nodes 和 edges）
     */
    updateProject(id: string, data: {
        name?: string;
        nodes?: PanoramaNode[];
        edges?: PanoramaEdge[];
    }): WhiteboardProject | null;
    /**
     * 重命名项目
     */
    renameProject(id: string, name: string): WhiteboardProject | null;
    /**
     * 删除项目
     */
    deleteProject(id: string): boolean;
}
export declare const panoramaService: PanoramaService;
export {};
//# sourceMappingURL=panorama.service.d.ts.map