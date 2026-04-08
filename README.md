# Marriott Folio Workflow

当前阶段目标：

- 接收一个 PDF 文件
- 提取显性和隐藏背景信息
- 输出 JSON 和 CSV
- 生成去除背景信息和 `HWANG154` 的 `{原文件名}_folio.pdf`
- 在 `~/Documents/marriott_missing_stay_auto_report/<last name>_<first name>/` 下保存全部产物
- 产物按 `origin/` 和 `modify/` 分开保存
- 支持在第 1 步上传证件，文件保存到姓名资料夹下的 `ID/`
- 基于 PDF 解析出的姓名注册 Cloud Mail 邮箱
- 使用新邮箱给 `tony.stig@icloud.com` 发送通知邮件
- 邮箱注册成功后，把核心字段写入本地 SQLite 数据库
- 基于本地数据库记录调用 `opencli createMarriottAccount` 注册万豪会员
- 基于本地数据库记录调用 `opencli MarriottMissingStayRequest` 提交补登，并上传 `modify/` 下的脱敏 PDF

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

第 3 步“注册万豪会员”依赖本机已经可用的 `opencli` 命令。桌面端会按以下参数执行：

```bash
opencli createMarriottAccount \
  --first-name <数据库 firstName> \
  --last-name <数据库 lastName> \
  --country USA \
  --zip-code <数据库 zipcode> \
  --email <数据库 mailboxEmail> \
  --password <数据库 psw> \
  --remember-me false \
  --marketing-emails true
```

第 4 步“补登住宿记录”会执行：

```bash
opencli MarriottMissingStayRequest \
  --third-party-booking no \
  --phone-number <数据库 phone> \
  --hotel-name <数据库 hotel> \
  --check-in-date <数据库 arrivalDate> \
  --check-out-date <数据库 departureDate> \
  --bill-copy digital \
  --confirmation-number <数据库 confirmationNumber> \
  --comments "Please credit this stay" \
  --attachment <姓名资料夹/modify/*_folio.pdf>
```

可选参数：

- `--output-root <path>`: 自定义输出根目录，默认是 `~/Documents/marriott_missing_stay_auto_report`
- `--workspace <path>`: 已存在的姓名资料夹路径，优先从 `origin/extracted.json` 读取解析结果
- `--mail-api-base-url <url>`: Cloud Mail 服务地址，支持传根地址或 `/api/public` 完整地址
- `--mail-admin-email <email>`: Cloud Mail 管理员邮箱
- `--mail-admin-password <password>`: Cloud Mail 管理员密码
- `--mail-domain <domain>`: 要创建的新邮箱域名，默认 `ryy.asia`
- `--notify-recipient <email>`: 新邮箱注册完成后的通知收件人，默认 `tony.stig@icloud.com`

## 本地数据库

邮箱注册成功后，会把以下字段写入本地 SQLite：

- `firstName`
- `lastName`
- `memberNumber`
- `hotel`
- `total`
- `arrivalDate`
- `departureDate`
- `roomNumber`
- `confirmationNumber`
- `mailboxEmail`
- `phone`
- `zipcode`
- `psw`

数据库文件位置：

- `~/Documents/marriott_missing_stay_auto_report/marriott_folio.sqlite`

数据表：

- `workflow_records`

`psw` 生成规则：

- `大写(last name 首字母) + 小写(first name 首字母) + @marriott`
- 例如：`Li / Man Jia -> Lm@marriott`

`phone` 生成规则：

- 随机 8 位数字字符串

`zipcode` 生成规则：

- 随机取一个加州真实 ZIP Code

`hotel` 规则：

- 固定值：`Rissai Valley, a Ritz-Carlton Reserve, China, Jiuzhaigou`

`total` 规则：

- 取 PDF 提取结果里的金额字段，当前来源是 `balanceAmount`

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
│   ├── raw-strings.txt
│   └── visible-text.json
├── email/
    ├── email-account.json
    ├── email-account.csv
    ├── notification-email.json
    ├── notification-email.csv
    ├── notification-email.html
    └── notification-email.txt
├── ID/
│   └── 证件文件
└── modify/
    ├── {原文件名}_folio.pdf
    ├── extracted.json
    ├── extracted.csv
    ├── hidden-data.json
    ├── hidden-data.csv
    ├── pdf-metadata.json
    ├── line-items.csv
    ├── raw-strings.txt
    └── visible-text.json
```
