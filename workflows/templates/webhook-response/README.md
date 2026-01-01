# Webhook 响应模板

## 用途
接收 HTTP webhook 请求并返回 JSON 响应的标准流程。

## 适用场景
- API 端点
- 外部系统回调
- 数据接收接口

## 节点说明
1. **Webhook** - 接收 POST 请求
2. **处理数据** - 验证和处理请求数据
3. **返回响应** - 返回 JSON 格式响应

## 使用方法

### 调用示例
```bash
curl -X POST "http://localhost:5679/webhook/my-webhook" \
  -H "Content-Type: application/json" \
  -d '{"name": "test"}'
```

### 响应示例
```json
{
  "success": true,
  "data": {
    "message": "Hello, test!",
    "timestamp": "2025-12-25T08:00:00.000Z",
    "received": {"name": "test"}
  }
}
```

## 自定义配置
- 修改 webhook 路径: `path` 参数
- 调整业务逻辑: "处理数据" 节点的 JS 代码
- 添加验证规则: 在 Code 节点中添加验证逻辑
