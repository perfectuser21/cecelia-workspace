/**
 * Notion API 重试测试 - 类型定义
 */

import { RetryRecord } from '../../shared/utils/notion-client';

// 测试场景类型
export enum TestScenarioType {
  RATE_LIMIT = 'RATE_LIMIT',              // 429 速率限制
  SERVER_ERROR_500 = 'SERVER_ERROR_500',  // 500 服务器错误
  SERVER_ERROR_502 = 'SERVER_ERROR_502',  // 502 网关错误
  SERVER_ERROR_503 = 'SERVER_ERROR_503',  // 503 服务不可用
  SERVER_ERROR_504 = 'SERVER_ERROR_504',  // 504 网关超时
  CLIENT_ERROR_400 = 'CLIENT_ERROR_400',  // 400 请求错误
  CLIENT_ERROR_401 = 'CLIENT_ERROR_401',  // 401 未授权
  CLIENT_ERROR_403 = 'CLIENT_ERROR_403',  // 403 禁止访问
  CLIENT_ERROR_404 = 'CLIENT_ERROR_404',  // 404 未找到
  NETWORK_TIMEOUT = 'NETWORK_TIMEOUT',    // 网络超时
  SUCCESS = 'SUCCESS',                    // 正常成功
}

// 测试场景定义
export interface TestScenario {
  type: TestScenarioType;
  name: string;
  description: string;
  expectedRetries: number;
  shouldSucceed: boolean;
  mockError?: {
    status?: number;
    code?: string;
    message: string;
  };
}

// 测试场景结果
export interface ScenarioResult {
  scenario: TestScenario;
  success: boolean;
  actualRetries: number;
  totalDuration: number;
  retryRecords: RetryRecord[];
  error?: string;
  passed: boolean;
  reason?: string;
}

// 测试报告
export interface TestReport {
  runId: string;
  timestamp: string;
  totalScenarios: number;
  passedScenarios: number;
  failedScenarios: number;
  totalDuration: number;
  results: ScenarioResult[];
  summary: {
    retryLogicWorking: boolean;
    exponentialBackoffWorking: boolean;
    errorClassificationWorking: boolean;
    maxRetryLimitWorking: boolean;
  };
}

// 质检报告
export interface QualityReport {
  runId: string;
  timestamp: string;
  status: 'PASS' | 'FAIL';
  score: number; // 0-100
  checks: {
    name: string;
    passed: boolean;
    details: string;
  }[];
  recommendations: string[];
}

// 运行测试请求
export interface RunTestRequest {
  runId?: string;
  scenarios?: TestScenarioType[];
  notionApiKey?: string;
}

// 运行测试响应
export interface RunTestResponse {
  success: boolean;
  runId: string;
  message: string;
  reportPath?: string;
}
