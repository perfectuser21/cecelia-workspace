// Claude Monitor service for business logic
import { claudeMonitorRepository } from './claude-monitor.repository';
import {
  ClaudeRun,
  ClaudeRunWithChildren,
  ClaudeEvent,
  CreateRunDTO,
  UpdateRunDTO,
  CreateEventDTO,
  RunStatistics,
  RunListResponse,
  EventListResponse,
} from './claude-monitor.types';
import { AppError } from '../../shared/middleware/error.middleware';
import logger from '../../shared/utils/logger';

class ClaudeMonitorService {
  // ===== Run Operations =====

  async createRun(data: CreateRunDTO): Promise<ClaudeRun> {
    if (!data.session_id || !data.cwd) {
      throw new AppError('session_id and cwd are required', 400);
    }

    // Check if run already exists for this session
    const existingRun = await claudeMonitorRepository.findRunBySessionId(data.session_id);
    if (existingRun && existingRun.status === 'running') {
      logger.info('Returning existing running session', {
        session_id: data.session_id,
        run_id: existingRun.id,
      });
      return existingRun;
    }

    const run = await claudeMonitorRepository.createRun(data);
    logger.info('Claude run created', {
      id: run.id,
      session_id: run.session_id,
      source: run.source,
      agent_type: run.agent_type,
    });

    return run;
  }

  async getRunById(id: string): Promise<ClaudeRun> {
    const run = await claudeMonitorRepository.findRunById(id);
    if (!run) {
      throw new AppError(`Run not found: ${id}`, 404);
    }
    return run;
  }

  async getRunByIdOrSessionId(idOrSessionId: string): Promise<ClaudeRun> {
    let run = await claudeMonitorRepository.findRunById(idOrSessionId);
    if (!run) {
      run = await claudeMonitorRepository.findRunBySessionId(idOrSessionId);
    }
    if (!run) {
      throw new AppError(`Run not found: ${idOrSessionId}`, 404);
    }
    return run;
  }

  async getRunWithChildren(id: string): Promise<ClaudeRunWithChildren> {
    const run = await this.getRunById(id);
    const children = await claudeMonitorRepository.findChildRuns(id);
    const eventsCount = await claudeMonitorRepository.countEvents(id);
    const lastEvent = await claudeMonitorRepository.findLastEvent(id);

    // Recursively build children tree
    const childrenWithDetails = await Promise.all(
      children.map(child => this.getRunWithChildren(child.id))
    );

    return {
      ...run,
      children: childrenWithDetails,
      events_count: eventsCount,
      last_event: lastEvent,
    };
  }

  async getAllRuns(options: {
    status?: string;
    limit?: number;
    offset?: number;
  }): Promise<RunListResponse> {
    const runs = await claudeMonitorRepository.findAllRuns(options);
    const runningCount = await claudeMonitorRepository.countRunning();
    const totalCount = await claudeMonitorRepository.countTotal();

    // Attach children and last event to each run
    const runsWithDetails = await Promise.all(
      runs.map(async run => {
        const children = await claudeMonitorRepository.findChildRuns(run.id);
        const lastEvent = await claudeMonitorRepository.findLastEvent(run.id);
        const eventsCount = await claudeMonitorRepository.countEvents(run.id);

        return {
          ...run,
          children: children.map(child => ({
            ...child,
            children: [],
            events_count: 0,
            last_event: null,
          })) as ClaudeRunWithChildren[],
          last_event: lastEvent,
          events_count: eventsCount,
        };
      })
    );

    return {
      runs: runsWithDetails,
      running_count: runningCount,
      total_count: totalCount,
    };
  }

  async updateRun(idOrSessionId: string, data: UpdateRunDTO): Promise<ClaudeRun> {
    const run = await this.getRunByIdOrSessionId(idOrSessionId);
    const updated = await claudeMonitorRepository.updateRun(run.id, data);

    if (!updated) {
      throw new AppError(`Failed to update run: ${run.id}`, 500);
    }

    logger.info('Claude run updated', {
      id: updated.id,
      session_id: updated.session_id,
      status: updated.status,
    });

    return updated;
  }

  async deleteRun(id: string): Promise<void> {
    const run = await this.getRunById(id);
    const deleted = await claudeMonitorRepository.deleteRun(run.id);

    if (!deleted) {
      throw new AppError(`Failed to delete run: ${id}`, 500);
    }

    logger.info('Claude run deleted', {
      id: run.id,
      session_id: run.session_id,
    });
  }

  async killRun(id: string): Promise<{ success: boolean; killed: boolean; run: ClaudeRun }> {
    const run = await this.getRunById(id);

    if (run.status !== 'running') {
      throw new AppError('Run is not running', 400);
    }

    // Try to kill the actual process if we have PID
    let killed = false;
    if (run.metadata?.pid) {
      try {
        process.kill(run.metadata.pid, 'SIGTERM');
        killed = true;
        logger.info('Process killed', {
          pid: run.metadata.pid,
          session_id: run.session_id,
        });
      } catch (error: any) {
        logger.warn('Failed to kill process', {
          pid: run.metadata.pid,
          error: error.message,
        });
      }
    }

    // Update run status to canceled
    const updatedRun = await claudeMonitorRepository.updateRun(id, {
      status: 'canceled',
      ended_at: Date.now(),
    });

    // Also cancel all child runs
    const children = await claudeMonitorRepository.findChildRuns(id);
    for (const child of children) {
      if (child.status === 'running') {
        await claudeMonitorRepository.updateRun(child.id, {
          status: 'canceled',
          ended_at: Date.now(),
        });
      }
    }

    return {
      success: true,
      killed,
      run: updatedRun!,
    };
  }

  async getRunStats(id: string): Promise<RunStatistics> {
    const run = await this.getRunById(id);
    const toolStats = await claudeMonitorRepository.getToolCallStats(id);
    const eventsCount = await claudeMonitorRepository.countEvents(id);

    return {
      run_id: id,
      token_input: run.token_input,
      token_output: run.token_output,
      events_count: eventsCount,
      tool_calls: toolStats,
    };
  }

  // ===== Event Operations =====

  async createEvent(runIdOrSessionId: string, data: CreateEventDTO): Promise<ClaudeEvent> {
    if (!data.type) {
      throw new AppError('type is required', 400);
    }

    // Find run by ID or session_id
    const run = await this.getRunByIdOrSessionId(runIdOrSessionId);

    const event = await claudeMonitorRepository.createEvent(run.id, data);

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
      await claudeMonitorRepository.updateRun(run.id, { title });
    }

    // Handle subagent creation from Task tool
    if (data.type === 'tool.finished' && data.tool_name === 'Task' && data.payload) {
      const agentId = data.payload.agentId;
      const subagentType = data.payload.subagent_type;
      const description = data.payload.description;

      if (agentId || subagentType) {
        const subagentData: CreateRunDTO = {
          session_id: agentId || `${run.session_id}-subagent-${Date.now()}`,
          source: run.source,
          cwd: run.cwd,
          title: description || `${subagentType} agent`,
          parent_run_id: run.id,
          agent_type: subagentType || 'general-purpose',
        };

        await this.createRun(subagentData);
        logger.info('Subagent spawned', {
          parent_id: run.id,
          agent_type: subagentType,
        });
      }
    }

    return event;
  }

  async getEventsByRunId(
    runId: string,
    options: { limit?: number; offset?: number } = {}
  ): Promise<EventListResponse> {
    const events = await claudeMonitorRepository.findEventsByRunId(runId, options);
    return { events };
  }

  async getRecentEvents(runId: string, since: number): Promise<EventListResponse> {
    const events = await claudeMonitorRepository.findRecentEvents(runId, since);
    return { events };
  }
}

export const claudeMonitorService = new ClaudeMonitorService();
