# n8n Cloud 调用 Windows Runner

## 方式一：n8n Cloud → VPS SSH → Windows Runner（推荐）

因为 n8n Cloud 无法直接访问你的内网，需要通过 VPS 中转。

### VPS 上创建调用脚本
```bash
# 在 VPS 上创建 /home/xx/call_runner.sh
cat > ~/call_runner.sh << 'EOF'
#!/bin/bash
WINDOWS_IP="100.x.x.x"  # 替换成 Windows 的 Tailscale IP
RUNNER_KEY="your-runner-api-key"  # 替换成你的 Runner API Key
PLATFORM=$1
MODE=${2:-script}
TASK=$3

if [ "$MODE" == "llm" ]; then
    curl -s -X POST "http://${WINDOWS_IP}:3000/run" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${RUNNER_KEY}" \
        -d "{\"platform\":\"${PLATFORM}\",\"mode\":\"llm\",\"task\":\"${TASK}\",\"save_script\":true}"
else
    curl -s -X POST "http://${WINDOWS_IP}:3000/run" \
        -H "Content-Type: application/json" \
        -H "x-api-key: ${RUNNER_KEY}" \
        -d "{\"platform\":\"${PLATFORM}\",\"mode\":\"script\"}"
fi
EOF
chmod +x ~/call_runner.sh
```

### n8n Workflow 配置

#### 1. SSH 节点配置
- **Credentials**: 使用已有的 SSH 凭据 (vvJsQOZ95sqzemla)
- **Command**: `bash ~/call_runner.sh douyin script`

#### 2. 示例 Workflow JSON
```json
{
  "nodes": [
    {
      "name": "定时触发",
      "type": "n8n-nodes-base.scheduleTrigger",
      "parameters": {
        "rule": {
          "interval": [{"field": "cronExpression", "expression": "0 21 * * *"}]
        }
      }
    },
    {
      "name": "采集抖音",
      "type": "n8n-nodes-base.ssh",
      "parameters": {
        "command": "bash ~/call_runner.sh douyin script"
      }
    },
    {
      "name": "解析结果",
      "type": "n8n-nodes-base.code",
      "parameters": {
        "jsCode": "const stdout = $input.first().json.stdout || '';\ntry {\n  return [{ json: JSON.parse(stdout) }];\n} catch (e) {\n  return [{ json: { success: false, error: e.message, raw: stdout } }];\n}"
      }
    }
  ]
}
```

---

## 方式二：直接 HTTP（需要 Cloudflare Tunnel）

如果你配置了 Cloudflare Tunnel，n8n Cloud 可以直接调用。

### HTTP Request 节点配置
- **Method**: POST
- **URL**: `https://your-tunnel-domain.com/run`
- **Headers**:
  - `Content-Type`: `application/json`
  - `x-api-key`: `your-runner-api-key`
- **Body (JSON)**:
```json
{
  "platform": "douyin",
  "mode": "script"
}
```

---

## LLM 模式调用（首次生成脚本）

### VPS 命令
```bash
bash ~/call_runner.sh douyin llm "进入创作者中心，获取最近10条视频的标题、播放量、点赞数"
```

### n8n SSH 节点
```
bash ~/call_runner.sh douyin llm "进入创作者中心，获取最近10条视频的标题、播放量、点赞数"
```

成功后会自动保存脚本到 `C:\automation\scripts\douyin.js`，之后用 script 模式即可。

---

## 9 平台采集 Workflow 示例

```javascript
// 汇总节点的 Code
const platforms = ['douyin', 'weibo', 'xiaohongshu', 'toutiao_main', 'toutiao_sub', 'shipinhao', 'gongzhonghao', 'zhihu'];
const results = [];

for (const p of platforms) {
  try {
    const data = $node[`采集${p}`].json;
    results.push({
      platform: p,
      success: data.success,
      count: data.data?.length || 0
    });
  } catch (e) {
    results.push({ platform: p, success: false, error: e.message });
  }
}

return { results, total: results.length, successCount: results.filter(r => r.success).length };
```
