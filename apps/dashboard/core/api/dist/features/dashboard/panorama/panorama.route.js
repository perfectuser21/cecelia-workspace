"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// Panorama API routes
const express_1 = require("express");
const panorama_service_1 = require("./panorama.service");
const logger_1 = __importDefault(require("../../../shared/utils/logger"));
const router = (0, express_1.Router)();
/**
 * GET /v1/panorama
 * Get all panorama data
 */
router.get('/', async (req, res) => {
    try {
        const data = await panorama_service_1.panoramaService.getAllData();
        res.json(data);
    }
    catch (error) {
        logger_1.default.error('Failed to get panorama data', { error });
        res.status(500).json({ error: 'Failed to get panorama data' });
    }
});
/**
 * GET /v1/panorama/layer/:id
 * Get specific layer data
 */
router.get('/layer/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const data = await panorama_service_1.panoramaService.getAllData();
        if (!data.allData[id]) {
            res.status(404).json({ error: `Layer '${id}' not found` });
            return;
        }
        res.json({
            layer: data.allData[id],
            lastUpdated: data.lastUpdated,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to get panorama layer', { error, layerId: req.params.id });
        res.status(500).json({ error: 'Failed to get panorama layer' });
    }
});
/**
 * POST /v1/panorama/refresh
 * Force refresh panorama cache
 */
router.post('/refresh', async (req, res) => {
    try {
        const data = await panorama_service_1.panoramaService.refreshData();
        res.json({
            success: true,
            message: 'Panorama data refreshed',
            lastUpdated: data.lastUpdated,
        });
    }
    catch (error) {
        logger_1.default.error('Failed to refresh panorama data', { error });
        res.status(500).json({ error: 'Failed to refresh panorama data' });
    }
});
// ========== 工作区 API ==========
/**
 * GET /v1/panorama/workspace
 * 获取工作区数据
 */
router.get('/workspace', (req, res) => {
    try {
        const data = panorama_service_1.panoramaService.getWorkspace();
        res.json(data);
    }
    catch (error) {
        logger_1.default.error('Failed to get workspace', { error });
        res.status(500).json({ error: 'Failed to get workspace' });
    }
});
/**
 * POST /v1/panorama/workspace
 * 推送节点到工作区（Claude 调用）
 * Body: { nodes: [], edges?: [], replace?: boolean, title?: string, subtitle?: string }
 */
router.post('/workspace', (req, res) => {
    try {
        const { nodes, edges, replace, title, subtitle } = req.body;
        if (!nodes || !Array.isArray(nodes)) {
            res.status(400).json({ error: 'nodes array is required' });
            return;
        }
        const data = panorama_service_1.panoramaService.pushNodes(nodes, edges, { replace, title, subtitle });
        res.json({ success: true, workspace: data });
    }
    catch (error) {
        logger_1.default.error('Failed to push to workspace', { error });
        res.status(500).json({ error: 'Failed to push to workspace' });
    }
});
/**
 * PUT /v1/panorama/workspace
 * 更新工作区（前端编辑保存）
 * Body: { nodes?: [], edges?: [], title?: string, subtitle?: string }
 */
router.put('/workspace', (req, res) => {
    try {
        const { nodes, edges, title, subtitle } = req.body;
        const data = panorama_service_1.panoramaService.updateWorkspace({ nodes, edges, title, subtitle });
        res.json({ success: true, workspace: data });
    }
    catch (error) {
        logger_1.default.error('Failed to update workspace', { error });
        res.status(500).json({ error: 'Failed to update workspace' });
    }
});
/**
 * PATCH /v1/panorama/workspace/node/:id
 * 更新单个节点
 */
router.patch('/workspace/node/:id', (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        const node = panorama_service_1.panoramaService.updateNode(id, updates);
        if (!node) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        res.json({ success: true, node });
    }
    catch (error) {
        logger_1.default.error('Failed to update node', { error });
        res.status(500).json({ error: 'Failed to update node' });
    }
});
/**
 * DELETE /v1/panorama/workspace/node/:id
 * 删除节点
 */
router.delete('/workspace/node/:id', (req, res) => {
    try {
        const { id } = req.params;
        const deleted = panorama_service_1.panoramaService.deleteNode(id);
        if (!deleted) {
            res.status(404).json({ error: 'Node not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        logger_1.default.error('Failed to delete node', { error });
        res.status(500).json({ error: 'Failed to delete node' });
    }
});
/**
 * POST /v1/panorama/workspace/edge
 * 添加边
 * Body: { from: string, to: string }
 */
router.post('/workspace/edge', (req, res) => {
    try {
        const { from, to } = req.body;
        if (!from || !to) {
            res.status(400).json({ error: 'from and to are required' });
            return;
        }
        const edge = panorama_service_1.panoramaService.addEdge(from, to);
        if (!edge) {
            res.status(400).json({ error: 'Invalid nodes or edge already exists' });
            return;
        }
        res.json({ success: true, edge });
    }
    catch (error) {
        logger_1.default.error('Failed to add edge', { error });
        res.status(500).json({ error: 'Failed to add edge' });
    }
});
/**
 * DELETE /v1/panorama/workspace/edge
 * 删除边
 * Body: { from: string, to: string }
 */
router.delete('/workspace/edge', (req, res) => {
    try {
        const { from, to } = req.body;
        if (!from || !to) {
            res.status(400).json({ error: 'from and to are required' });
            return;
        }
        const deleted = panorama_service_1.panoramaService.deleteEdge(from, to);
        if (!deleted) {
            res.status(404).json({ error: 'Edge not found' });
            return;
        }
        res.json({ success: true });
    }
    catch (error) {
        logger_1.default.error('Failed to delete edge', { error });
        res.status(500).json({ error: 'Failed to delete edge' });
    }
});
/**
 * DELETE /v1/panorama/workspace
 * 清空工作区
 */
router.delete('/workspace', (req, res) => {
    try {
        panorama_service_1.panoramaService.clearWorkspace();
        res.json({ success: true, message: 'Workspace cleared' });
    }
    catch (error) {
        logger_1.default.error('Failed to clear workspace', { error });
        res.status(500).json({ error: 'Failed to clear workspace' });
    }
});
// ========== 白板项目管理 API ==========
/**
 * GET /v1/panorama/projects
 * 获取所有项目列表
 */
router.get('/projects', (req, res) => {
    try {
        const projects = panorama_service_1.panoramaService.getAllProjects();
        res.json({ success: true, projects });
    }
    catch (error) {
        logger_1.default.error('Failed to get projects', { error });
        res.status(500).json({ error: 'Failed to get projects' });
    }
});
/**
 * POST /v1/panorama/projects
 * 创建新项目
 * Body: { name: string }
 */
router.post('/projects', (req, res) => {
    try {
        const { name } = req.body;
        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const project = panorama_service_1.panoramaService.createProject(name.trim());
        res.json({ success: true, project });
    }
    catch (error) {
        logger_1.default.error('Failed to create project', { error });
        res.status(500).json({ error: 'Failed to create project' });
    }
});
/**
 * GET /v1/panorama/projects/:id
 * 获取单个项目（包含 nodes 和 edges）
 */
router.get('/projects/:id', (req, res) => {
    try {
        const { id } = req.params;
        const project = panorama_service_1.panoramaService.getProject(id);
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json({ success: true, project });
    }
    catch (error) {
        logger_1.default.error('Failed to get project', { error, projectId: req.params.id });
        res.status(500).json({ error: 'Failed to get project' });
    }
});
/**
 * PUT /v1/panorama/projects/:id
 * 更新项目（保存 nodes 和 edges）
 * Body: { name?: string, nodes?: [], edges?: [] }
 */
router.put('/projects/:id', (req, res) => {
    try {
        const { id } = req.params;
        const { name, nodes, edges } = req.body;
        const project = panorama_service_1.panoramaService.updateProject(id, { name, nodes, edges });
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json({ success: true, project });
    }
    catch (error) {
        logger_1.default.error('Failed to update project', { error, projectId: req.params.id });
        res.status(500).json({ error: 'Failed to update project' });
    }
});
/**
 * DELETE /v1/panorama/projects/:id
 * 删除项目
 */
router.delete('/projects/:id', (req, res) => {
    try {
        const { id } = req.params;
        const deleted = panorama_service_1.panoramaService.deleteProject(id);
        if (!deleted) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json({ success: true, message: 'Project deleted' });
    }
    catch (error) {
        logger_1.default.error('Failed to delete project', { error, projectId: req.params.id });
        res.status(500).json({ error: 'Failed to delete project' });
    }
});
/**
 * PATCH /v1/panorama/projects/:id/name
 * 重命名项目
 * Body: { name: string }
 */
router.patch('/projects/:id/name', (req, res) => {
    try {
        const { id } = req.params;
        const { name } = req.body;
        if (!name || typeof name !== 'string') {
            res.status(400).json({ error: 'name is required' });
            return;
        }
        const project = panorama_service_1.panoramaService.renameProject(id, name.trim());
        if (!project) {
            res.status(404).json({ error: 'Project not found' });
            return;
        }
        res.json({ success: true, project });
    }
    catch (error) {
        logger_1.default.error('Failed to rename project', { error, projectId: req.params.id });
        res.status(500).json({ error: 'Failed to rename project' });
    }
});
exports.default = router;
//# sourceMappingURL=panorama.route.js.map