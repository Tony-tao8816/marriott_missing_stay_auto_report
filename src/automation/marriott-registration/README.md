# Marriott Registration Automation

使用 ocbot CLI 自动完成万豪会员注册流程。

## 注册流程

1. 创建 ryy.asia 邮箱
2. 导航到注册页面
3. 填写注册表单
4. 提交注册
5. 等待验证邮件
6. 完成邮箱验证

## 必填字段

| 字段 | 说明 |
|------|------|
| First Name | 名 |
| Last Name | 姓 |
| Email | 邮箱（使用 ryy.asia） |
| Password | 密码 |
| Confirm Password | 确认密码 |
| Country | 国家 |
| ZIP/Postal Code | 邮政编码 |

## 使用示例

```javascript
const { MarriottRegistration } = require('./marriott-registration');

const reg = new MarriottRegistration({
  ocbotPath: 'ocbot',
  ryyAsiaConfig: {
    baseUrl: 'https://ryy.asia',
    adminMailbox: 'admin@ryy.asia',
    adminPassword: 'xxx',
    domain: 'ryy.asia'
  }
});

// 注册新会员
const result = await reg.register({
  firstName: 'Min',
  lastName: 'Xie',
  password: 'SecurePass123!',
  country: 'CN',
  zipCode: '100000'
});

console.log('注册成功:', result.email);
```
