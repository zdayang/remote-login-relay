# ToolArks Remote Login Relay — 自托管版

当 AI 在电脑上的浏览器操作遇到必须由人完成的登录时，你可以用手机接管**这一张 Chrome 页面**完成登录。链接通过带有 ToolArks 品牌的邮件发送，交接结束后自动失效。

> 不想配置域名、Tunnel 和发件邮箱？可以使用 [ToolArks Remote Login Relay Cloud](https://toolarks.com/zh/remote-login-relay) 托管方案。本仓库只包含自托管版本，Cloud 版本由 ToolArks 独立运营。

![Remote Login Relay 工作流：AI 被登录阻塞，用户在手机邮件中打开链接完成登录，原 Chrome 页面继续](../assets/how-it-works.png)

## 先走向导，不要手工拼配置

第一次运行：

```bash
./scripts/setup.sh
```

向导会先问三个问题：

1. **你有由 Cloudflare 管理 DNS 的域名吗？** 有的话，使用稳定域名和命名的 Cloudflare Tunnel。
2. **你没有域名，但有 Cloudflare 账号吗？** 可以使用临时的 Quick Tunnel。它不需要域名（甚至不要求登录账号），每次生成一个随机的 `trycloudflare.com` 地址，适合测试，不是固定生产地址。
3. **太麻烦了，想直接使用？** 向导会给出 ToolArks Cloud 入口；Cloud 版替你处理域名、隧道和发件邮箱配置：[使用 ToolArks Remote Login Relay Cloud](https://toolarks.com/zh/remote-login-relay)。不会未经同意替你购买或创建账号。

然后向导会配置发件邮箱：Gmail/Google Workspace、Outlook/Microsoft 365 或自定义 SMTP。它会给出正确的服务器和安全方式，要求你填写发件地址与手机通知地址，并将 SMTP 应用专用密码保存到 macOS 钥匙串。密码不会写入 `config.env`，也不会打印或发送给 ToolArks。

真正登录前先测试邮件：

```bash
./scripts/test-email.sh
```

你应该收到主题为 `ToolArks · self-hosted email test` 的邮件。收不到时先修复邮箱配置，不要直接开始登录。Gmail 必须使用 Google 的应用专用密码，不能使用普通登录密码；Microsoft 365 可能需要为邮箱启用 SMTP AUTH。

## 环境要求

- macOS 13 或更新版本；
- Node.js 20 或更新版本；
- Google Chrome 或 Chromium；
- `cloudflared`（可用 `brew install cloudflared` 安装）；
- 能向通知地址发信的 SMTP 邮箱；
- 如果要使用随附 Skill，需要 Codex 或 Claude Code。

## 安装并准备 Chrome

```bash
npm install
./scripts/install.sh codex       # 或：./scripts/install.sh claude
```

Chrome 136 及更新版本在开启远程调试时需要单独的用户目录。请使用专用配置目录：

```bash
open -na "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/ToolArks/RemoteLoginRelayChrome"
```

9222 端口必须只监听本机。用这个配置登录你平时要使用的网站，然后检查：

```bash
curl --noproxy '*' http://127.0.0.1:9222/json/version
```

## 稳定域名方案：域名 + 命名 Tunnel

如果你在向导中选择稳定域名方案，只需创建一次 Tunnel：

```bash
cloudflared tunnel login
cloudflared tunnel create remote-login-relay
cloudflared tunnel route dns remote-login-relay relay.example.com
```

创建 `~/.cloudflared/remote-login-relay.yml`：

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /Users/YOUR_MAC_USER/.cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  - hostname: relay.example.com
    service: http://127.0.0.1:6081
  - service: http_status:404
```

向导会记录域名、YAML 路径和 Tunnel 名称。Tunnel 只在一次交接期间运行，不会安装成常驻服务。

## 开始一次手机交接

先在专用 Chrome 中打开需要登录的页面，再用足够具体的 URL 或标题片段定位唯一标签页：

```bash
./scripts/start.sh 30 'accounts.example.com/login'
```

命令会拒绝“找不到”或“匹配多个”的情况，然后启动本地网关、命名 Tunnel 或 Quick Tunnel，检查公网入口，并把完整临时链接发送到 `REMOTE_RELAY_NOTIFY_TO`。正常流程不会让你把密码或验证码粘贴到聊天里。

在手机上打开 ToolArks 邮件并完成登录。确认电脑原页面已经离开登录界面后：

```bash
./scripts/stop.sh
./scripts/status.sh
```

停止 Relay 不会清除网站已经建立的登录状态。

## Skill 如何工作

当 AI 遇到必须由人完成的登录步骤时，让它调用 `$remote-login-relay`。Skill 会：

1. 首次使用时引导域名、Cloudflare 和发件邮箱配置；
2. 在真实交接前先验证邮件发送；
3. 只选择一张准确的登录标签页；
4. 发送带 ToolArks 品牌的手机链接；
5. 验证原页面状态并停止 Relay。

Skill 不会读取或索要浏览器密码、Cookie、验证码或会话令牌。

## 安全边界和限制

链接片段里有随机控制令牌。收到完整链接的人可以在它过期或 Relay 停止前控制这张 Chrome 页面。它只共享一张准确的标签页，不共享整个桌面。不要转发、公开发布链接，也不要把 Chrome 调试端口暴露到局域网或公网。请使用专用 Chrome 配置和较短会话。

Quick Tunnel 是临时方案：每次地址都会变化，Cloudflare 不把它承诺为稳定生产域名。需要固定地址时，必须使用自己的域名和命名 Tunnel。自托管版运行在你的 Mac 上；ToolArks 不接收浏览器画面，也不会获得你的 SMTP 凭据。

更多安全说明见 [SECURITY.md](../SECURITY.md) 和 [SKILL.md](SKILL.md)。

## 许可证

MIT，见 [LICENSE](LICENSE)。
