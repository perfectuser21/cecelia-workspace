/**
 * NLP Parser Utility
 * Lightweight rule-based natural language parsing for intent recognition
 */

import type { Priority, TaskStatus } from './types.js';

/**
 * Extract priority from text (P0, P1, P2)
 */
export function extractPriority(text: string): Priority | undefined {
  const normalized = text.toLowerCase();

  // Handle P0, P0., p0, etc.
  if (/\bp0\b|p0\.|最高|紧急|critical|urgent/.test(normalized)) {
    return 'P0';
  }
  if (/\bp1\b|p1\.|重要|high/.test(normalized)) {
    return 'P1';
  }
  if (/\bp2\b|p2\.|普通|normal|low/.test(normalized)) {
    return 'P2';
  }

  return undefined;
}

/**
 * Extract status keywords from text
 */
export function extractStatus(text: string): TaskStatus | undefined {
  const normalized = text.toLowerCase();

  if (/完成|完成了|done|完|completed|finish/.test(normalized)) {
    return 'completed';
  }
  if (/进行中|正在做|in progress|doing/.test(normalized)) {
    return 'in_progress';
  }
  if (/失败|failed|错误|error/.test(normalized)) {
    return 'failed';
  }
  if (/待办|pending|todo|未开始/.test(normalized)) {
    return 'pending';
  }

  return undefined;
}

/**
 * Detect if text mentions creating a goal
 */
export function isGoalCreation(text: string): boolean {
  const normalized = text.toLowerCase();
  return /目标|goal|objective|okr/.test(normalized) &&
         /(创建|新建|添加|建立|create|add|new|make)/.test(normalized);
}

/**
 * Detect if text mentions creating a project
 */
export function isProjectCreation(text: string): boolean {
  const normalized = text.toLowerCase();
  return /项目|project/.test(normalized) &&
         /(创建|新建|添加|建立|create|add|new|make)/.test(normalized);
}

/**
 * Detect if text mentions creating a task
 */
export function isTaskCreation(text: string): boolean {
  const normalized = text.toLowerCase();

  // If "goal" or "project" is mentioned explicitly, it's NOT a task (防止误判)
  if (/(目标|goal|objective|项目|project)/.test(normalized)) {
    return false;
  }

  // Explicit task keywords
  const hasTaskKeyword = /(任务|task|todo|待办)/.test(normalized);

  // Creation action words
  const hasCreateAction = /(创建|新建|添加|建立|实现|做|搞|create|add|new|make|implement)/.test(normalized);

  return (hasTaskKeyword && hasCreateAction) || hasCreateAction;
}

/**
 * Detect if text is querying tasks
 */
export function isTaskQuery(text: string): boolean {
  const normalized = text.toLowerCase();

  const hasQueryWord = /(哪些|什么|有|查|看|list|show|get|查看)/.test(normalized);
  const hasTaskWord = /(任务|task|todo|待办)/.test(normalized);

  return hasQueryWord && hasTaskWord;
}

/**
 * Detect if text is updating a task
 */
export function isTaskUpdate(text: string): boolean {
  const normalized = text.toLowerCase();

  const hasUpdateWord = /(更新|修改|改|标记|设置|update|modify|mark|set|change)/.test(normalized);
  const hasTaskWord = /(任务|task|todo|待办)/.test(normalized);
  const hasStatus = extractStatus(text) !== undefined;

  return (hasUpdateWord && hasTaskWord) || (hasUpdateWord && hasStatus);
}

/**
 * Extract title from text
 * Removes action words and extracts the core content
 */
export function extractTitle(text: string): string {
  // Remove common action prefixes
  let title = text
    .replace(/^(请|帮我|我想|我要|能否|可以|麻烦|help me|i want|i need|please|can you)/i, '')
    .replace(/(创建|新建|添加|建立|实现|做|搞|create|add|new|make|implement)\s*(一个|个|an?)\s*/i, '')
    .replace(/(任务|task|todo|待办|目标|goal|项目|project)[：:]\s*/i, '')
    .trim();

  // Remove quotes
  title = title.replace(/^["'「『]|["'」』]$/g, '');

  // Remove "作为 P0" suffix
  title = title.replace(/\s*作为\s*p[012]\s*$/i, '');

  return title.trim();
}

/**
 * Calculate confidence score based on keyword matches
 */
export function calculateConfidence(text: string, detectedIntent: string): number {
  const normalized = text.toLowerCase();

  // High confidence if explicit keywords are present
  if (detectedIntent === 'CREATE_GOAL' && /创建.*目标|新建.*goal/.test(normalized)) {
    return 1.0;
  }
  if (detectedIntent === 'CREATE_PROJECT' && /创建.*项目|新建.*project/.test(normalized)) {
    return 1.0;
  }
  if (detectedIntent === 'CREATE_TASK' && /创建.*任务|新建.*task/.test(normalized)) {
    return 1.0;
  }
  if (detectedIntent === 'QUERY_TASKS' && /查看.*任务|list tasks/.test(normalized)) {
    return 1.0;
  }
  if (detectedIntent === 'UPDATE_TASK' && /标记.*完成|mark.*done/.test(normalized)) {
    return 1.0;
  }

  // Medium confidence if keywords are present but less explicit
  if (/(创建|新建|添加|实现)/.test(normalized)) {
    return 0.7;
  }

  // Low confidence for vague input
  return 0.5;
}

/**
 * Determine if the input is ambiguous and needs user confirmation
 */
export function needsConfirmation(confidence: number, text: string): boolean {
  // Always confirm if confidence is low
  if (confidence < 0.7) {
    return true;
  }

  // Confirm if input is very short (might be unclear)
  if (text.trim().length < 5) {
    return true;
  }

  // Confirm if no clear action word
  const normalized = text.toLowerCase();
  const hasExplicitAction = /(创建|新建|添加|查看|更新|标记|create|add|update|mark|show|list)/.test(normalized);
  if (!hasExplicitAction) {
    return true;
  }

  return false;
}
