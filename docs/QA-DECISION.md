# QA Decision

Decision: NO_RCI
Priority: P1
RepoType: Business

Tests:
  - dod_item: "action 不再显示 unknown"
    method: manual
    location: manual:api-test - curl /api/brain/status 验证 recent_decisions.action

  - dod_item: "包含元数据字段"
    method: manual
    location: manual:new-fields - 验证 pack_version/generated_at/ttl_seconds

  - dod_item: "支持 mode 参数"
    method: manual
    location: manual:mode-param - curl /api/brain/status?mode=scheduled

RCI:
  new: []
  update: []

Reason: Brain API 的 decision pack 增强是内部接口优化，不涉及外部契约变更。变更范围限于 routes.js 的 GET /status 端点，增加元数据和修复 action 名称显示，属于 API 响应格式增强，无需纳入回归契约。
