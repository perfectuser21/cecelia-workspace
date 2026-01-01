/**
 * Webhook 验证路由
 */

import { Router, Request, Response } from 'express';
import { WebhookValidatorService } from './webhook-validator.service';
import logger from '../../shared/utils/logger';
import fs from 'fs/promises';
import path from 'path';

const router = Router();
const webhookValidator = new WebhookValidatorService();

/**
 * GET /api/webhook-validator/status
 * 获取 Webhook 状态报告
 */
router.get('/status', async (req: Request, res: Response) => {
  try {
    const report = await webhookValidator.generateStatusReport();
    res.json({
      success: true,
      data: report,
    });
  } catch (error: any) {
    logger.error('[WebhookValidator] Failed to generate status report', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhook-validator/test
 * 手动测试 Webhook
 */
router.post('/test', async (req: Request, res: Response) => {
  try {
    const { url, payload, timeout } = req.body;
    const result = await webhookValidator.testWebhook({
      url: url || 'http://localhost:5679/webhook/execution-callback',
      payload,
      timeout,
    });

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[WebhookValidator] Test failed', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhook-validator/test-execution
 * 发送测试执行回调
 */
router.post('/test-execution', async (req: Request, res: Response) => {
  try {
    const { taskId, runId } = req.body;

    if (!taskId || !runId) {
      return res.status(400).json({
        success: false,
        error: 'taskId and runId are required',
      });
    }

    const result = await webhookValidator.sendTestExecutionCallback(
      taskId,
      runId
    );

    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[WebhookValidator] Test execution failed', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhook-validator/test-retry
 * 测试重试机制
 */
router.post('/test-retry', async (req: Request, res: Response) => {
  try {
    const result = await webhookValidator.testRetryMechanism();
    res.json({
      success: true,
      data: result,
    });
  } catch (error: any) {
    logger.error('[WebhookValidator] Retry test failed', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/webhook-validator/generate-report
 * 生成并保存完整测试报告
 */
router.post('/generate-report', async (req: Request, res: Response) => {
  try {
    const { runId } = req.body;

    if (!runId) {
      return res.status(400).json({
        success: false,
        error: 'runId is required',
      });
    }

    const runDir = `/home/xx/data/runs/${runId}`;

    // 检查运行目录是否存在
    try {
      await fs.access(runDir);
    } catch {
      return res.status(404).json({
        success: false,
        error: `Run directory not found: ${runDir}`,
      });
    }

    // 生成状态报告
    const statusReport = await webhookValidator.generateStatusReport();

    // 保存 webhook-status.json
    const statusFile = path.join(runDir, 'webhook-status.json');
    await fs.writeFile(statusFile, JSON.stringify(statusReport, null, 2));

    // 生成 Markdown 报告
    const markdownReport = generateMarkdownReport(statusReport);
    const reportFile = path.join(runDir, 'logs', 'webhook-test-report.md');

    // 确保 logs 目录存在
    await fs.mkdir(path.join(runDir, 'logs'), { recursive: true });
    await fs.writeFile(reportFile, markdownReport);

    logger.info('[WebhookValidator] Report generated', {
      runId,
      statusFile,
      reportFile,
    });

    res.json({
      success: true,
      data: {
        report: statusReport,
        files: {
          statusFile,
          reportFile,
        },
      },
    });
  } catch (error: any) {
    logger.error('[WebhookValidator] Failed to generate report', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(report: any): string {
  const status = report.accessible ? '✅ PASS' : '❌ FAIL';

  return `# Webhook 回调验证报告 ${status}

生成时间: ${report.generatedAt}

## 1. Webhook 配置

- **URL**: ${report.webhookUrl}
- **可访问性**: ${report.accessible ? '✅ 可访问' : '❌ 不可访问'}

## 2. n8n 容器状态

- **运行状态**: ${report.n8nContainerStatus.running ? '✅ 运行中' : '❌ 未运行'}
- **端口映射**: ${report.n8nContainerStatus.ports || 'N/A'}
${report.n8nContainerStatus.error ? `- **错误**: ${report.n8nContainerStatus.error}` : ''}

## 3. 端口可达性

- **端口**: ${report.portCheck.port}
- **可达性**: ${report.portCheck.reachable ? '✅ 可达' : '❌ 不可达'}
${report.portCheck.error ? `- **错误**: ${report.portCheck.error}` : ''}

## 4. Webhook 测试结果

- **状态**: ${report.webhookTest.success ? '✅ 成功' : '❌ 失败'}
- **HTTP 状态码**: ${report.webhookTest.statusCode || 'N/A'}
- **响应时间**: ${report.webhookTest.responseTime}ms
${report.webhookTest.error ? `- **错误**: ${report.webhookTest.error}` : ''}

${report.webhookTest.response ? `### 响应数据
\`\`\`json
${JSON.stringify(report.webhookTest.response, null, 2)}
\`\`\`
` : ''}

## 5. 重试机制

- **最大重试次数**: ${report.retryMechanism.maxRetries}
- **重试延迟**: ${report.retryMechanism.retryDelay}秒
- **配置状态**: ${report.retryMechanism.configured ? '✅ 已配置' : '❌ 未配置'}

## 6. 验收标准

| 项目 | 状态 | 说明 |
|------|------|------|
| Webhook URL 正确配置 | ${report.webhookUrl ? '✅' : '❌'} | ${report.webhookUrl} |
| n8n 容器运行正常 | ${report.n8nContainerStatus.running ? '✅' : '❌'} | ${report.n8nContainerStatus.running ? '容器运行中' : '容器未运行'} |
| 端口 5679 可访问 | ${report.portCheck.reachable ? '✅' : '❌'} | ${report.portCheck.reachable ? '端口可达' : '端口不可达'} |
| Webhook 响应正常 | ${report.webhookTest.success ? '✅' : '❌'} | ${report.webhookTest.success ? `响应时间: ${report.webhookTest.responseTime}ms` : report.webhookTest.error} |
| 重试机制已配置 | ${report.retryMechanism.configured ? '✅' : '❌'} | 最大重试: ${report.retryMechanism.maxRetries}次 |

## 7. 问题诊断

${!report.accessible ? `### ⚠️ Webhook 不可访问

可能原因：
1. n8n 中未配置 \`execution-callback\` Webhook
2. Webhook 路径错误
3. n8n 服务未启动或配置错误

**建议操作：**
1. 登录 n8n (http://localhost:5679)
2. 创建或检查 Webhook 节点
3. 确认 Webhook 路径为: \`/webhook/execution-callback\`
4. 确认 Webhook 方法为: POST
5. 测试 Webhook 端点
` : '✅ 所有检查通过'}

---

Generated by Webhook Validator @ ${report.generatedAt}
`;
}

export default router;
