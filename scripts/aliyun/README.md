# Firestore → 阿里云 RDS PostgreSQL 迁移工具

独立目录，**不参与 `frontend/` 构建**，只用于 Day 2 的数据迁移与演练。原有业务代码不做任何改动。

```
scripts/aliyun/
├── package.json              # 独立依赖：firebase-admin + pg
├── migrate-firestore.mjs     # Firestore → dump/*.ndjson
├── import-postgres.mjs       # dump/*.ndjson → PostgreSQL
├── migrate-storage.sh        # Firebase Storage → OSS
├── dump/                     # 导出产物（已 gitignore，勿提交）
└── sql/
    ├── 001_schema.sql        # 建表
    └── 002_indexes.sql       # 索引 + 可选外键/pgvector
```

## 0. 前置

1. 阿里云 RDS PostgreSQL 已创建（建议 14 及以上，开启 SSL）。
2. 本机具备只读的 Firebase 服务账号（Firebase Admin SDK 权限）。
3. 安装依赖：

```bash
cd scripts/aliyun
npm install
```

## 1. 建表

在 RDS 上依次执行（DMS 或 psql）：

```bash
psql "$DATABASE_URL" -f sql/001_schema.sql
psql "$DATABASE_URL" -f sql/002_indexes.sql
```

## 2. 导出 Firestore

```bash
export FIREBASE_PROJECT_ID=pathway-app-512202
# 二选一：
export GOOGLE_APPLICATION_CREDENTIALS=/abs/path/service-account.json
# 或
export FIREBASE_CLIENT_EMAIL=...
export FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n..."

node migrate-firestore.mjs --skip-ephemeral
```

产物：`dump/<collection>.ndjson`（每行 `{ id, data }`）+ `dump/_summary.json`。

## 3. 导出 Firebase Auth 用户（可选但建议）

```bash
firebase auth:export dump/auth-users.json --format=json --project pathway-app-512202
```

导入后所有账号标记 `must_reset_password = true`。Firebase 的密码哈希是定制 scrypt，**不建议**跨库校验，直接让用户重置。

## 4. 导入 PostgreSQL

```bash
export DATABASE_URL="postgres://user:pass@host:5432/pathway?sslmode=require"

node import-postgres.mjs                      # 全量
node import-postgres.mjs --only coach_profiles
node import-postgres.mjs --include-ephemeral  # 连 rate_limits 一起
```

脚本会：

- 幂等 upsert（`ON CONFLICT DO UPDATE`），可重复执行；
- 将表结构中没有的 Firestore 字段写入 `extra jsonb`（无损）；
- 自动打印 dump 条数 vs DB 条数的校验表。

## 5. 迁移 Storage

见 `migrate-storage.sh` 头部注释。要点：

- 三个前缀：`resumes/`、`coach-docs/`、`coach-avatars/`；
- OSS Bucket **必须私有**，应用改为签名 URL；
- `resumes/anonymous/` 配 30 天生命周期；
- 校验通过前不要删除 GCS 源文件。

## 6. 字段映射与已知差异

| Firestore | PostgreSQL | 说明 |
|---|---|---|
| `coach_orders.stripe_payment_intent` | `coach_orders.payment_ref` | 试点期不接支付，字段保留 |
| `coach_orders.stripe_session_id` | `extra` | 仅留档 |
| `coach_profiles.embedding` | `embedding jsonb` | 维度 1024，需用 text-embedding-v4 重算 |
| `coach_threads.messages` | `messages jsonb` | 结构不变 |
| `coach_reviews.reviewer_name` | `reviewer_name` | 冗余字段保留，避免联表 |
| `rate_limits` | `rate_limits` | 临时数据，默认可不迁移 |

**已知历史问题（迁移时顺手修）**：`api/booking/concierge` 里读取的是 `coaches` 集合，但实际教练数据在 `coach_profiles`，导致飞书通知里的教练名恒为「未指定」。迁移后应改成查 `coach_profiles`。

## 7. 校验 SQL

```sql
-- 每个用户只有一份主简历（应为 0 行）
SELECT user_id, count(*) FROM user_resumes WHERE is_primary GROUP BY user_id HAVING count(*) > 1;

-- 预约引用了不存在的订单（应为 0 行）
SELECT b.id FROM coach_bookings b
LEFT JOIN coach_orders o ON o.id = b.order_id
WHERE b.order_id IS NOT NULL AND o.id IS NULL;

-- 孤儿简历
SELECT r.id FROM user_resumes r
LEFT JOIN profiles p ON p.id = r.user_id
WHERE p.id IS NULL;

-- 向量维度抽查
SELECT id, jsonb_array_length(embedding) AS dim FROM coach_profiles WHERE embedding IS NOT NULL LIMIT 20;
```

## 8. 回滚

- 数据：迁移期间 Firestore 保持只读或双写，Cloud Run 旧版本保留至少 7 天；
- 库：导入前对 RDS 做一次快照；
- 文件：GCS 源文件不删，OSS 导入失败可直接重跑；
- 应用：DNS 切回旧地址即可，数据库不参与回滚决策。

## 9. 不要提交 dump/

`dump/` 含真实用户简历文本、邮箱、联系方式。请在仓库根 `.gitignore` 中确认忽略（本目录已提供 `.gitignore`）。
