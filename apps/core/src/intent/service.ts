/**
 * Intent Recognition Service
 * Core service for analyzing natural language and recognizing user intent
 */

import type {
  IntentType,
  IntentRecognitionRequest,
  IntentRecognitionResult,
  ExtractedEntities,
} from './types.js';

import {
  extractPriority,
  extractStatus,
  extractTitle,
  isGoalCreation,
  isProjectCreation,
  isTaskCreation,
  isTaskQuery,
  isTaskUpdate,
  calculateConfidence,
  needsConfirmation as shouldConfirm,
} from './nlp-parser.js';

/**
 * Recognize intent from natural language input
 *
 * Note: Context support is partially implemented. The context parameter is accepted
 * and passed to entity extraction, but full session management (maintaining conversation
 * history, resolving pronouns like "那个目标") is not yet implemented.
 * For full context support, see https://github.com/cecelia/roadmap/issues/KR1-context
 */
export function recognizeIntent(request: IntentRecognitionRequest): IntentRecognitionResult {
  const { input, context } = request;

  // Determine intent type
  const intent = detectIntentType(input);

  // Extract entities based on intent
  const entities = extractEntities(input, intent, context);

  // Calculate confidence
  let confidence = calculateConfidence(input, intent);

  // Reduce confidence if title is missing for creation intents (防止空标题)
  if ((intent === 'CREATE_GOAL' || intent === 'CREATE_PROJECT' || intent === 'CREATE_TASK') &&
      (!entities.title || entities.title.length === 0)) {
    confidence = Math.min(confidence, 0.3);  // Very low confidence
  }

  // Determine if confirmation needed
  const needsConfirmation = shouldConfirm(confidence, input);

  // Generate human-readable understanding
  const understanding = generateUnderstanding(intent, entities, input);

  return {
    intent,
    entities,
    confidence,
    needsConfirmation,
    understanding,
  };
}

/**
 * Detect the intent type from natural language
 */
function detectIntentType(text: string): IntentType {
  // Check in priority order (more specific first)
  if (isGoalCreation(text)) {
    return 'CREATE_GOAL';
  }

  if (isProjectCreation(text)) {
    return 'CREATE_PROJECT';
  }

  if (isTaskUpdate(text)) {
    return 'UPDATE_TASK';
  }

  if (isTaskQuery(text)) {
    return 'QUERY_TASKS';
  }

  if (isTaskCreation(text)) {
    return 'CREATE_TASK';
  }

  return 'UNKNOWN';
}

/**
 * Extract relevant entities from text based on intent
 */
function extractEntities(
  text: string,
  intent: IntentType,
  context?: IntentRecognitionRequest['context']
): ExtractedEntities {
  const entities: ExtractedEntities = {};

  // Extract priority
  const priority = extractPriority(text);
  if (priority) {
    entities.priority = priority;
  } else {
    // Default to P2 (normal priority) if not specified
    entities.priority = 'P2';
  }

  // Extract title for creation intents
  if (intent === 'CREATE_GOAL' || intent === 'CREATE_PROJECT' || intent === 'CREATE_TASK') {
    const extractedTitle = extractTitle(text);

    // Validate title is not empty (防止数据完整性问题)
    if (extractedTitle && extractedTitle.length > 0) {
      entities.title = extractedTitle;

      // Set entity type
      if (intent === 'CREATE_GOAL') {
        entities.type = 'goal';
      } else if (intent === 'CREATE_PROJECT') {
        entities.type = 'project';
      } else if (intent === 'CREATE_TASK') {
        entities.type = 'task';
      }
    }
  }

  // Extract status for update/query intents
  if (intent === 'UPDATE_TASK' || intent === 'QUERY_TASKS') {
    const status = extractStatus(text);
    if (status) {
      entities.status = status;
    }

    // Try to extract task title from update text
    if (intent === 'UPDATE_TASK') {
      // Extract the task name (fuzzy matching)
      const titleMatch = text.match(/["'「『]([^"'」』]+)["'」』]/);
      if (titleMatch) {
        entities.title = titleMatch[1];
      } else {
        // Try to extract after "把" or "将"
        const match = text.match(/[把将](.+?)[标记|设置|更新|改]/);
        if (match) {
          entities.title = match[1].trim();
        }
      }
    }
  }

  // Add context information
  if (context?.currentProject) {
    entities.relatedTo = context.currentProject;
  }

  return entities;
}

/**
 * Generate human-readable explanation of what was understood
 */
function generateUnderstanding(
  intent: IntentType,
  entities: ExtractedEntities,
  originalInput: string
): string {
  switch (intent) {
    case 'CREATE_GOAL':
      return `创建一个${entities.priority || 'P1'}优先级的目标："${entities.title}"`;

    case 'CREATE_PROJECT':
      return `创建一个项目："${entities.title}"${entities.priority ? `，优先级：${entities.priority}` : ''}`;

    case 'CREATE_TASK':
      return `创建一个任务："${entities.title}"${entities.priority ? `，优先级：${entities.priority}` : ''}`;

    case 'QUERY_TASKS':
      if (entities.status) {
        return `查询状态为"${entities.status}"的任务`;
      }
      return '查询所有待办任务';

    case 'UPDATE_TASK':
      return `将任务"${entities.title || '(需要指定任务名)'}"标记为"${entities.status || 'completed'}"`;

    case 'UNKNOWN':
    default:
      return `无法识别意图："${originalInput}"。请提供更明确的指令，例如"创建一个任务：实现登录功能"`;
  }
}
