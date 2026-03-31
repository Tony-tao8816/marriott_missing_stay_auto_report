# ocbot CLI Harness

为 ocbot Web4 Agent 生成 CLI 接口，用于自动化浏览器操作。

## 功能需求

1. **启动 ocbot**
   - 启动浏览器
   - 加载指定配置

2. **执行自动化任务**
   - 导航到 URL
   - 填写表单
   - 点击元素
   - 截图

3. **后台任务**
   - 定时执行
   - 后台运行

## 核心命令

```bash
# 启动 ocbot
ocbot start [--headless] [--profile <name>]

# 导航到 URL
ocbot navigate <url>

# 填写表单
ocbot fill <selector> <value>

# 点击元素
ocbot click <selector>

# 截图
ocbot screenshot [filename]

# 执行 JavaScript
ocbot eval <script>

# 后台任务
ocbot cron add <name> <schedule> <command>
ocbot cron list
ocbot cron remove <name>

# REPL 模式
ocbot
```

## 使用场景

用于万豪会员注册和补登自动化：
1. 启动 ocbot 浏览器
2. 导航到万豪注册页面
3. 自动填写注册表单
4. 获取邮箱验证码
5. 完成注册
6. 提交补登申请
