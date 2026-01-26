/**
 * Mind Service - OpenAI integration for intent recognition
 *
 * Processes natural language input and identifies user intent
 */

import OpenAI from 'openai';

export type Intent =
  | 'create_task'
  | 'check_status'
  | 'get_task_detail'
  | 'system_check'
  | 'general_chat';

export interface IntentResult {
  intent: Intent;
  confidence: number;
  entities: Record<string, unknown>;
  response: string;
}

const SYSTEM_PROMPT = `You are Cecelia, an AI assistant for managing development tasks.

Analyze the user's message and respond with JSON in this exact format:
{
  "intent": "create_task|check_status|get_task_detail|system_check|general_chat",
  "confidence": 0.0-1.0,
  "entities": {},
  "response": "Friendly response to the user"
}

Intent classification rules:
- "create_task": User wants to create a new development task (e.g., "帮我实现登录功能", "add a new feature")
- "check_status": User wants to know current running tasks (e.g., "现在有什么任务在跑", "what's running")
- "get_task_detail": User asks about a specific task (e.g., "Task 123 怎么样了", "how's task XXX")
- "system_check": User wants system health info (e.g., "system check", "health check")
- "general_chat": General conversation, greetings, or unclear intent

For "create_task", extract:
- feature_description: What to implement
- project_name: Which project (if mentioned)

For "get_task_detail", extract:
- task_id: The task identifier

Examples:
Input: "帮我实现用户登录功能"
Output: {"intent":"create_task","confidence":0.95,"entities":{"feature_description":"用户登录功能"},"response":"好的！我来帮你实现用户登录功能。"}

Input: "system check"
Output: {"intent":"system_check","confidence":1.0,"entities":{},"response":"系统运行正常 ✅"}

Input: "你好"
Output: {"intent":"general_chat","confidence":0.9,"entities":{},"response":"你好！我是 Cecelia，有什么可以帮你的吗？"}`;

class MindService {
  private openai: OpenAI | null = null;
  private apiKey: string | undefined;
  private model: string;

  constructor() {
    this.apiKey = process.env.OPENAI_API_KEY;
    this.model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

    if (this.apiKey) {
      this.openai = new OpenAI({
        apiKey: this.apiKey,
      });
    } else {
      console.warn('MindService: OPENAI_API_KEY not found in environment');
    }
  }

  /**
   * Check if OpenAI is available
   */
  isAvailable(): boolean {
    return this.openai !== null;
  }

  /**
   * Process user message and identify intent
   */
  async processMessage(message: string): Promise<IntentResult> {
    if (!this.openai) {
      return this.fallbackResponse(message);
    }

    try {
      const completion = await this.openai.chat.completions.create({
        model: this.model,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: message },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: 'json_object' },
      });

      const content = completion.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from OpenAI');
      }

      const result = JSON.parse(content) as IntentResult;

      // Validate result
      if (!result.intent || !result.response) {
        throw new Error('Invalid response format from OpenAI');
      }

      return result;
    } catch (error) {
      console.error('MindService: Error processing message:', error);
      return this.fallbackResponse(message);
    }
  }

  /**
   * Fallback response when OpenAI is unavailable or fails
   */
  private fallbackResponse(message: string): IntentResult {
    const lowerMessage = message.toLowerCase();

    // Simple keyword-based intent detection
    if (
      lowerMessage.includes('实现') ||
      lowerMessage.includes('添加') ||
      lowerMessage.includes('帮我') ||
      lowerMessage.includes('create') ||
      lowerMessage.includes('add')
    ) {
      return {
        intent: 'create_task',
        confidence: 0.6,
        entities: { feature_description: message },
        response: '收到！我会帮你处理这个任务。',
      };
    }

    if (
      lowerMessage.includes('status') ||
      lowerMessage.includes('running') ||
      lowerMessage.includes('任务')
    ) {
      return {
        intent: 'check_status',
        confidence: 0.6,
        entities: {},
        response: '正在检查运行中的任务...',
      };
    }

    if (lowerMessage.includes('system') || lowerMessage.includes('health')) {
      return {
        intent: 'system_check',
        confidence: 0.8,
        entities: {},
        response: '系统运行正常 ✅',
      };
    }

    // Default: general chat
    return {
      intent: 'general_chat',
      confidence: 0.5,
      entities: {},
      response: '我是 Cecelia，有什么可以帮你的吗？',
    };
  }
}

// Singleton instance
export const mindService = new MindService();
