/**
 * Intent Parser
 * Parses natural language input to identify user intent
 */

import type { IntentType, IntentEntity, IntentResult } from './types.js';

interface BrainFocus {
  project?: string;
  goal?: string;
}

/**
 * Parse natural language text to identify intent
 */
export function parseIntent(text: string, brainFocus?: BrainFocus): IntentResult {
  const normalized = text.trim().toLowerCase();

  // Handle empty/blank input
  if (!normalized) {
    return {
      intent_type: 'query_status',
      confidence: 0.3,
      entities: [],
      suggested_action: {
        type: 'clarify',
        parameters: {
          message: '请告诉我您想做什么？',
        },
      },
    };
  }

  // Detect intent type
  const intentType = detectIntentType(normalized);
  const entities = extractEntities(normalized, intentType, brainFocus);
  const confidence = calculateConfidence(normalized, intentType, entities);

  return {
    intent_type: intentType,
    confidence,
    entities,
    suggested_action: buildSuggestedAction(intentType, entities, brainFocus),
  };
}

/**
 * Detect intent type from text
 */
function detectIntentType(text: string): IntentType {
  // Create task patterns
  const createPatterns = [
    /创建.*任务/,
    /新建.*任务/,
    /我想.*任务/,
    /添加.*任务/,
    /做.*功能/,
    /实现/,
    /开发/,
  ];

  // Query status patterns
  const queryPatterns = [
    /查看.*状态/,
    /当前.*任务/,
    /进度.*如何/,
    /什么.*状态/,
    /查询/,
    /看.*任务/,
  ];

  // Update progress patterns
  const updatePatterns = [
    /更新.*进度/,
    /完成.*%/,
    /进度.*到/,
    /标记.*完成/,
    /改.*状态/,
  ];

  // Check patterns in order
  if (createPatterns.some(pattern => pattern.test(text))) {
    return 'create_task';
  }

  if (updatePatterns.some(pattern => pattern.test(text))) {
    return 'update_progress';
  }

  if (queryPatterns.some(pattern => pattern.test(text))) {
    return 'query_status';
  }

  // Default: if text is vague, assume query
  return 'query_status';
}

/**
 * Extract entities from text based on intent type
 */
function extractEntities(
  text: string,
  intentType: IntentType,
  brainFocus?: BrainFocus
): IntentEntity[] {
  const entities: IntentEntity[] = [];

  if (intentType === 'create_task') {
    // Extract title (simple heuristic: after "任务" or action verbs)
    const titleMatch = text.match(/(?:创建|新建|我想|添加|做|实现|开发)(.+?)(?:任务)?$/);
    if (titleMatch && titleMatch[1]) {
      entities.push({
        type: 'title',
        value: titleMatch[1].trim(),
        confidence: 0.8,
      });
    }

    // Extract priority (P0/P1/P2)
    const priorityMatch = text.match(/P([012])/i);
    if (priorityMatch) {
      entities.push({
        type: 'priority',
        value: `P${priorityMatch[1]}`,
        confidence: 0.9,
      });
    }

    // Associate with current focus if available
    if (brainFocus?.project) {
      entities.push({
        type: 'project',
        value: brainFocus.project,
        confidence: 0.7,
      });
    }

    if (brainFocus?.goal) {
      entities.push({
        type: 'goal',
        value: brainFocus.goal,
        confidence: 0.7,
      });
    }
  }

  if (intentType === 'update_progress') {
    // Extract progress percentage
    const progressMatch = text.match(/(\d+)%/);
    if (progressMatch) {
      entities.push({
        type: 'progress',
        value: progressMatch[1],
        confidence: 0.9,
      });
    }
  }

  return entities;
}

/**
 * Calculate confidence score based on text clarity and entity extraction
 */
function calculateConfidence(
  text: string,
  intentType: IntentType,
  entities: IntentEntity[]
): number {
  let confidence = 0.5;

  // Boost confidence if text contains clear intent keywords
  const intentKeywords = {
    create_task: ['创建', '新建', '添加', '任务'],
    query_status: ['查看', '状态', '当前', '进度'],
    update_progress: ['更新', '进度', '完成', '%'],
  };

  const keywords = intentKeywords[intentType];
  const hasKeywords = keywords.some(keyword => text.includes(keyword));
  if (hasKeywords) {
    confidence += 0.2;
  }

  // Boost confidence based on extracted entities
  if (entities.length > 0) {
    confidence += Math.min(entities.length * 0.1, 0.3);
  }

  // Penalize very short or vague text
  if (text.length < 5) {
    confidence -= 0.3;
  }

  return Math.max(0, Math.min(1, confidence));
}

/**
 * Build suggested action based on intent and entities
 */
function buildSuggestedAction(
  intentType: IntentType,
  entities: IntentEntity[],
  brainFocus?: BrainFocus
): { type: string; parameters: Record<string, unknown> } {
  if (intentType === 'create_task') {
    const title = entities.find(e => e.type === 'title')?.value;
    const priority = entities.find(e => e.type === 'priority')?.value || 'P1';
    const project = entities.find(e => e.type === 'project')?.value || brainFocus?.project;
    const goal = entities.find(e => e.type === 'goal')?.value || brainFocus?.goal;

    if (!title) {
      return {
        type: 'clarify',
        parameters: {
          message: '请提供任务标题',
          missing: ['title'],
        },
      };
    }

    return {
      type: 'create_task',
      parameters: {
        title,
        priority,
        project,
        goal,
      },
    };
  }

  if (intentType === 'query_status') {
    return {
      type: 'query_tasks',
      parameters: {
        filter: brainFocus ? { project: brainFocus.project } : {},
      },
    };
  }

  if (intentType === 'update_progress') {
    const progress = entities.find(e => e.type === 'progress')?.value;

    return {
      type: 'update_task_progress',
      parameters: {
        progress: progress ? parseInt(progress, 10) : undefined,
      },
    };
  }

  return {
    type: 'unknown',
    parameters: {},
  };
}
