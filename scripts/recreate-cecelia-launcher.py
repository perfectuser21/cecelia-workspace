#!/usr/bin/env python3
"""
Cecelia Launcher Workflow 重建脚本
用于在 workflow 损坏时快速恢复
"""

import sqlite3
import json
import uuid
from datetime import datetime

def recreate_workflow():
    conn = sqlite3.connect('/data/database.sqlite')
    cursor = conn.cursor()

    NAME = "cecelia-launcher-v2"
    WEBHOOK_PATH = "cecelia-start"

    print("=== 清理旧数据 ===")
    cursor.execute("DELETE FROM workflow_entity WHERE name LIKE 'cecelia-launcher%'")
    print(f"✓ workflow_entity: {cursor.rowcount} 行")

    cursor.execute("DELETE FROM webhook_entity WHERE webhookPath LIKE '%cecelia%start%'")
    print(f"✓ webhook_entity: {cursor.rowcount} 行")

    cursor.execute("DELETE FROM shared_workflow WHERE workflowId NOT IN (SELECT id FROM workflow_entity)")
    print(f"✓ shared_workflow: {cursor.rowcount} 行")

    conn.commit()

    print("\n=== 创建新 Workflow ===")

    workflow_id = str(uuid.uuid4()).replace('-', '')[:20]
    version_id = str(uuid.uuid4())
    webhook_id = f"{WEBHOOK_PATH}-{workflow_id[:8]}"

    nodes = [
        {
            "parameters": {
                "httpMethod": "POST",
                "path": WEBHOOK_PATH,
                "responseMode": "lastNode",
                "options": {}
            },
            "id": "webhook-start",
            "name": "Webhook Start",
            "type": "n8n-nodes-base.webhook",
            "typeVersion": 2,
            "position": [240, 300],
            "webhookId": webhook_id
        },
        {
            "parameters": {
                "jsCode": """const body = $json.body || $json;
const project = body.project || 'cecelia-task';
const prd = body.prd || '';
const extra_context = body.extra_context || {};
const checkpoint_id = body.checkpoint_id || 'CP-001';

const d = new Date();
const y = d.getFullYear();
const m = String(d.getMonth()+1).padStart(2,'0');
const day = String(d.getDate()).padStart(2,'0');
const task_id = `${project}-${y}${m}${day}-${Math.random().toString(16).slice(2,6)}`;

const prompt = [
  '/dev',
  '',
  `TASK_ID: ${task_id}`,
  `CHECKPOINT: ${checkpoint_id}`,
  '',
  '=== PRD ===',
  prd,
  '',
  '=== EXTRA_CONTEXT ===',
  JSON.stringify(extra_context, null, 2),
  '',
  '=== INSTRUCTION ===',
  checkpoint_id === 'CP-001' 
    ? 'Execute p0 phase: PRD → DoD → Code → Test → Quality → PR'
    : 'Continue development'
].join('\\n');

return {
  task_id,
  checkpoint_id,
  prompt
};"""
            },
            "id": "build-prompt",
            "name": "Build Prompt",
            "type": "n8n-nodes-base.code",
            "typeVersion": 2,
            "position": [460, 300]
        },
        {
            "parameters": {
                "url": "http://172.17.0.1:3457/trigger-cecelia",
                "method": "POST",
                "sendBody": True,
                "bodyParameters": {
                    "parameters": [
                        {"name": "task_id", "value": "={{ $json.task_id }}"},
                        {"name": "checkpoint_id", "value": "={{ $json.checkpoint_id }}"},
                        {"name": "prompt", "value": "={{ $json.prompt }}"}
                    ]
                },
                "options": {}
            },
            "id": "call-bridge",
            "name": "Call Bridge",
            "type": "n8n-nodes-base.httpRequest",
            "typeVersion": 4.2,
            "position": [680, 300]
        }
    ]

    connections = {
        "Webhook Start": {
            "main": [[{"node": "Build Prompt", "type": "main", "index": 0}]]
        },
        "Build Prompt": {
            "main": [[{"node": "Call Bridge", "type": "main", "index": 0}]]
        }
    }

    settings = {
        "executionOrder": "v1",
        "callerPolicy": "workflowsFromSameOwner"
    }

    now = datetime.utcnow().strftime('%Y-%m-%d %H:%M:%S.%f')[:-3]

    cursor.execute("SELECT id FROM user LIMIT 1")
    user_id = cursor.fetchone()[0]

    cursor.execute("SELECT id FROM project WHERE type = 'personal' LIMIT 1")
    project_id = cursor.fetchone()[0]

    cursor.execute("""
        INSERT INTO workflow_entity (
            id, name, active, nodes, connections, settings,
            createdAt, updatedAt, versionId, activeVersionId, versionCounter,
            staticData, triggerCount
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        workflow_id, NAME, 1,
        json.dumps(nodes), json.dumps(connections), json.dumps(settings),
        now, now, version_id, version_id, 1, None, 1
    ))

    cursor.execute("""
        INSERT INTO webhook_entity (workflowId, webhookPath, method, node, webhookId, pathLength)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (
        workflow_id, WEBHOOK_PATH, "POST", "Webhook Start",
        webhook_id, len(WEBHOOK_PATH)
    ))

    cursor.execute("""
        INSERT INTO workflow_history (
            versionId, workflowId, authors, nodes, connections, name, autosaved, createdAt, updatedAt
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        version_id, workflow_id, '', json.dumps(nodes), json.dumps(connections),
        NAME, 0, now, now
    ))

    cursor.execute("""
        INSERT INTO shared_workflow (workflowId, projectId, role, createdAt, updatedAt)
        VALUES (?, ?, ?, ?, ?)
    """, (workflow_id, project_id, 'workflow:owner', now, now))

    conn.commit()
    conn.close()

    print(f"✅ 成功创建 {NAME}")
    print(f"   Workflow ID: {workflow_id}")
    print(f"   Webhook: /webhook/{WEBHOOK_PATH}")

if __name__ == "__main__":
    recreate_workflow()
