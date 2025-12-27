# Tailscale 配置指南

Tailscale 让你的 Windows 电脑和 VPS 在同一个虚拟内网，无需公网 IP、无需开端口。

## Windows 端设置

### 1. 下载安装
访问 https://tailscale.com/download/windows 下载安装

### 2. 登录
安装后点击系统托盘的 Tailscale 图标，登录账号（支持 Google/Microsoft/GitHub）

### 3. 获取 IP
登录后会分配一个 100.x.x.x 的内网 IP，记下来

---

## VPS 端设置

### 1. 安装 Tailscale
```bash
curl -fsSL https://tailscale.com/install.sh | sh
```

### 2. 登录
```bash
sudo tailscale up
```
会给你一个链接，在浏览器打开并登录同一账号

### 3. 验证连接
```bash
# 查看自己的 IP
tailscale ip

# ping Windows（替换成 Windows 的 Tailscale IP）
ping 100.x.x.x
```

---

## 测试连接

在 VPS 上测试 Windows Runner：
```bash
# 健康检查（替换 IP）
curl http://100.x.x.x:3000/health

# 执行任务
curl -X POST http://100.x.x.x:3000/run \
  -H "Content-Type: application/json" \
  -H "x-api-key: your-runner-api-key" \
  -d '{"platform":"douyin","mode":"script"}'
```

---

## n8n 配置

在 n8n 的 HTTP Request 节点中，URL 使用 Tailscale IP：
```
http://100.x.x.x:3000/run
```

---

## 常见问题

### Q: Windows 防火墙阻止连接？
打开 PowerShell（管理员），运行：
```powershell
New-NetFirewallRule -DisplayName "Automation Runner" -Direction Inbound -LocalPort 3000 -Protocol TCP -Action Allow
```

### Q: Tailscale 断开了？
- Windows：检查系统托盘图标，确保已连接
- VPS：运行 `sudo tailscale status` 检查状态

### Q: 速度很慢？
Tailscale 支持打洞直连，如果无法直连会走中继。运行 `tailscale status` 查看连接类型。
