# Windows 瘦客户端

## 架构

**所有脚本在 VPS，Windows 只维护登录态**

```
VPS (所有逻辑)                        Windows (瘦客户端)
┌─────────────────────┐              ┌─────────────────────┐
│ vps_scraper.js      │──Tailscale──▶│ 9 个 Chrome 实例     │
│ vps_publisher.js    │  CDP:19222   │ (只保持登录)         │
│                     │   ~19230     │ file-receiver.js    │
└─────────────────────┘              └─────────────────────┘
```

---

## Windows 需要运行的

| 组件 | 用途 | 端口 |
|------|------|------|
| 9 个 Chrome | 保持平台登录态 | 9222-9230 (CDP) |
| file-receiver.js | 接收发布文件 | 3001 |
| Tailscale | VPN 连接 | - |

---

## 设置步骤

### 1. 安装 Tailscale
1. 下载：https://tailscale.com/download/windows
2. 登录同一账号（与 VPS 相同）

### 2. 启动 9 个 Chrome 实例

每个平台一个 Chrome，使用独立 profile 和 CDP 端口：

```powershell
# 抖音 (端口 9222)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9222 `
  --user-data-dir="C:\automation\profiles\douyin" `
  https://creator.douyin.com

# 快手 (端口 9223)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9223 `
  --user-data-dir="C:\automation\profiles\kuaishou" `
  https://cp.kuaishou.com

# 小红书 (端口 9224)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9224 `
  --user-data-dir="C:\automation\profiles\xiaohongshu" `
  https://creator.xiaohongshu.com

# 头条主号 (端口 9225)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9225 `
  --user-data-dir="C:\automation\profiles\toutiao-main" `
  https://mp.toutiao.com

# 头条副号 (端口 9226)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9226 `
  --user-data-dir="C:\automation\profiles\toutiao-sub" `
  https://mp.toutiao.com

# 微博 (端口 9227)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9227 `
  --user-data-dir="C:\automation\profiles\weibo" `
  https://weibo.com

# 视频号 (端口 9228)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9228 `
  --user-data-dir="C:\automation\profiles\shipinhao" `
  https://channels.weixin.qq.com

# 公众号 (端口 9229)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9229 `
  --user-data-dir="C:\automation\profiles\gongzhonghao" `
  https://mp.weixin.qq.com

# 知乎 (端口 9230)
& "C:\Program Files\Google\Chrome\Application\chrome.exe" `
  --remote-debugging-port=9230 `
  --user-data-dir="C:\automation\profiles\zhihu" `
  https://www.zhihu.com/creator
```

### 3. 首次登录
打开每个浏览器，手动登录对应平台账号。登录态会保存在 profile 目录。

### 4. 启动 file-receiver.js
```powershell
cd C:\automation
node file-receiver.js
```
监听 3001 端口，用于接收发布时的媒体文件。

### 5. 配置端口转发
Tailscale 默认会暴露所有端口。确保 VPS 能访问：
- 19222-19230 (CDP，映射到本地 9222-9230)
- 3001 (file-receiver)

---

## 平台端口对照

| 平台 | 内部端口 | 外部端口 | 登录地址 |
|------|----------|----------|----------|
| 抖音 | 9222 | 19222 | https://creator.douyin.com |
| 快手 | 9223 | 19223 | https://cp.kuaishou.com |
| 小红书 | 9224 | 19224 | https://creator.xiaohongshu.com |
| 头条主号 | 9225 | 19225 | https://mp.toutiao.com |
| 头条副号 | 9226 | 19226 | https://mp.toutiao.com |
| 微博 | 9227 | 19227 | https://weibo.com |
| 视频号 | 9228 | 19228 | https://channels.weixin.qq.com |
| 公众号 | 9229 | 19229 | https://mp.weixin.qq.com |
| 知乎 | 9230 | 19230 | https://www.zhihu.com/creator |

---

## 文件结构

```
C:\automation\
├── file-receiver.js     # 文件接收服务
├── profiles\            # Chrome Profile 目录
│   ├── douyin\
│   ├── kuaishou\
│   ├── xiaohongshu\
│   ├── toutiao-main\
│   ├── toutiao-sub\
│   ├── weibo\
│   ├── shipinhao\
│   ├── gongzhonghao\
│   └── zhihu\
└── uploads\             # 接收的文件临时目录
```

---

## 维护

- **登录过期**: 重新打开对应浏览器手动登录
- **换机器**: 只需重新登录 9 个账号，VPS 脚本不用改
- **调试**: 所有日志在 VPS，SSH 查看即可
