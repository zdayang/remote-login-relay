# Remote Login Relay 免费自建版

当本机 AI Agent 卡在扫码、验证码、手机号或第三方授权页面时，把一个精确指定的 Chrome 标签页临时交给手机，由用户本人完成敏感步骤。

本版本免费、开源。域名和 Cloudflare Tunnel 由用户自行准备；ToolArks 不托管远程连接，不接收浏览器画面，也不提供可用性保障。

## 它会做什么

- 只共享一个明确匹配的 Chrome 标签页，不共享整个桌面。
- 密码、验证码、Cookie 和会话令牌不交给 AI。
- 默认生成 30 分钟有效的随机临时链接。
- 会话关闭时恢复电脑页面原来的显示尺寸。
- 公网访问 `/health` 返回 404。

## 环境要求

- macOS 13 或更高版本。
- Node.js 20 或更高版本。
- 以本机调试端口启动的 Google Chrome 或 Chromium。
- `cloudflared`，以及将自己的 HTTPS 域名转发到 `http://127.0.0.1:6081` 的命名隧道。

## 配置

```bash
./scripts/configure.sh \
  --public-url https://remote.example.com \
  --tunnel-config "$HOME/.cloudflared/config.yml" \
  --tunnel-name my-remote-login
```

Cloudflare 凭据不会复制进产品包，只保留在用户自己的 Mac 上。

## 安装 Skill

```bash
./scripts/install.sh codex
# 或
./scripts/install.sh claude
```

## 创建临时会话

```bash
./scripts/start.sh 30 'accounts.example.com/login'
```

如果没有标签页匹配，或者匹配到多个标签页，脚本会停止，不会自行猜测。

## 关闭并核对

```bash
./scripts/stop.sh
./scripts/status.sh
```

完整链接的 `#token=` 后面是临时控制凭证。任何拿到完整链接的人在有效期内都能控制所选标签页，因此只能发送给本人，并在使用后立即关闭。
