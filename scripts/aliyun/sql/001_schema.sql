-- ============================================================
-- Pathway · 阿里云 RDS PostgreSQL 初始化脚本
-- 目标：承接原 Firestore 全部业务集合，字段名与现有 TS 数据层保持一致
--
-- 约定：
--   1) 主键统一 text，迁移时沿用 Firestore document id；新建时用 gen_random_uuid()
--   2) 时间统一 timestamptz；Firestore 的 ISO 字符串可直接写入
--   3) 结构易变的对象/数组统一用 jsonb，避免迁移期字段错位
--   4) 每张表保留 extra jsonb，用于承接 Firestore 中的未知字段（无损迁移）
--   5) current_role / role 是 PostgreSQL 关键字/保留字，必须加双引号
--   6) 不在本脚本建外键：Firestore 无引用完整性，先迁数据、校验后再启用（见 002）
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()

-- ─── 认证（Firebase Auth 的替代） ────────────────────────────────
CREATE TABLE IF NOT EXISTS users (
  id                  text PRIMARY KEY,               -- 与 profiles.id 相同
  email               text NOT NULL,
  password_hash       text,                           -- argon2id；null = 待设置密码
  display_name        text,
  email_verified      boolean NOT NULL DEFAULT false,
  status              text NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'disabled')),
  must_reset_password boolean NOT NULL DEFAULT false, -- Firebase 老用户迁移标记
  last_login_at       timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS auth_tokens (
  id         text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id    text NOT NULL,
  kind       text NOT NULL CHECK (kind IN ('email_verify', 'password_reset')),
  token_hash text NOT NULL,                           -- 只存 sha256(token)
  expires_at timestamptz NOT NULL,
  used_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- ─── 用户档案 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id             text PRIMARY KEY,
  name           text NOT NULL DEFAULT '',
  email          text,
  "current_role" text,
  target_role    text,
  experience     text,
  skills         text[] NOT NULL DEFAULT '{}',
  interests      text,
  user_type      text,
  personality    text,
  coach_note     text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now(),
  extra          jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 简历 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_resumes (
  id             text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id        text NOT NULL,
  file_name      text NOT NULL,
  file_path      text NOT NULL,                       -- OSS object key
  file_type      text,
  file_size      bigint,
  extracted_text text,
  source         text NOT NULL DEFAULT 'upload',      -- diagnosis | upload
  is_primary     boolean NOT NULL DEFAULT false,
  created_at     timestamptz NOT NULL DEFAULT now(),
  extra          jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 诊断报告 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS diagnostic_reports (
  id                    text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id               text NOT NULL,
  match_score           integer CHECK (match_score BETWEEN 0 AND 100),
  current_assessment    text,
  feasibility           text CHECK (feasibility IN ('high', 'medium', 'low')),
  skills_to_acquire     jsonb,
  action_plan           jsonb,
  possible_paths        jsonb,
  ai_replace_risk       integer CHECK (ai_replace_risk BETWEEN 0 AND 100),
  ai_replace_analysis   text,
  risk_points           jsonb,
  resume_summary        text,
  choice_analysis       text,
  recommended_companies jsonb,
  created_at            timestamptz NOT NULL DEFAULT now(),
  extra                 jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 角色模拟 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS simulator_sessions (
  id              text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id         text NOT NULL,
  "role"          text NOT NULL,
  session_type    text,                               -- day-in-life | interview
  score           integer,
  personality_tag text,
  decisions       jsonb,
  transcript      jsonb,
  created_at      timestamptz NOT NULL DEFAULT now(),
  completed_at    timestamptz,
  extra           jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 行动任务 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS tasks (
  id          text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id     text NOT NULL,
  report_id   text,
  title       text NOT NULL,
  category    text DEFAULT 'task',                    -- skill | task | milestone
  priority    text DEFAULT 'medium',                  -- high | medium | low
  completed   boolean NOT NULL DEFAULT false,
  due_date    date,
  order_index integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  extra       jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 教练资料 ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_profiles (
  id                  text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id             text NOT NULL,
  display_name        text NOT NULL,
  avatar_url          text,
  headline            text,
  bio                 text,
  companies           text[] NOT NULL DEFAULT '{}',
  schools             text[] NOT NULL DEFAULT '{}',
  topic_tags          text[] NOT NULL DEFAULT '{}',
  price_single        numeric(10, 2),
  price_package_5     numeric(10, 2),
  meeting_link        text,
  education_docs      jsonb NOT NULL DEFAULT '[]'::jsonb,
  work_docs           jsonb NOT NULL DEFAULT '[]'::jsonb,
  other_docs          jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_docs   jsonb NOT NULL DEFAULT '[]'::jsonb,
  verification_status text NOT NULL DEFAULT 'none'
                        CHECK (verification_status IN ('none', 'pending', 'approved', 'rejected')),
  verification_reason text,
  verified            boolean NOT NULL DEFAULT false,
  reviewed_at         timestamptz,
  sessions_count      integer NOT NULL DEFAULT 0,
  tier                text NOT NULL DEFAULT 'peer'
                        CHECK (tier IN ('peer', 'mentor')),
  interview_status    text NOT NULL DEFAULT 'none'
                        CHECK (interview_status IN ('none', 'pending', 'passed', 'failed')),
  -- 混合检索：BM25 文本 + 向量（1024 维，对应 text-embedding-v4）
  search_text         text,
  embedding           jsonb,
  embedding_dim       smallint NOT NULL DEFAULT 1024,
  embedding_updated_at timestamptz,
  rating_avg          numeric(3, 2),
  review_count        integer NOT NULL DEFAULT 0,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  extra               jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 教练可约时段 ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_slots (
  id           text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  coach_id     text NOT NULL,
  start_at     timestamptz NOT NULL,
  duration_min integer NOT NULL DEFAULT 60,
  status       text NOT NULL DEFAULT 'available'
                 CHECK (status IN ('available', 'booked', 'blocked')),
  created_at   timestamptz NOT NULL DEFAULT now(),
  extra        jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 订单（试点期不下线表结构，仅不再接 Stripe） ─────────────────
CREATE TABLE IF NOT EXISTS coach_orders (
  id                   text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  coachee_id           text NOT NULL,
  coach_id             text NOT NULL,
  kind                 text NOT NULL DEFAULT 'single'
                         CHECK (kind IN ('single', 'package_5')),
  amount               numeric(10, 2) NOT NULL DEFAULT 0,
  remaining_redemptions integer NOT NULL DEFAULT 1,
  status               text NOT NULL DEFAULT 'held'
                         CHECK (status IN ('held', 'confirmed', 'completed', 'released', 'refunded')),
  cancel_reason        text,
  payment_status       text NOT NULL DEFAULT 'pending'
                         CHECK (payment_status IN ('pending', 'paid', 'refunded')),
  amount_cents         integer,
  currency             text NOT NULL DEFAULT 'cny',
  payment_ref          text,                          -- 微信/支付宝 交易号（替代 stripe_*）
  paid_at              timestamptz,
  lock_expires_at      timestamptz,
  created_at           timestamptz NOT NULL DEFAULT now(),
  confirmed_at         timestamptz,
  completed_at         timestamptz,
  released_at          timestamptz,
  refunded_at          timestamptz,
  extra                jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 预约 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_bookings (
  id               text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  order_id         text,
  coachee_id       text NOT NULL,
  coach_id         text NOT NULL,
  slot_id          text,
  status           text NOT NULL DEFAULT 'held'
                     CHECK (status IN ('held', 'confirmed', 'completed', 'released', 'refunded')),
  meeting_snapshot text,
  created_at       timestamptz NOT NULL DEFAULT now(),
  confirmed_at     timestamptz,
  completed_at     timestamptz,
  released_at      timestamptz,
  refunded_at      timestamptz,
  extra            jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 评价 ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coach_reviews (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  booking_id    text NOT NULL,
  coach_id      text NOT NULL,
  reviewer_id   text NOT NULL,
  rating        smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment       text NOT NULL DEFAULT '',
  reviewer_name text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  extra         jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── Concierge 预约（试点期唯一成交链路：微信 + 人工拉群） ────────
CREATE TABLE IF NOT EXISTS concierge_bookings (
  id            text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  user_id       text NOT NULL,
  user_email    text,
  user_name     text,
  coach_id      text,
  question      text NOT NULL,
  expected_time text,
  contact       text NOT NULL,
  consent       boolean NOT NULL DEFAULT false,
  status        text NOT NULL DEFAULT 'pending_wechat'
                  CHECK (status IN ('pending_wechat', 'grouped', 'done', 'cancelled')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  extra         jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── AI 教练长期记忆（原 coach_threads 集合） ────────────────────
CREATE TABLE IF NOT EXISTS coach_threads (
  user_id    text PRIMARY KEY,
  messages   jsonb NOT NULL DEFAULT '[]'::jsonb,       -- [{role, content, at}]
  updated_at timestamptz NOT NULL DEFAULT now(),
  extra      jsonb NOT NULL DEFAULT '{}'::jsonb
);

-- ─── 限流（跨实例共享） ──────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rate_limits (
  key          text NOT NULL,
  window_start bigint NOT NULL,
  count        integer NOT NULL DEFAULT 0,
  expires_at   timestamptz,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (key, window_start)
);

-- ─── updated_at 自动维护 ────────────────────────────────────────
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_touch ON profiles;
CREATE TRIGGER trg_profiles_touch BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_coach_profiles_touch ON coach_profiles;
CREATE TRIGGER trg_coach_profiles_touch BEFORE UPDATE ON coach_profiles
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_coach_reviews_touch ON coach_reviews;
CREATE TRIGGER trg_coach_reviews_touch BEFORE UPDATE ON coach_reviews
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_concierge_touch ON concierge_bookings;
CREATE TRIGGER trg_concierge_touch BEFORE UPDATE ON concierge_bookings
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS trg_users_touch ON users;
CREATE TRIGGER trg_users_touch BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
