# 后端 (Supabase)

本项目使用 [Supabase](https://supabase.com) 作为后端服务，提供 PostgreSQL 数据库、身份认证及实时订阅。

## 目录结构

```
backend/
├── schema.sql        # 完整数据库 Schema（建表 + RLS + 索引）
├── .env.example      # 环境变量示例
└── README.md         # 本文件
```

## 快速开始

### 1. 创建 Supabase 项目

前往 [supabase.com](https://supabase.com) 注册并创建一个新项目。

### 2. 执行 Schema

在 Supabase Dashboard → **SQL Editor** 中，将 `schema.sql` 的内容粘贴并执行，即可创建所有数据表、RLS 策略和索引。

也可以使用 Supabase CLI：

```bash
# 安装 CLI
npm install -g supabase

# 登录
supabase login

# 链接到远程项目
supabase link --project-ref <your-project-ref>

# 推送 schema
supabase db push
```

### 3. 配置环境变量

复制 `.env.example` 为 `.env.local`（放在 frontend 目录下），或在 Vercel/部署平台配置：

```bash
cp .env.example ../frontend/.env.local
```

填写实际的 Supabase URL 和 Anon Key。

### 4. 认证设置（可选）

在 Supabase Dashboard → **Authentication** 中启用 Email / Google / GitHub 等登录方式。

## 数据表说明

| 表名 | 用途 |
|------|------|
| `profiles` | 用户基本档案 |
| `diagnostic_reports` | AI 诊断报告（匹配度、技能差距、行动方案） |
| `simulator_sessions` | AI 模拟面试会话记录 |
| `coach_profiles` | AI 教练档案（公开只读） |
| `bookings` | 用户预约教练记录 |
| `tasks` | 个性化学习任务清单 |

## 安全说明

- 所有表均启用 **RLS (Row Level Security)**，用户只能访问自己的数据。
- `coach_profiles` 为公开可读，仅 `service_role` 可写入。
- `SUPABASE_SERVICE_ROLE_KEY` 仅在服务端使用，**严禁**暴露到前端代码。