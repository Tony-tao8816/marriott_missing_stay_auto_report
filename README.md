# Marriott Folio Workflow

当前阶段目标：

- 接收一个 PDF 文件
- 提取显性和隐藏背景信息
- 输出 JSON 和 CSV
- 生成去除背景信息和 `HWANG154` 的 `{原文件名}_folio.pdf`
- 在 `~/Documents/marriott_missing_stay_auto_report/<last name>_<first name>/` 下保存全部产物
- 产物按 `origin/` 和 `modify/` 分开保存
- 基于 PDF 解析出的姓名注册 Cloud Mail 邮箱
- 使用新邮箱给 `tony.stig@icloud.com` 发送通知邮件

## 用法

```bash
npm run cli -- process-pdf --pdf /path/to/file.pdf
```

```bash
npm run cli -- register-email \
  --workspace "/Users/taoxingliang/Documents/marriott_missing_stay_auto_report/Xia_Zhi Ying" \
  --mail-api-base-url https://mail.ryy.asia \
  --mail-admin-email admin@ryy.asia \
  --mail-admin-password 'Txl@88457'
```

## 桌面应用

```bash
npm install
npm run desktop
```

打包 mac 应用：

```bash
npm run build:mac
```

构建完成后，应用会生成在 `dist/mac/Marriott Folio Workflow.app`。

可选参数：

- `--output-root <path>`: 自定义输出根目录，默认是 `~/Documents/marriott_missing_stay_auto_report`
- `--workspace <path>`: 已存在的姓名资料夹路径，优先从 `origin/extracted.json` 读取解析结果
- `--mail-api-base-url <url>`: Cloud Mail 服务地址，支持传根地址或 `/api/public` 完整地址
- `--mail-admin-email <email>`: Cloud Mail 管理员邮箱
- `--mail-admin-password <password>`: Cloud Mail 管理员密码
- `--mail-domain <domain>`: 要创建的新邮箱域名，默认 `ryy.asia`
- `--notify-recipient <email>`: 新邮箱注册完成后的通知收件人，默认 `tony.stig@icloud.com`

## 输出结构

```text
<last name>_<first name>/
├── origin/
│   ├── 原始PDF
│   ├── extracted.json
│   ├── extracted.csv
│   ├── hidden-data.json
│   ├── hidden-data.csv
│   ├── pdf-metadata.json
│   ├── line-items.csv
│   └── raw-strings.txt
├── email/
    ├── email-account.json
    ├── email-account.csv
    ├── notification-email.json
    ├── notification-email.csv
    ├── notification-email.html
    └── notification-email.txt
└── modify/
    ├── {原文件名}_folio.pdf
    ├── extracted.json
    ├── extracted.csv
    ├── hidden-data.json
    ├── hidden-data.csv
    ├── pdf-metadata.json
    ├── line-items.csv
    └── raw-strings.txt
```
