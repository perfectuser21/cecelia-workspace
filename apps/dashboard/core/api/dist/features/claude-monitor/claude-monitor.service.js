"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.claudeMonitorService = void 0;
// Claude Monitor service for business logic
const claude_monitor_repository_1 = require("./claude-monitor.repository");
const error_middleware_1 = require("../../shared/middleware/error.middleware");
const logger_1 = __importDefault(require("../../shared/utils/logger"));
class ClaudeMonitorService {
    // ===== Run Operations =====
    async createRun(data) {
        if (!data.session_id || !data.cwd) {
            throw new error_middleware_1.AppError('session_id and cwd are required', 400);
        }
        // Check if run already exists for this session
        const existingRun = await claude_monitor_repository_1.claudeMonitorRepository.findRunBySessionId(data.session_id);
        if (existingRun && existingRun.status === 'running') {
            logger_1.default.info('Returning existing running session', {
                session_id: data.session_id,
                run_id: existingRun.id,
            });
            return existingRun;
        }
        const run = await claude_monitor_repository_1.claudeMonitorRepository.createRun(data);
        logger_1.default.info('Claude run created', {
            id: run.id,
            session_id: run.session_id,
            source: run.source,
            agent_type: run.agent_type,
        });
        return run;
    }
    async getRunById(id) {
        const run = await claude_monitor_repository_1.claudeMonitorRepository.findRunById(id);
        if (!run) {
            throw new error_middleware_1.AppError(`Run not found: ${id}`, 404);
        }
        return run;
    }
    async getRunByIdOrSessionId(idOrSessionId) {
        let run = await claude_monitor_repository_1.claudeMonitorRepository.findRunById(idOrSessionId);
        if (!run) {
            run = await claude_monitor_repository_1.claudeMonitorRepository.findRunBySessionId(idOrSessionId);
        }
        if (!run) {
            throw new error_middleware_1.AppError(`Run not found: ${idOrSessionId}`, 404);
        }
        return run;
    }
    async getRunWithChildren(id) {
        const run = await this.getRunById(id);
        const children = await claude_monitor_repository_1.claudeMonitorRepository.findChildRuns(id);
        const eventsCount = await claude_monitor_repository_1.claudeMonitorRepository.countEvents(id);
        const lastEvent = await claude_monitor_repository_1.claudeMonitorRepository.findLastEvent(id);
        // Recursively build children tree
        const childrenWithDetails = await Promise.all(children.map(child => this.getRunWithChildren(child.id)));
        return {
            ...run,
            children: childrenWithDetails,
            events_count: eventsCount,
            last_event: lastEvent,
        };
    }
    async getAllRuns(options) {
        const runs = await claude_monitor_repository_1.claudeMonitorRepository.findAllRuns(options);
        const runningCount = await claude_monitor_repository_1.claudeMonitorRepository.countRunning();
        const totalCount = await claude_monitor_repository_1.claudeMonitorRepository.countTotal();
        // Attach children and last event to each run
        const runsWithDetails = await Promise.all(runs.map(async (run) => {
            const children = await claude_monitor_repository_1.claudeMonitorRepository.findChildRuns(run.id);
            const lastEvent = await claude_monitor_repository_1.claudeMonitorRepository.findLastEvent(run.id);
            const eventsCount = await claude_monitor_repository_1.claudeMonitorRepository.countEvents(run.id);
            return {
                ...run,
                children: children.map(child => ({
                    ...child,
                    children: [],
                    events_count: 0,
                    last_event: null,
                })),
                last_event: lastEvent,
                events_count: eventsCount,
            };
        }));
        return {
            runs: runsWithDetails,
            running_count: runningCount,
            total_count: totalCount,
        };
    }
    async updateRun(idOrSessionId, data) {
        const run = await this.getRunByIdOrSessionId(idOrSessionId);
        const updated = await claude_monitor_repository_1.claudeMonitorRepository.updateRun(run.id, data);
        if (!updated) {
            throw new error_middleware_1.AppError(`Failed to update run: ${run.id}`, 500);
        }
        logger_1.default.info('Claude run updated', {
            id: updated.id,
            session_id: updated.session_id,
            status: updated.status,
        });
        return updated;
    }
    async deleteRun(id) {
        const run = await this.getRunById(id);
        const deleted = await claude_monitor_repository_1.claudeMonitorRepository.deleteRun(run.id);
        if (!deleted) {
            throw new error_middleware_1.AppError(`Failed to delete run: ${id}`, 500);
        }
        logger_1.default.info('Claude run deleted', {
            id: run.id,
            session_id: run.session_id,
        });
    }
    async killRun(id) {
        const run = await this.getRunById(id);
        if (run.status !== 'running') {
            throw new error_middleware_1.AppError('Run is not running', 400);
        }
        // Try to kill the actual process if we have PID
        let killed = false;
        if (run.metadata?.pid) {
            try {
                process.kill(run.metadata.pid, 'SIGTERM');
                killed = true;
                logger_1.default.info('Process killed', {
                    pid: run.metadata.pid,
                    session_id: run.session_id,
                });
            }
            catch (error) {
                logger_1.default.warn('Failed to kill process', {
                    pid: run.metadata.pid,
                    error: error.message,
                });
            }
        }
        // Update run status to canceled
        const updatedRun = await claude_monitor_repository_1.claudeMonitorRepository.updateRun(id, {
            status: 'canceled',
            ended_at: Date.now(),
        });
        // Also cancel all child runs
        const children = await claude_monitor_repository_1.claudeMonitorRepository.findChildRuns(id);
        for (const child of children) {
            if (child.status === 'running') {
                await claude_monitor_repository_1.claudeMonitorRepository.updateRun(child.id, {
                    status: 'canceled',
                    ended_at: Date.now(),
                });
            }
        }
        return {
            success: true,
            killed,
            run: updatedRun,
        };
    }
    async getRunStats(id) {
        const run = await this.getRunById(id);
        const toolStats = await claude_monitor_repository_1.claudeMonitorRepository.getToolCallStats(id);
        const eventsCount = await claude_monitor_repository_1.claudeMonitorRepository.countEvents(id);
        return {
            run_id: id,
            token_input: run.token_input,
            token_output: run.token_output,
            events_count: eventsCount,
            tool_calls: toolStats,
        };
    }
    // ===== Event Operations =====
    async createEvent(runIdOrSessionId, data) {
        if (!data.type) {
            throw new error_middleware_1.AppError('type is required', 400);
        }
        // Find run by ID or session_id
        const run = await this.getRunByIdOrSessionId(runIdOrSessionId);
        const event = await claude_monitor_repository_1.claudeMonitorRepository.createEvent(run.id, data);
        // Auto-generate title from first user message
        if (data.type === 'user.message' && !run.title && data.payload?.text) {
            const text = data.payload.text;
            let title = text.slice(0, 50).trim();
            if (text.length > 50) {
                const lastSpace = title.lastIndexOf(' ');
                if (lastSpace > 20) {
                    title = title.slice(0, lastSpace);
                }
                title += '...';
            }
            await claude_monitor_repository_1.claudeMonitorRepository.updateRun(run.id, { title });
        }
        // Handle subagent creation from Task tool
        if (data.type === 'tool.finished' && data.tool_name === 'Task' && data.payload) {
            const agentId = data.payload.agentId;
            const subagentType = data.payload.subagent_type;
            const description = data.payload.description;
            if (agentId || subagentType) {
                const subagentData = {
                    session_id: agentId || `${run.session_id}-subagent-${Date.now()}`,
                    source: run.source,
                    cwd: run.cwd,
                    title: description || `${subagentType} agent`,
                    parent_run_id: run.id,
                    agent_type: subagentType || 'general-purpose',
                };
                await this.createRun(subagentData);
                logger_1.default.info('Subagent spawned', {
                    parent_id: run.id,
                    agent_type: subagentType,
                });
            }
        }
        return event;
    }
    async getEventsByRunId(runId, options = {}) {
        const events = await claude_monitor_repository_1.claudeMonitorRepository.findEventsByRunId(runId, options);
        return { events };
    }
    async getRecentEvents(runId, since) {
        const events = await claude_monitor_repository_1.claudeMonitorRepository.findRecentEvents(runId, since);
        return { events };
    }
}
exports.claudeMonitorService = new ClaudeMonitorService();
//# sourceMappingURL=claude-monitor.service.js.map