---
id: cp-cecelia-avatar-ui-prd
version: 1.0.0
created: 2026-02-24
updated: 2026-02-24
changelog:
  - 1.0.0: 初始版本
---

# PRD: CeceliaPage 形象重写

## 目标
重写 CeceliaPage.tsx，修复 API 路径错误，并增加 Cecelia AI 女性头像形象。

## 需求

### 问题1：API 路径错误
- 当前：`http://localhost:5221/api/brain/...`（绕过代理，跨域）
- 修复：改为 `/api/brain/...`（走 Express 5211 代理）

### 问题2：页面缺乏 Cecelia 形象
- 用户要求：有一个 AI 女性形象，哪怕是抽象的

## 新设计

### 布局：左右分栏
- 左栏（40%）：Cecelia SVG 头像形象区
  - SVG 绘制的抽象 AI 女性头像（圆脸、眼睛、嘴巴、轨道环绕）
  - 根据 urgency 变色：≥9 红色，5-8 橙/黄色，≤4 绿色
  - 名字 "C E C E L I A" 大字
  - 状态标签（MONITORING / ATTENTION REQUIRED / CRITICAL ALERT）
  - PENDING / TOTAL 统计数字
- 右栏（60%）：desires 意识流列表
  - 左侧竖线（warn=红/橙，inform=蓝）
  - urgency 数字 + type badge + 内容 + 时间戳
  - 30 秒自动刷新

## 技术要求
- 相对路径 `/api/brain/desires?status=all&limit=20`
- 纯 CSS + SVG，无图片文件
- Tailwind + inline style 混用
