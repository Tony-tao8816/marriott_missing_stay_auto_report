# Marriott Missing Stay Submission

使用 agent-browser 自动提交万豪缺失住宿记录补登申请。

## 补登流程

1. 登录万豪账户
2. 导航到补登页面
3. 填写补登表单
4. 上传账单附件（folio PDF）
5. 提交申请
6. 保存申请结果

## 补登页面

URL: https://www.marriott.com/loyalty/myAccount/missingStayRequest.mi

## 表单字段

| 字段 | 来源 | 说明 |
|------|------|------|
| Hotel Name | PDF | 酒店名称 |
| Check-in Date | PDF | 入住日期 |
| Check-out Date | PDF | 离店日期 |
| Confirmation Number | PDF | 确认号 |
| Room Number | PDF | 房号（可选）|
| Folio PDF | 清理后的 PDF | 账单附件 |

