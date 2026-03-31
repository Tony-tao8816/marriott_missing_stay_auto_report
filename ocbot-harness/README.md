# ocbot CLI Harness

为 ocbot Web4 Agent 生成的 CLI 接口，用于 OpenClaw 自动化控制。

## 安装

```bash
cd ocbot-harness
pip install -e .
```

## 使用方法

### 命令行模式

```bash
# 启动浏览器
ocbot start

# 导航到 URL
ocbot navigate https://www.marriott.com

# 填写表单
ocbot fill "input[name='email']" "user@example.com"

# 点击按钮
ocbot click "button[type='submit']"

# 截图
ocbot screenshot capture.png

# 执行 JavaScript
ocbot eval "document.title"
```

### REPL 交互模式

```bash
$ ocbot
🤖 ocbot REPL - Type 'help' for commands, 'exit' to quit
--------------------------------------------------
ocbot> start
✅ ocbot started on port 9222
ocbot> navigate https://www.marriott.com
✅ Navigated to https://www.marriott.com
ocbot> screenshot marriott-home.png
✅ Screenshot saved to marriott-home.png
ocbot> exit
👋 Goodbye!
```

### JSON 输出模式

```bash
ocbot --json-output navigate https://www.marriott.com
# {"success": true, "url": "https://www.marriott.com", ...}
```

## 与 OpenClaw 集成

在 OpenClaw 中使用 ocbot CLI：

```javascript
// 启动浏览器
await exec('ocbot start');

// 导航到万豪注册页
await exec('ocbot navigate https://www.marriott.com/loyalty/join.mi');

// 填写注册表单
await exec('ocbot fill "input[name=firstName]" "John"');
await exec('ocbot fill "input[name=lastName]" "Doe"');
await exec('ocbot fill "input[name=email]" "test@ryy.asia"');

// 截图
await exec('ocbot screenshot registration.png');
```

## 万豪自动化工作流

```bash
# 1. 启动浏览器
ocbot start

# 2. 导航到注册页
ocbot navigate "https://www.marriott.com/loyalty/join.mi"

# 3. 填写表单
ocbot fill "#firstName" "Xie"
ocbot fill "#lastName" "Min"
ocbot fill "#email" "test@ryy.asia"
ocbot fill "#password" "SecurePass123!"

# 4. 提交
ocbot click "button[type=submit]"

# 5. 等待验证码邮件 (通过 ryy.asia API 获取)

# 6. 完成注册

# 7. 导航到补登页面
ocbot navigate "https://www.marriott.com/loyalty/missing-stay.mi"

# 8. 填写补登信息
ocbot fill "#hotelName" "Ritz-Carlton"
ocbot fill "#checkInDate" "02/28/2026"
ocbot fill "#confirmationNumber" "88008405"

# 9. 提交
ocbot click "button[type=submit]"

# 10. 截图保存结果
ocbot screenshot stay-submission-result.png
```

## 命令参考

| 命令 | 说明 |
|------|------|
| `start` | 启动浏览器 |
| `navigate <url>` | 导航到 URL |
| `fill <selector> <value>` | 填写表单 |
| `click <selector>` | 点击元素 |
| `screenshot [filename]` | 截图 |
| `eval <script>` | 执行 JavaScript |
| `cron add/list/remove` | 管理定时任务 |

## 注意事项

1. 需要安装 ocbot 本体：https://oc.bot
2. 首次使用需要授权 OpenClaw 访问浏览器
3. 建议在 headless 模式下运行自动化任务
