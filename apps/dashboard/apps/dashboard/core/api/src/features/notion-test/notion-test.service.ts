/**
 * Notion API 重试测试 - 业务逻辑
 */

import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../../shared/utils/logger';
import {
  NotionClientWithRetry,
  loadRetryConfig,
  ExecutionResult,
} from '../../shared/utils/notion-client';
import {
  TestScenario,
  TestScenarioType,
  ScenarioResult,
  TestReport,
  QualityReport,
  RunTestRequest,
  RunTestResponse,
} from './notion-test.types';

/**
 * 测试场景定义
 */
const TEST_SCENARIOS: TestScenario[] = [
  {
    type: TestScenarioType.RATE_LIMIT,
    name: '429 速率限制',
    description: '模拟 Notion API 返回 429 Too Many Requests',
    expectedRetries: 3,
    shouldSucceed: false,
    mockError: { status: 429, message: 'Rate limit exceeded' },
  },
  {
    type: TestScenarioType.SERVER_ERROR_500,
    name: '500 服务器错误',
    description: '模拟 Notion API 返回 500 Internal Server Error',
    expectedRetries: 3,
    shouldSucceed: false,
    mockError: { status: 500, message: 'Internal server error' },
  },
  {
    type: TestScenarioType.SERVER_ERROR_502,
    name: '502 网关错误',
    description: '模拟 Notion API 返回 502 Bad Gateway',
    expectedRetries: 3,
    shouldSucceed: false,
    mockError: { status: 502, message: 'Bad gateway' },
  },
  {
    type: TestScenarioType.SERVER_ERROR_503,
    name: '503 服务不可用',
    description: '模拟 Notion API 返回 503 Service Unavailable',
    expectedRetries: 3,
    shouldSucceed: false,
    mockError: { status: 503, message: 'Service unavailable' },
  },
  {
    type: TestScenarioType.SERVER_ERROR_504,
    name: '504 网关超时',
    description: '模拟 Notion API 返回 504 Gateway Timeout',
    expectedRetries: 3,
    shouldSucceed: false,
    mockError: { status: 504, message: 'Gateway timeout' },
  },
  {
    type: TestScenarioType.CLIENT_ERROR_400,
    name: '400 请求错误',
    description: '模拟 Notion API 返回 400 Bad Request（不应重试）',
    expectedRetries: 0,
    shouldSucceed: false,
    mockError: { status: 400, message: 'Bad request' },
  },
  {
    type: TestScenarioType.CLIENT_ERROR_401,
    name: '401 未授权',
    description: '模拟 Notion API 返回 401 Unauthorized（不应重试）',
    expectedRetries: 0,
    shouldSucceed: false,
    mockError: { status: 401, message: 'Unauthorized' },
  },
  {
    type: TestScenarioType.CLIENT_ERROR_403,
    name: '403 禁止访问',
    description: '模拟 Notion API 返回 403 Forbidden（不应重试）',
    expectedRetries: 0,
    shouldSucceed: false,
    mockError: { status: 403, message: 'Forbidden' },
  },
  {
    type: TestScenarioType.CLIENT_ERROR_404,
    name: '404 未找到',
    description: '模拟 Notion API 返回 404 Not Found（不应重试）',
    expectedRetries: 0,
    shouldSucceed: false,
    mockError: { status: 404, message: 'Not found' },
  },
  {
    type: TestScenarioType.NETWORK_TIMEOUT,
    name: '网络超时',
    description: '模拟网络超时错误',
    expectedRetries: 3,
    shouldSucceed: false,
    mockError: { code: 'ETIMEDOUT', message: 'Network timeout' },
  },
];

/**
 * Notion 测试服务
 */
export class NotionTestService {
  /**
   * 模拟错误执行
   */
  private async simulateError(mockError: any): Promise<never> {
    const error: any = new Error(mockError.message);
    if (mockError.status) error.status = mockError.status;
    if (mockError.code) error.code = mockError.code;
    throw error;
  }

  /**
   * 执行单个测试场景
   */
  private async runScenario(
    client: NotionClientWithRetry,
    scenario: TestScenario
  ): Promise<ScenarioResult> {
    logger.info('[NotionTest] Running scenario', { name: scenario.name });

    const startTime = Date.now();
    let result: ExecutionResult;

    try {
      // 模拟错误场景
      if (scenario.mockError) {
        result = await client.executeWithRetry(
          () => this.simulateError(scenario.mockError),
          `test_${scenario.type}`
        );
      } else {
        // 成功场景（可以使用真实 API 调用）
        result = await client.executeWithRetry(
          () => Promise.resolve({ success: true }),
          `test_${scenario.type}`
        );
      }
    } catch (error: any) {
      result = {
        success: false,
        error: error.message,
        retries: [],
        totalDuration: Date.now() - startTime,
        finalAttempt: 0,
      };
    }

    const totalDuration = Date.now() - startTime;
    const actualRetries = result.retries.length;

    // 验证测试结果
    let passed = true;
    let reason = '';

    // 检查重试次数
    if (actualRetries !== scenario.expectedRetries) {
      passed = false;
      reason = `Expected ${scenario.expectedRetries} retries, got ${actualRetries}`;
    }

    // 检查成功/失败状态
    if (result.success !== scenario.shouldSucceed) {
      passed = false;
      reason = `Expected ${scenario.shouldSucceed ? 'success' : 'failure'}, got ${result.success ? 'success' : 'failure'}`;
    }

    // 检查指数退避
    if (result.retries.length > 1) {
      for (let i = 1; i < result.retries.length; i++) {
        const prevDelay = result.retries[i - 1].delay;
        const currDelay = result.retries[i].delay;
        if (currDelay < prevDelay) {
          passed = false;
          reason = 'Exponential backoff not working correctly';
          break;
        }
      }
    }

    return {
      scenario,
      success: result.success,
      actualRetries,
      totalDuration,
      retryRecords: result.retries,
      error: result.error,
      passed,
      reason,
    };
  }

  /**
   * 生成测试报告
   */
  private generateTestReport(
    runId: string,
    results: ScenarioResult[],
    totalDuration: number
  ): TestReport {
    const passedScenarios = results.filter((r) => r.passed).length;
    const failedScenarios = results.length - passedScenarios;

    // 检查各项功能
    const retryLogicWorking = results
      .filter((r) => r.scenario.expectedRetries > 0)
      .every((r) => r.actualRetries > 0);

    const exponentialBackoffWorking = results
      .filter((r) => r.retryRecords.length > 1)
      .every((r) => {
        for (let i = 1; i < r.retryRecords.length; i++) {
          if (r.retryRecords[i].delay < r.retryRecords[i - 1].delay) {
            return false;
          }
        }
        return true;
      });

    const errorClassificationWorking = results
      .filter((r) => r.scenario.expectedRetries === 0)
      .every((r) => r.actualRetries === 0);

    const maxRetryLimitWorking = results
      .filter((r) => r.scenario.expectedRetries > 0)
      .every((r) => r.actualRetries <= 3);

    return {
      runId,
      timestamp: new Date().toISOString(),
      totalScenarios: results.length,
      passedScenarios,
      failedScenarios,
      totalDuration,
      results,
      summary: {
        retryLogicWorking,
        exponentialBackoffWorking,
        errorClassificationWorking,
        maxRetryLimitWorking,
      },
    };
  }

  /**
   * 生成质检报告
   */
  private generateQualityReport(testReport: TestReport): QualityReport {
    const checks = [
      {
        name: '重试逻辑',
        passed: testReport.summary.retryLogicWorking,
        details: testReport.summary.retryLogicWorking
          ? '所有可重试错误都触发了重试'
          : '部分可重试错误未触发重试',
      },
      {
        name: '指数退避',
        passed: testReport.summary.exponentialBackoffWorking,
        details: testReport.summary.exponentialBackoffWorking
          ? '重试延迟按指数增长'
          : '重试延迟未正确增长',
      },
      {
        name: '错误分类',
        passed: testReport.summary.errorClassificationWorking,
        details: testReport.summary.errorClassificationWorking
          ? '客户端错误（4xx）未触发重试'
          : '客户端错误错误触发了重试',
      },
      {
        name: '最大重试次数',
        passed: testReport.summary.maxRetryLimitWorking,
        details: testReport.summary.maxRetryLimitWorking
          ? '重试次数不超过 3 次'
          : '重试次数超过限制',
      },
      {
        name: '测试通过率',
        passed: testReport.passedScenarios === testReport.totalScenarios,
        details: `${testReport.passedScenarios}/${testReport.totalScenarios} 场景通过`,
      },
    ];

    const passedChecks = checks.filter((c) => c.passed).length;
    const score = Math.round((passedChecks / checks.length) * 100);
    const status = score >= 80 ? 'PASS' : 'FAIL';

    const recommendations: string[] = [];
    if (!testReport.summary.retryLogicWorking) {
      recommendations.push('检查重试触发条件，确保所有可重试错误都被正确识别');
    }
    if (!testReport.summary.exponentialBackoffWorking) {
      recommendations.push('检查延迟计算逻辑，确保指数退避正常工作');
    }
    if (!testReport.summary.errorClassificationWorking) {
      recommendations.push('检查错误分类逻辑，确保客户端错误不被重试');
    }
    if (!testReport.summary.maxRetryLimitWorking) {
      recommendations.push('检查最大重试次数配置');
    }

    return {
      runId: testReport.runId,
      timestamp: testReport.timestamp,
      status,
      score,
      checks,
      recommendations,
    };
  }

  /**
   * 保存报告到文件
   */
  private async saveReport(
    runId: string,
    testReport: TestReport,
    qualityReport: QualityReport
  ): Promise<void> {
    const runDir = `/home/xx/data/runs/${runId}`;
    const logsDir = path.join(runDir, 'logs');

    // 创建目录
    await fs.mkdir(logsDir, { recursive: true });

    // 保存测试报告
    const testReportPath = path.join(runDir, 'notion-retry-test-report.json');
    await fs.writeFile(testReportPath, JSON.stringify(testReport, null, 2));

    // 保存质检报告
    const qualityReportPath = path.join(runDir, 'quality_result.json');
    await fs.writeFile(qualityReportPath, JSON.stringify(qualityReport, null, 2));

    // 写入执行日志
    const executeLogPath = path.join(logsDir, 'execute.log');
    const logMessage = {
      timestamp: new Date().toISOString(),
      event: 'NOTION_RETRY_TEST_COMPLETED',
      runId,
      totalScenarios: testReport.totalScenarios,
      passedScenarios: testReport.passedScenarios,
      score: qualityReport.score,
      status: qualityReport.status,
    };
    await fs.appendFile(executeLogPath, JSON.stringify(logMessage) + '\n');

    logger.info('[NotionTest] Reports saved', {
      testReportPath,
      qualityReportPath,
      executeLogPath,
    });
  }

  /**
   * 运行完整测试
   */
  async runTest(request: RunTestRequest): Promise<RunTestResponse> {
    const runId = request.runId || uuidv4();
    const startTime = Date.now();

    try {
      logger.info('[NotionTest] Starting test', { runId });

      // 加载重试配置
      const retryConfig = await loadRetryConfig();
      logger.info('[NotionTest] Loaded retry config', retryConfig);

      // 创建 Notion 客户端
      const apiKey = request.notionApiKey || process.env.NOTION_API_KEY || 'mock-api-key';
      const client = new NotionClientWithRetry(apiKey, retryConfig, runId);

      // 确定要运行的场景
      const scenariosToRun = request.scenarios
        ? TEST_SCENARIOS.filter((s) => request.scenarios!.includes(s.type))
        : TEST_SCENARIOS;

      logger.info('[NotionTest] Running scenarios', {
        total: scenariosToRun.length,
      });

      // 执行所有测试场景
      const results: ScenarioResult[] = [];
      for (const scenario of scenariosToRun) {
        const result = await this.runScenario(client, scenario);
        results.push(result);
        logger.info('[NotionTest] Scenario completed', {
          name: scenario.name,
          passed: result.passed,
          retries: result.actualRetries,
        });
      }

      const totalDuration = Date.now() - startTime;

      // 生成报告
      const testReport = this.generateTestReport(runId, results, totalDuration);
      const qualityReport = this.generateQualityReport(testReport);

      // 保存报告
      await this.saveReport(runId, testReport, qualityReport);

      logger.info('[NotionTest] Test completed', {
        runId,
        totalDuration,
        passedScenarios: testReport.passedScenarios,
        totalScenarios: testReport.totalScenarios,
        score: qualityReport.score,
      });

      return {
        success: true,
        runId,
        message: `Test completed: ${testReport.passedScenarios}/${testReport.totalScenarios} scenarios passed`,
        reportPath: `/home/xx/data/runs/${runId}/notion-retry-test-report.json`,
      };
    } catch (error: any) {
      logger.error('[NotionTest] Test failed', {
        runId,
        error: error.message,
        stack: error.stack,
      });

      return {
        success: false,
        runId,
        message: `Test failed: ${error.message}`,
      };
    }
  }

  /**
   * 获取测试报告
   */
  async getReport(runId: string): Promise<TestReport | null> {
    try {
      const reportPath = `/home/xx/data/runs/${runId}/notion-retry-test-report.json`;
      const content = await fs.readFile(reportPath, 'utf-8');
      return JSON.parse(content);
    } catch (error) {
      logger.error('[NotionTest] Failed to load report', {
        runId,
        error: (error as Error).message,
      });
      return null;
    }
  }

  /**
   * 获取所有测试场景
   */
  getScenarios(): TestScenario[] {
    return TEST_SCENARIOS;
  }
}

export const notionTestService = new NotionTestService();
