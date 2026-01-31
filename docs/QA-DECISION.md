---
id: qa-decision-python-semantic-api-v1
version: 1.0.0
created: 2026-01-31
updated: 2026-01-31
changelog:
  - 1.0.0: 初始版本
---

# QA Decision

Decision: NO_RCI
Priority: P1
RepoType: Business

Tests:
  - dod_item: "POST /v1/semantic/embed 返回 embedding、model、dimensions"
    method: manual
    location: "manual:curl -X POST http://localhost:5220/v1/semantic/embed -d '{\"text\":\"test\"}' | jq '.embedding, .model, .dimensions'"
  - dod_item: "POST /v1/semantic/search 返回 results 列表和 query_time_ms"
    method: manual
    location: "manual:curl -X POST http://localhost:5220/v1/semantic/search -d '{\"query\":\"test\",\"top_k\":5}' | jq '.results, .query_time_ms'"
  - dod_item: "POST /v1/semantic/rerank 返回重排序后的 results"
    method: manual
    location: "manual:curl -X POST http://localhost:5220/v1/semantic/rerank -d '{\"query\":\"test\",\"results\":[]}' | jq '.results'"
  - dod_item: "GET /v1/semantic/health 返回 status、embedder 状态和 store 状态"
    method: manual
    location: "manual:curl http://localhost:5220/v1/semantic/health | jq '.status, .embedder, .store'"
  - dod_item: "错误处理：空输入返回 400，未初始化返回 503"
    method: manual
    location: "manual:curl -X POST http://localhost:5220/v1/semantic/embed -H 'Content-Type: application/json' -d '{}' -w '\\nHTTP %{http_code}' 验证返回 400; 服务未启动时验证返回 503"

RCI:
  new: []
  update: []

Reason: 跨仓库 API 端点，代码在 cecelia-semantic-brain 仓库，workspace 仅跟踪 PRD。无需回归契约。
