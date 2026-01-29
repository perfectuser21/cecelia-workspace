# QA Decision

## Feature: Cecelia 前端连接 Orchestrator

## Decision: Manual Testing Only

### Rationale
- 这是前端 UI + WebSocket 集成
- 涉及浏览器 API（MediaRecorder, AudioContext）
- 需要真实 OpenAI Realtime API 连接
- 自动化测试成本高，收益低

### Test Strategy
1. **构建验证**: `npm run build` 通过
2. **手动测试**:
   - 访问 /orchestrator 页面
   - 点击麦克风按钮
   - 验证 WebSocket 连接
   - 语音对话测试
   - 触发 run_orchestrator tool

### Acceptance Criteria
- [ ] TypeScript 编译通过
- [ ] 页面正常加载
- [ ] WebSocket 连接成功
- [ ] 语音输入/输出正常
- [ ] Tool 调用正常
