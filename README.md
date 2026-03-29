# Marriott Missing Stay Auto Report

使用 Node.js + Playwright 自动化提交万豪补登申请。项目支持读取 JSON/CSV 批量住宿记录、自动登录万豪账户、填写补登表单、记录结果，并可选发送 Webhook 通知。

## 功能

- 自动登录万豪账户
- 自动填写补登表单
- 支持 JSON/CSV 批量提交
- 输出每次运行的结果文件和汇总文件
- 失败时自动截图
- 支持 Dry Run，用于只校验配置和输入数据
- 支持可选 Webhook 通知

## 项目结构

```text
.
├── config/
│   └── site.example.json
├── data/
│   ├── stays.example.csv
│   └── stays.example.json
├── output/
├── src/
│   ├── automation/
│   │   ├── browser.js
│   │   ├── marriott-client.js
│   │   └── run-batch.js
│   ├── config/
│   │   ├── env.js
│   │   └── schema.js
│   ├── io/
│   │   ├── result-recorder.js
│   │   └── stay-loader.js
│   ├── notify/
│   │   └── webhook-notifier.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── paths.js
│   └── index.js
├── .env.example
├── .gitignore
├── package.json
└── README.md
```

## 环境要求

- Node.js 20+
- npm 10+
- 本地可安装 Chromium 浏览器依赖

## 安装

```bash
npm install
npx playwright install chromium
```

如果你已经在当前仓库运行过 `npm install`，仍建议手动执行一次 `npx playwright install chromium`，避免浏览器二进制缺失。

## 配置

### 1. 环境变量

复制模板：

```bash
cp .env.example .env
```

关键字段：

- `MARRIOTT_USERNAME`: 万豪登录用户名，通常是邮箱或会员号
- `MARRIOTT_PASSWORD`: 万豪登录密码
- `HEADLESS`: `true/false`
- `SLOW_MO_MS`: Playwright 慢动作延迟，便于观察页面
- `TIMEOUT_MS`: 默认等待超时
- `MFA_WAIT_MS`: 登录后等待多因素验证完成的最长时间
- `RESULT_DIR`: 运行结果输出目录
- `NOTIFY_WEBHOOK_URL`: 可选，填入后会在任务结束时发送 JSON 摘要

### 2. 站点配置

复制模板：

```bash
cp config/site.example.json config/site.json
```

你需要根据实际万豪页面更新 `config/site.json` 中的 URL 和 CSS 选择器。原因很简单：万豪页面可能按地区、账户状态、A/B 测试或时间发生变化，不能把固定选择器写死后假定永远可用。

重点检查这些字段：

- `login.url`
- `login.selectors.username`
- `login.selectors.password`
- `login.selectors.submit`
- `login.selectors.successIndicator`
- `missingStay.url`
- `missingStay.selectors.*`

建议先用浏览器开发者工具确认补登页面的表单结构，再填写这些选择器。

## 输入文件格式

支持 JSON 和 CSV。

### JSON 示例

```json
[
  {
    "hotelName": "JW Marriott Hotel Shenzhen",
    "checkInDate": "2026-02-12",
    "checkOutDate": "2026-02-14",
    "confirmationNumber": "ABC12345",
    "hotelCode": "SZXJW",
    "country": "CN",
    "notes": "Business trip"
  }
]
```

### CSV 示例

```csv
hotelName,checkInDate,checkOutDate,confirmationNumber,hotelCode,country,notes
JW Marriott Hotel Shenzhen,2026-02-12,2026-02-14,ABC12345,SZXJW,CN,Business trip
```

字段说明：

- `hotelName`: 酒店名称
- `checkInDate`: 入住日期，格式 `YYYY-MM-DD`
- `checkOutDate`: 退房日期，格式 `YYYY-MM-DD`
- `confirmationNumber`: 预订确认号
- `hotelCode`: 可选，酒店代码
- `country`: 可选，国家/地区代码
- `notes`: 可选，补充说明

## 使用方式

### 1. 仅校验配置

```bash
npm run validate-config -- --site-config config/site.example.json
```

### 2. Dry Run

只校验配置和输入，不打开浏览器：

```bash
npm run dry-run
```

### 3. 正式提交

```bash
npm run run -- --input data/stays.example.json --site-config config/site.json
```

如果需要可视化浏览器：

```bash
npm run run -- --input data/stays.example.json --site-config config/site.json --headed
```

也可以直接调用 CLI：

```bash
node src/index.js run --input data/stays.example.csv --site-config config/site.json
```

## 结果输出

每次运行都会在 `output/<timestamp>/` 下生成：

- `results.jsonl`: 每条提交结果一行 JSON
- `summary.json`: 本次批量任务汇总
- `*-failure.png`: 某条记录失败时的页面截图

## 通知

配置 `NOTIFY_WEBHOOK_URL` 后，程序会在批量任务结束时向该地址发送 `summary.json` 同结构的 JSON 数据。适合接入企业微信机器人、中间件服务、Slack Webhook 或自建告警系统。

## 运行流程说明

1. 读取 `.env`
2. 读取站点配置 `config/site.json`
3. 读取输入记录文件
4. 登录万豪账户
5. 逐条打开补登页面并提交
6. 记录每条结果
7. 写入汇总文件并发送通知

## 注意事项

- 万豪页面如果出现验证码、MFA、地区跳转或额外确认页，自动化流程可能需要你调整选择器或等待策略。
- 该项目已经把站点细节抽离到配置文件，但并没有绕过验证码或风控逻辑。
- 首次执行前请先用一条测试记录验证整个流程，再进行批量提交。
- 如果万豪网站更新了页面结构，优先修改 `config/site.json`，不要直接改自动化逻辑。

## 后续建议

- 增加重试策略和失败重跑
- 接入邮件通知
- 增加 SQLite 运行历史归档
- 为不同地区站点维护多套选择器配置
