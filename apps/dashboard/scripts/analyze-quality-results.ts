#!/usr/bin/env ts-node
/**
 * Autopilot Core - 质检结果分析脚本
 * 用于深度分析测试结果，生成详细的质量报告
 */

import * as fs from 'fs';
import * as path from 'path';

interface TaskInfo {
  task_id: string;
  task_name: string;
  coding_type: string;
  status: string;
  content: string;
  fetched_at: string;
}

interface TestResult {
  success: boolean;
  error?: string;
}

interface QualityCheck {
  name: string;
  passed: boolean;
  message: string;
  score: number;
}

interface QualityReport {
  passed: boolean;
  total_checks: number;
  passed_checks: number;
  failed_checks: number;
  score: number;
  needs_manual: boolean;
  checks: QualityCheck[];
  checked_at: string;
}

interface TestRun {
  runId: string;
  taskName: string;
  testType: 'hard' | 'soft' | 'unknown';
  success: boolean;
  error?: string;
  qualityScore?: number;
  qualityReport?: QualityReport;
  timestamp: string;
}

const RUNS_DIR = '/home/xx/data/runs';

class QualityAnalyzer {
  private testRuns: TestRun[] = [];

  /**
   * 扫描所有测试运行目录
   */
  async scanTestRuns(): Promise<void> {
    console.log('扫描测试结果...');
    
    const dirs = fs.readdirSync(RUNS_DIR);
    
    for (const dir of dirs) {
      const runPath = path.join(RUNS_DIR, dir);
      const stat = fs.statSync(runPath);
      
      if (!stat.isDirectory()) continue;
      
      const taskInfoPath = path.join(runPath, 'task_info.json');
      const resultPath = path.join(runPath, 'result.json');
      const qualityReportPath = path.join(runPath, 'quality_report.json');
      
      if (!fs.existsSync(taskInfoPath)) continue;
      
      try {
        const taskInfo: TaskInfo = JSON.parse(fs.readFileSync(taskInfoPath, 'utf-8'));
        const result: TestResult = fs.existsSync(resultPath)
          ? JSON.parse(fs.readFileSync(resultPath, 'utf-8'))
          : { success: false, error: 'no_result' };
        
        let qualityReport: QualityReport | undefined;
        if (fs.existsSync(qualityReportPath)) {
          qualityReport = JSON.parse(fs.readFileSync(qualityReportPath, 'utf-8'));
        }
        
        // 判断测试类型
        let testType: 'hard' | 'soft' | 'unknown' = 'unknown';
        if (taskInfo.task_name.includes('硬检查')) {
          testType = 'hard';
        } else if (taskInfo.task_name.includes('软检查')) {
          testType = 'soft';
        }
        
        this.testRuns.push({
          runId: dir,
          taskName: taskInfo.task_name,
          testType,
          success: result.success,
          error: result.error,
          qualityScore: qualityReport?.score,
          qualityReport,
          timestamp: taskInfo.fetched_at,
        });
      } catch (error) {
        console.error(`  解析失败: ${dir}`, error);
      }
    }
    
    console.log(`  发现 ${this.testRuns.length} 个测试运行\n`);
  }

  /**
   * 生成统计报告
   */
  generateStatistics() {
    const hardChecks = this.testRuns.filter(r => r.testType === 'hard');
    const softChecks = this.testRuns.filter(r => r.testType === 'soft');
    
    console.log('=== 硬检查统计 ===');
    this.printTestTypeStats(hardChecks);
    
    console.log('\n=== 软检查统计 ===');
    this.printTestTypeStats(softChecks);
    
    // 失败原因分析
    console.log('\n=== 失败原因分析 ===');
    this.analyzeFailures();
    
    // 质量评分分布
    console.log('\n=== 质量评分分布 ===');
    this.analyzeQualityScores();
  }

  /**
   * 打印特定类型测试的统计信息
   */
  private printTestTypeStats(tests: TestRun[]): void {
    const total = tests.length;
    const success = tests.filter(t => t.success).length;
    const failed = total - success;
    const passRate = total > 0 ? ((success / total) * 100).toFixed(1) : '0.0';
    
    console.log(`总数: ${total}`);
    console.log(`成功: ${success}`);
    console.log(`失败: ${failed}`);
    console.log(`通过率: ${passRate}%`);
    
    if (tests.some(t => t.qualityScore !== undefined)) {
      const scores = tests
        .map(t => t.qualityScore)
        .filter((s): s is number => s !== undefined);
      
      if (scores.length > 0) {
        const avgScore = (scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1);
        const minScore = Math.min(...scores);
        const maxScore = Math.max(...scores);
        
        console.log(`平均质量评分: ${avgScore}/100`);
        console.log(`评分范围: ${minScore} - ${maxScore}`);
      }
    }
  }

  /**
   * 分析失败原因
   */
  private analyzeFailures(): void {
    const failures = this.testRuns.filter(t => !t.success);
    
    if (failures.length === 0) {
      console.log('没有失败的测试 ✅');
      return;
    }
    
    // 按错误类型分组
    const errorGroups = new Map<string, TestRun[]>();
    
    for (const failure of failures) {
      const errorType = failure.error || 'unknown';
      if (!errorGroups.has(errorType)) {
        errorGroups.set(errorType, []);
      }
      errorGroups.get(errorType)!.push(failure);
    }
    
    console.log(`总失败数: ${failures.length}\n`);
    
    // 按失败次数排序
    const sorted = Array.from(errorGroups.entries())
      .sort((a, b) => b[1].length - a[1].length);
    
    for (const [errorType, runs] of sorted) {
      console.log(`${errorType}: ${runs.length} 次`);
      // 显示最近的 3 个失败案例
      const recent = runs.slice(0, 3);
      for (const run of recent) {
        console.log(`  - ${run.runId}: ${run.taskName}`);
      }
    }
  }

  /**
   * 分析质量评分分布
   */
  private analyzeQualityScores(): void {
    const withScores = this.testRuns.filter(t => t.qualityScore !== undefined);
    
    if (withScores.length === 0) {
      console.log('没有质量评分数据');
      return;
    }
    
    // 按评分段分组
    const ranges = [
      { min: 90, max: 100, label: '优秀 (90-100)', count: 0 },
      { min: 80, max: 89, label: '良好 (80-89)', count: 0 },
      { min: 70, max: 79, label: '中等 (70-79)', count: 0 },
      { min: 60, max: 69, label: '及格 (60-69)', count: 0 },
      { min: 0, max: 59, label: '不及格 (<60)', count: 0 },
    ];
    
    for (const test of withScores) {
      const score = test.qualityScore!;
      for (const range of ranges) {
        if (score >= range.min && score <= range.max) {
          range.count++;
          break;
        }
      }
    }
    
    for (const range of ranges) {
      const percentage = ((range.count / withScores.length) * 100).toFixed(1);
      const bar = '█'.repeat(Math.floor(range.count / 2));
      console.log(`${range.label}: ${range.count} (${percentage}%) ${bar}`);
    }
  }

  /**
   * 导出详细报告到 JSON
   */
  exportDetailedReport(outputPath: string): void {
    const report = {
      generated_at: new Date().toISOString(),
      total_runs: this.testRuns.length,
      hard_checks: this.testRuns.filter(r => r.testType === 'hard').length,
      soft_checks: this.testRuns.filter(r => r.testType === 'soft').length,
      success_rate: this.calculateSuccessRate(),
      average_quality_score: this.calculateAverageQualityScore(),
      test_runs: this.testRuns,
    };
    
    fs.writeFileSync(outputPath, JSON.stringify(report, null, 2));
    console.log(`\n详细报告已导出: ${outputPath}`);
  }

  private calculateSuccessRate(): number {
    if (this.testRuns.length === 0) return 0;
    const success = this.testRuns.filter(r => r.success).length;
    return parseFloat(((success / this.testRuns.length) * 100).toFixed(1));
  }

  private calculateAverageQualityScore(): number {
    const withScores = this.testRuns.filter(t => t.qualityScore !== undefined);
    if (withScores.length === 0) return 0;
    const total = withScores.reduce((sum, t) => sum + t.qualityScore!, 0);
    return parseFloat((total / withScores.length).toFixed(1));
  }
}

// 主函数
async function main() {
  console.log('Autopilot Core - 质检结果分析\n');
  
  const analyzer = new QualityAnalyzer();
  await analyzer.scanTestRuns();
  analyzer.generateStatistics();
  
  // 导出详细报告
  const reportPath = path.join('/home/xx/dev/zenithjoy-autopilot', 'quality-analysis-report.json');
  analyzer.exportDetailedReport(reportPath);
}

if (require.main === module) {
  main().catch(console.error);
}

export { QualityAnalyzer };
