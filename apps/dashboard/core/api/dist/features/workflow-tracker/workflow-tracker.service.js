"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.workflowTrackerService = void 0;
// Workflow Tracker service for business logic
const workflow_tracker_repository_1 = require("./workflow-tracker.repository");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const logger_1 = __importDefault(require("../../shared/utils/logger"));
const PHASE_ORDER = ['PREPARE', 'VALIDATE', 'EXECUTE', 'VERIFY', 'FINALIZE'];
class WorkflowTrackerService {
    // ===== Run Operations =====
    async createRun(data) {
        if (!data.run_id || !data.bundle) {
            throw new error_middleware_1.AppError('run_id and bundle are required', 400);
        }
        // Check if run already exists
        const existing = await workflow_tracker_repository_1.workflowTrackerRepository.findRunById(data.run_id);
        if (existing) {
            logger_1.default.info('Returning existing run', { run_id: data.run_id });
            return existing;
        }
        const run = await workflow_tracker_repository_1.workflowTrackerRepository.createRun(data);
        logger_1.default.info('Workflow run created', {
            run_id: run.run_id,
            bundle: run.bundle,
        });
        return run;
    }
    async getRunById(runId) {
        const run = await workflow_tracker_repository_1.workflowTrackerRepository.findRunById(runId);
        if (!run) {
            throw new error_middleware_1.AppError(`Run not found: ${runId}`, 404);
        }
        return run;
    }
    async getAllRuns(options) {
        const runs = await workflow_tracker_repository_1.workflowTrackerRepository.findAllRuns(options);
        const runningCount = await workflow_tracker_repository_1.workflowTrackerRepository.countRunning();
        const totalCount = await workflow_tracker_repository_1.workflowTrackerRepository.countTotal();
        return {
            runs,
            running_count: runningCount,
            total_count: totalCount,
        };
    }
    async getRunWithProgress(runId) {
        const run = await this.getRunById(runId);
        const events = await workflow_tracker_repository_1.workflowTrackerRepository.findEventsByRunId(runId);
        const eventsCount = await workflow_tracker_repository_1.workflowTrackerRepository.countEvents(runId);
        const lastEvent = await workflow_tracker_repository_1.workflowTrackerRepository.findLastEvent(runId);
        // Build phase progress from events
        const phases = this.buildPhaseProgress(events, run.current_phase);
        return {
            ...run,
            phases,
            events_count: eventsCount,
            last_event: lastEvent,
        };
    }
    async updateRun(runId, data) {
        const run = await this.getRunById(runId);
        const updated = await workflow_tracker_repository_1.workflowTrackerRepository.updateRun(run.run_id, data);
        if (!updated) {
            throw new error_middleware_1.AppError(`Failed to update run: ${runId}`, 500);
        }
        logger_1.default.info('Workflow run updated', {
            run_id: updated.run_id,
            status: updated.status,
        });
        return updated;
    }
    async deleteRun(runId) {
        const run = await this.getRunById(runId);
        const deleted = await workflow_tracker_repository_1.workflowTrackerRepository.deleteRun(run.run_id);
        if (!deleted) {
            throw new error_middleware_1.AppError(`Failed to delete run: ${runId}`, 500);
        }
        logger_1.default.info('Workflow run deleted', { run_id: runId });
    }
    // ===== Event Operations =====
    async emitEvent(runId, data) {
        if (!data.phase || !data.substep || !data.status) {
            throw new error_middleware_1.AppError('phase, substep, and status are required', 400);
        }
        // Find or create run
        let run = await workflow_tracker_repository_1.workflowTrackerRepository.findRunById(runId);
        if (!run) {
            throw new error_middleware_1.AppError(`Run not found: ${runId}`, 404);
        }
        const event = await workflow_tracker_repository_1.workflowTrackerRepository.createEvent(runId, data);
        // Update run's current phase/substep
        const updateData = {
            current_phase: data.phase,
            current_substep: data.substep,
        };
        // Update status based on event
        if (data.status === 'fail') {
            updateData.status = 'fail';
            updateData.ended_at = new Date();
        }
        else if (data.status === 'stuck') {
            updateData.status = 'stuck';
        }
        else if (data.status === 'success' && data.phase === 'FINALIZE') {
            // Check if this is the last substep
            updateData.status = 'success';
            updateData.ended_at = new Date();
            if (run.started_at) {
                updateData.total_duration_ms = Date.now() - new Date(run.started_at).getTime();
            }
        }
        await workflow_tracker_repository_1.workflowTrackerRepository.updateRun(runId, updateData);
        return event;
    }
    async getEventsByRunId(runId, options = {}) {
        const events = await workflow_tracker_repository_1.workflowTrackerRepository.findEventsByRunId(runId, options);
        return { events };
    }
    // ===== Stuck Detection =====
    async detectAndMarkStuck(thresholdMs = 300000) {
        const stuckEvents = await workflow_tracker_repository_1.workflowTrackerRepository.findStuckStartEvents(thresholdMs);
        for (const event of stuckEvents) {
            await workflow_tracker_repository_1.workflowTrackerRepository.markSubstepStuck(event.run_id, event.phase, event.substep);
            logger_1.default.warn('Substep marked as stuck', {
                run_id: event.run_id,
                phase: event.phase,
                substep: event.substep,
            });
        }
        return stuckEvents.length;
    }
    // ===== Helper Methods =====
    buildPhaseProgress(events, currentPhase) {
        const phases = PHASE_ORDER.map(phase => ({
            phase,
            status: 'pending',
            substeps: [],
        }));
        // Group events by phase and substep
        const eventMap = new Map();
        for (const event of events) {
            const key = `${event.phase}:${event.substep}`;
            if (!eventMap.has(key)) {
                eventMap.set(key, []);
            }
            eventMap.get(key).push(event);
        }
        // Build substep progress for each phase
        const currentPhaseIndex = PHASE_ORDER.indexOf(currentPhase);
        for (let i = 0; i < phases.length; i++) {
            const phaseData = phases[i];
            const substepMap = new Map();
            // Find all substeps for this phase
            for (const [key, evts] of eventMap.entries()) {
                if (!key.startsWith(phaseData.phase + ':'))
                    continue;
                const substepId = key.split(':')[1];
                const lastEvent = evts[evts.length - 1];
                const startEvent = evts.find(e => e.status === 'start');
                const endEvent = evts.find(e => ['success', 'fail', 'stuck'].includes(e.status));
                substepMap.set(substepId, {
                    id: substepId,
                    name: substepId,
                    status: this.mapEventStatus(lastEvent.status),
                    duration_ms: endEvent?.duration_ms || null,
                    started_at: startEvent?.created_at || null,
                    message: lastEvent.message,
                });
            }
            phaseData.substeps = Array.from(substepMap.values());
            // Determine phase status
            if (i < currentPhaseIndex) {
                phaseData.status = 'success';
            }
            else if (i === currentPhaseIndex) {
                const hasFailOrStuck = phaseData.substeps.some(s => s.status === 'fail' || s.status === 'stuck');
                phaseData.status = hasFailOrStuck ? 'fail' : 'running';
            }
            else {
                phaseData.status = 'pending';
            }
        }
        return phases;
    }
    mapEventStatus(status) {
        switch (status) {
            case 'start':
                return 'running';
            case 'success':
                return 'success';
            case 'fail':
                return 'fail';
            case 'stuck':
                return 'stuck';
            default:
                return 'pending';
        }
    }
    // ===== V2: Event Stream =====
    async getEventStream(runId) {
        const run = await this.getRunById(runId);
        const events = await workflow_tracker_repository_1.workflowTrackerRepository.findEventsByRunId(runId, { limit: 500 });
        const streamEvents = events.map(event => this.formatEventToStream(event));
        return {
            run,
            events: streamEvents,
        };
    }
    formatEventToStream(event) {
        const time = new Date(event.created_at).toLocaleTimeString('zh-CN', {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
        });
        // 根据 event_type 或 status 决定显示样式
        const { icon, title, type, expandable } = this.getEventDisplay(event);
        // 生成内容描述
        const content = this.getEventContent(event);
        return {
            id: event.id,
            time,
            icon,
            title,
            content,
            type,
            expandable,
            details: event.details || undefined,
        };
    }
    getEventDisplay(event) {
        // 优先使用 event_type
        if (event.event_type) {
            switch (event.event_type) {
                case 'prd_read':
                    return { icon: '📖', title: '读取 PRD', type: 'info', expandable: true };
                case 'ai_understand':
                    return { icon: '🧠', title: 'AI 理解', type: 'ai', expandable: true };
                case 'task_start':
                    return { icon: '📝', title: `任务: ${event.substep}`, type: 'action', expandable: false };
                case 'task_complete':
                    return { icon: '✅', title: '任务完成', type: 'success', expandable: true };
                case 'file_write':
                    return { icon: '💾', title: '写入文件', type: 'info', expandable: true };
                case 'claude_call':
                    return { icon: '🤖', title: 'Claude 调用', type: 'ai', expandable: true };
                case 'qc_result':
                    return { icon: '🔍', title: '质检结果', type: 'ai', expandable: true };
                case 'decision':
                    return { icon: '⚖️', title: '决策', type: 'ai', expandable: true };
                case 'error':
                    return { icon: '❌', title: '错误', type: 'error', expandable: true };
                default:
                    return { icon: 'ℹ️', title: event.substep, type: 'info', expandable: false };
            }
        }
        // 回退到 status 判断
        switch (event.status) {
            case 'start':
                return { icon: '▶️', title: `${event.substep} 开始`, type: 'action', expandable: false };
            case 'success':
                return { icon: '✅', title: `${event.substep} 完成`, type: 'success', expandable: false };
            case 'fail':
                return { icon: '❌', title: `${event.substep} 失败`, type: 'error', expandable: true };
            case 'stuck':
                return { icon: '⚠️', title: `${event.substep} 卡住`, type: 'error', expandable: false };
            default:
                return { icon: 'ℹ️', title: event.substep, type: 'info', expandable: false };
        }
    }
    getEventContent(event) {
        // 优先使用 description
        if (event.description) {
            return event.description;
        }
        // 从 details 中提取关键信息
        if (event.details) {
            const d = event.details;
            if (d.tasks && Array.isArray(d.tasks)) {
                return `拆分为 ${d.tasks.length} 个子任务`;
            }
            if (d.content) {
                return String(d.content).substring(0, 100) + (d.content.length > 100 ? '...' : '');
            }
            if (d.path) {
                return `${d.path}${d.lines ? ` (${d.lines}行)` : ''}`;
            }
            if (d.score !== undefined) {
                return `得分: ${d.score}`;
            }
            if (d.action) {
                return `${d.action}${d.reason ? `: ${d.reason}` : ''}`;
            }
        }
        // 回退到 message
        if (event.message) {
            return event.message;
        }
        // 默认
        if (event.duration_ms) {
            return `耗时 ${Math.round(event.duration_ms / 1000)}s`;
        }
        return '';
    }
}
exports.workflowTrackerService = new WorkflowTrackerService();
//# sourceMappingURL=workflow-tracker.service.js.map