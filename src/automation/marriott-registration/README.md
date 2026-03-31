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
| Email | **自动生成** (见下方规则) |
| Password | **自动生成** (见下方规则) |
| Confirm Password | 同上 |
| Country | 国家 (默认: US) |
| ZIP/Postal Code | 邮政编码 (默认: 随机加州/华盛顿州) |

## 邮箱生成规则

**格式**: `firstname_lastname@ryy.asia` (全小写)

**示例**:
- 姓名: Xie Min
- 邮箱: `min_xie@ryy.asia`

## 密码生成规则

**格式**: `Lastname首字母大写` + `Firstname首字母小写` + `@marriott`

**示例**:
- 姓名: Xie Min
- 密码: `Xm@marriott`

## ZIP Code 规则

**默认**: 随机生成美国加州或华盛顿州邮编
- **加州 (CA)**: 90001-96162
- **华盛顿州 (WA)**: 98001-99403

也可手动指定: `--zip-code 90210`

## 使用示例

```bash
# 基础用法 (美国 + 随机邮编 + 自动生成密码)
npm run marriott-register -- -f "Min" -l "Xie"

# 指定加州邮编
npm run marriott-register -- -f "Min" -l "Xie" -z "90210"

# 显示浏览器窗口 (调试用)
npm run marriott-register -- -f "Min" -l "Xie" --headed
```

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

// 注册新会员 (自动生成邮箱、密码和邮编)
const result = await reg.register({
  firstName: 'Min',
  lastName: 'Xie'
  // email 自动生成: min_xie@ryy.asia
  // password 自动生成: Xm@marriott
  // country 默认: US
  // zipCode 默认: 随机加州/华盛顿
});

console.log('注册成功:', result.email);     // min_xie@ryy.asia
console.log('用户名:', result.username);   // min_xie
console.log('密码:', result.password);      // Xm@marriott
console.log('邮编:', result.zipCode);       // 例如: 92101 (加州)
```
