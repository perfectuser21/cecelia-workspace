# n8n Workflows 总览

> 最后更新: 2025-12-26 | 总计: **17 个** workflows（全部活跃）

---

## 调度器与子 Workflow 关系图

```
夜间调度器 (nightly-scheduler)          数据采集调度器
YFqEplFiSl5Qd3x9                        4zvOIMtubKNF7QC6
每日 03:00 北京时间                      每日 05:00 北京时间
        │                                       │
        ├── 夜间健康检查                        ├── 抖音数据爬取
        │   wqeeHpnTcJolnse4                   │   wxYIxt8paRz82lbW
        │                                       │
        ├── 夜间备份                            ├── 快手数据爬取
        │   70DVZ55roILCGAMM                   │   8YC1JuIKo0aytgQz
        │                                       │
        ├── 夜间清理                            ├── 小红书数据爬取
        │   wOg5NRZ2yx0D18nY                   │   I5It7tSAT7HadXYJ
        │                                       │
        └── 夜间文档检查                         ├── 今日头条数据爬取
            5PLcvg8u7JmZRv8u                   │   SmJ3WIeVmR69l2dF
                                               │
                                               ├── 头条AI测试数据爬取
                                               │   BLVEVjzdtjAPEblg
                                               │
                                               ├── 微博数据爬取
                                               │   VMS9m7rubG5zvyla
                                               │
                                               ├── 视频号数据爬取
                                               │   MnrpR0zzCaQvJ9yJ
                                               │
                                               ├── 公众号数据爬取
                                               │   HegJi0788KPG1Bqh
                                               │
                                               └── 知乎数据爬取
                                                   RDlBd8MRjDSICfRf
```

---

## 分类清单

### 1. 主调度器 (2个)

| 名称 | ID | 触发时间 | 调用的子 Workflow |
|------|-----|---------|------------------|
| nightly-scheduler | `YFqEplFiSl5Qd3x9` | 每日 19:00 UTC (03:00 北京) | 健康检查 → 备份 → 清理 → 文档检查 |
| 数据采集调度器 | `4zvOIMtubKNF7QC6` | 每日 21:00 UTC (05:00 北京) | 9 个平台串行爬取 |

### 2. 夜间维护子 Workflow (4个)

| 名称 | ID | 功能 |
|------|-----|------|
| 夜间健康检查 | `wqeeHpnTcJolnse4` | 磁盘、容器、内存检查 |
| 夜间备份 | `70DVZ55roILCGAMM` | 配置、脚本备份，保留 7 天 |
| 夜间清理 | `wOg5NRZ2yx0D18nY` | /tmp、Docker 缓存清理 |
| 夜间文档检查 | `5PLcvg8u7JmZRv8u` | 文档完整性、一致性、更新追踪 |

### 3. 数据爬取子 Workflow (9个)

| 名称 | ID | CDP 端口 |
|------|-----|---------|
| 抖音数据爬取 | `wxYIxt8paRz82lbW` | 19222 |
| 快手数据爬取 | `8YC1JuIKo0aytgQz` | 19223 |
| 小红书数据爬取 | `I5It7tSAT7HadXYJ` | 19224 |
| 今日头条数据爬取 | `SmJ3WIeVmR69l2dF` | 19225 |
| 头条AI测试数据爬取 | `BLVEVjzdtjAPEblg` | 19226 |
| 微博数据爬取 | `VMS9m7rubG5zvyla` | 19227 |
| 视频号数据爬取 | `MnrpR0zzCaQvJ9yJ` | 19228 |
| 公众号数据爬取 | `HegJi0788KPG1Bqh` | 19229 |
| 知乎数据爬取 | `RDlBd8MRjDSICfRf` | 19230 |

### 4. 独立工具 Workflow (2个)

| 名称 | ID | 用途 |
|------|-----|------|
| Trigger Claude via HTTP | `Ar2BwcAElSsexIKC` | HTTP 触发 Claude (备用) |
| sync-workflow-changelog | `INcuVEV9PPJaQ7Yg` | 每日 02:00 同步变更到 CHANGELOG |

---

## 变更记录

### 2025-12-26

**新增**:
- `夜间文档检查` (`5PLcvg8u7JmZRv8u`): 检查文档完整性、代码一致性、更新追踪
- `nightly-scheduler` 新增文档检查步骤（节点从 18 → 20）
- `check-docs.sh`: 文档一致性检查脚本

**修复**:
- `nightly-scheduler`: 移除了不存在的 `log-triage` 引用（节点从 20 → 18）

**删除** (6个过期 VNC 登录 workflows):
- 抖音登录 (VNC) - `ktHwzUEyhzSQRcO4`
- 快手登录 (VNC) - `3ulpraIMG7D4o5zk`
- 小红书登录 (VNC) - `8ChgYWJK2hZHOfAS`
- 今日头条登录 (VNC) - `yRJbCbCvMxGSRrXO`
- 微博登录 (VNC) - `CGNLCeg6wSima2hF`
- 视频号登录 (VNC) - `UBRn8HMmbYpBOqAF`

> 原因: 登录态维护已迁移到 Windows ROG 架构，VNC 容器已废弃
