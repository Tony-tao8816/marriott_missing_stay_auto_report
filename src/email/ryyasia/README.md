# Ryy.asia 邮箱服务

使用 Tony 的 ryy.asia 自建邮箱服务进行自动化邮箱注册和验证码获取。

## API 端点

- 基础 URL: `https://ryy.asia` (需在 .env 中配置)
- 所有接口都需要通过 `genToken` 获取的 Authorization Token

## 接口列表

### 1. 生成 Token
```http
POST /api/public/genToken
Content-Type: application/json

{
  "mailbox": "admin@ryy.asia",
  "password": "admin_password"
}
```

### 2. 添加用户 (创建邮箱)
```http
POST /api/public/addUser
Authorization: Bearer <token>
Content-Type: application/json

{
  "user": "newuser",
  "password": "user_password"
}
```

### 3. 邮件查询
```http
POST /api/public/emailList
Authorization: Bearer <token>
Content-Type: application/json

{
  "to": "user@ryy.asia",
  "limit": 10
}
```

## IMAP 配置

用于直接连接邮箱服务器收取邮件（备用方案）：

| 配置项 | 值 |
|--------|-----|
| Host | ryy.asia |
| Port | 993 |
| TLS | true |
| 用户名 | 完整邮箱地址 |
| 密码 | 用户密码 |

## 环境变量

```bash
# Ryy.asia API 配置
RYY_API_BASE_URL=https://ryy.asia
RYY_ADMIN_MAILBOX=admin@ryy.asia
RYY_ADMIN_PASSWORD=your_admin_password

# IMAP 配置 (备用)
RYY_IMAP_HOST=ryy.asia
RYY_IMAP_PORT=993
RYY_IMAP_TLS=true
```
