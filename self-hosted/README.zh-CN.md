# Remote Login Relay — 自托管版

当本地 AI Agent 在 Mac 上遇到必须由人完成的登录步骤时，你可以用手机临时接管一个精确指定的 Chrome 标签页。

这是 MIT 开源自托管版。你需要自行准备 Cloudflare 账号、由 Cloudflare 管理 DNS 的域名、Cloudflare Named Tunnel，以及把临时链接发到手机的私密渠道。ToolArks 不托管该中继，也不接收浏览器画面。

它只交接一个精确匹配的 Chrome 标签页，不共享整个桌面，也不把密码、验证码、Cookie 或会话令牌导出给 AI。

![远程登录接力流程：遇到登录阻塞，只交接一个标签页，通过邮件发送限时链接，在手机上亲自登录，然后完成](../assets/how-it-works.png)

## 使用前准备

- macOS 13 或更高版本
- Node.js 20 或更高版本
- Google Chrome 或 Chromium
- `cloudflared`
- Cloudflare 账号和由 Cloudflare 管理 DNS 的域名
- 如需使用 Skill，还需 Codex 或 Claude Code

下面的示例使用隧道名 `remote-login-relay`、公网域名 `relay.example.com`、本机网关 `http://127.0.0.1:6081`。请替换为你自己的值。

## 1. 安装依赖

使用你熟悉的包管理器安装 Node.js 20+。macOS 可以通过 Homebrew 安装 `cloudflared`：

```bash
brew install cloudflared
```

在当前目录安装网关依赖：

```bash
npm install
```

## 2. 启动隔离的 Chrome 配置

Chrome 136 及以后版本使用 `--remote-debugging-port` 时，必须同时指定非默认用户数据目录。为 AI 浏览器任务启动一个独立 Chrome 配置：

```bash
open -na "Google Chrome" --args \
  --remote-debugging-port=9222 \
  --user-data-dir="$HOME/Library/Application Support/ToolArks/RemoteLoginRelayChrome"
```

在这个 Chrome 配置中登录你需要的网站。不要把 `9222` 端口发布到局域网或公网。

检查 Chrome 是否就绪：

```bash
curl --noproxy '*' http://127.0.0.1:9222/json/version
```

## 3. 创建 Cloudflare 本地管理隧道

```bash
cloudflared tunnel login
cloudflared tunnel create remote-login-relay
cloudflared tunnel route dns remote-login-relay relay.example.com
```

创建命令会输出隧道 UUID，并在 `~/.cloudflared/` 下生成凭据 JSON 文件。

新建 `~/.cloudflared/remote-login-relay.yml`：

```yaml
tunnel: YOUR_TUNNEL_UUID
credentials-file: /Users/YOUR_MAC_USER/.cloudflared/YOUR_TUNNEL_UUID.json

ingress:
  - hostname: relay.example.com
    service: http://127.0.0.1:6081
  - service: http_status:404
```

验证配置：

```bash
cloudflared tunnel --config "$HOME/.cloudflared/remote-login-relay.yml" ingress validate
```

产品脚本只会在交接会话期间启动隧道。不建议把这个隧道安装为永久运行的系统服务。

## 4. 配置 Remote Login Relay

```bash
./scripts/configure.sh \
  --public-url https://relay.example.com \
  --tunnel-config "$HOME/.cloudflared/remote-login-relay.yml" \
  --tunnel-name remote-login-relay
```

脚本会以仅当前用户可读的权限保存域名和本机路径，不会把 Cloudflare 凭据复制到产品包。

## 5. 安装 Skill

Codex：

```bash
./scripts/install.sh codex
```

Claude Code：

```bash
./scripts/install.sh claude
```

安装后的 Skill 名称为 `remote-login-relay`。

## 6. 发起一次手机交接

在隔离的 Chrome 配置中打开目标登录页，然后使用能且只能匹配一个标签页的 URL 或标题片段：

```bash
./scripts/start.sh 30 'accounts.example.com/login'
```

命令会输出一条以 `#token=...` 结尾的完整 URL。请用你自己控制的私密渠道把它发到手机，再在手机浏览器中完成登录。

如果没有匹配项，或者匹配到多个标签页，程序会拒绝启动。请改用更精确的匹配片段。

## 7. 停止并检查

```bash
./scripts/stop.sh
./scripts/status.sh
```

停止中继不会清除网站在 Chrome 中的登录状态。

## 与 AI Agent 配合使用

当 Agent 遇到必须由你处理的登录步骤时，让它使用 `$remote-login-relay`。Skill 会要求 Agent：

1. 只选择当前受阻的精确标签页；
2. 创建默认 30 分钟的交接；
3. 只把完整临时链接交给你；
4. 确认原标签页已离开登录页；
5. 立即关闭网关和隧道。

Agent 不应要求你在聊天中粘贴密码、验证码、Cookie 或会话令牌。

## 常见问题

### 无法访问 Chrome 调试端点

确认 Chrome 同时带有 `--remote-debugging-port=9222` 和非默认 `--user-data-dir` 参数，然后运行：

```bash
curl --noproxy '*' http://127.0.0.1:9222/json/list
```

### 公网链接无法打开

```bash
cloudflared tunnel info remote-login-relay
./scripts/status.sh
```

确认隧道把精确域名指向 `http://127.0.0.1:6081`，并以 `http_status:404` 作为最后的通配规则。

### Mac 休眠或断网

中继无法工作。唤醒 Mac、恢复网络，然后创建新会话。

## 安全边界

链接的 URL Fragment 中包含随机临时控制令牌。拿到完整链接的人，在链接过期或网关关闭前都可以控制所选标签页。

- 不要转发或公开完整链接。
- 不要把 Chrome 调试端口暴露到局域网或公网。
- 保持较短的会话时间，使用后立即关闭。
- 使用独立 Chrome 配置，不要使用 Chrome 默认配置。
- 使用前阅读 [SECURITY.md](../SECURITY.md)。

## 不想自己处理域名和隧道？

[Remote Login Relay Cloud](https://toolarks.com/zh/remote-login-relay) 是 ToolArks 的托管云服务。ToolArks 负责公网域名、加密中继、邮件发送、购买验证、次数计量和客户支持。

| 次数包 | 价格 | 成功新会话 | 有效期 |
|---|---:|---:|---:|
| 入门包 | $1.99 | 10 | 1 年 |
| 标准包 | $10 | 500 | 2 年 |

两者都是一次性购买，没有订阅或自动续费。支持邮箱为 `support@toolarks.com`；会话通知由只发不收的 `relay@notify.toolarks.com` 发送。

## 开源许可

MIT，详见 [LICENSE](LICENSE)。
