---
id: cp-cecelia-avatar-ui-dod
version: 1.0.0
created: 2026-02-24
updated: 2026-02-24
changelog:
  - 1.0.0: 初始版本
---

# DoD: CeceliaPage 形象重写

## 验收清单

- [ ] API 路径改为相对路径 `/api/brain/desires?status=all&limit=20`
- [ ] 页面有 SVG 绘制的 AI 女性头像形象
- [ ] 头像根据 desires 最高 urgency 变色
- [ ] 左右分栏布局正常显示
- [ ] 右栏显示 desires 列表，按 urgency 降序
- [ ] 每条 desire 有左侧竖线、urgency 数字、type badge、内容、时间戳
- [ ] 右上角显示 PENDING/TOTAL 统计
- [ ] 30 秒自动刷新
- [ ] Build 成功（npm run build 无报错）
- [ ] 浏览器截图确认页面正常加载
