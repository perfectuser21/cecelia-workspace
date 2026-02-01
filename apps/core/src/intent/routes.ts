/**
 * Intent Recognition Routes
 * API routes for natural language intent recognition
 */

import { Router } from 'express';
import { recognize } from './controller.js';

const router = Router();

/**
 * POST /api/intent/recognize
 * Recognize user intent from natural language input
 *
 * Request body:
 * {
 *   "input": "创建一个任务：实现用户登录",
 *   "context": {
 *     "currentProject": "project-id" (optional)
 *   }
 * }
 *
 * Response:
 * {
 *   "success": true,
 *   "data": {
 *     "intent": "CREATE_TASK",
 *     "entities": {
 *       "title": "实现用户登录",
 *       "priority": "P1",
 *       "type": "task"
 *     },
 *     "confidence": 1.0,
 *     "needsConfirmation": false,
 *     "understanding": "创建一个任务：\"实现用户登录\"，优先级：P1"
 *   },
 *   "meta": {
 *     "responseTime": 25
 *   }
 * }
 */
router.post('/recognize', recognize);

export default router;
