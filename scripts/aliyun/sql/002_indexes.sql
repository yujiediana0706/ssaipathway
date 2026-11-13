-- ============================================================
-- Pathway · 索引与约束（在 001_schema.sql 之后执行）
-- 索引按现有 Firestore 查询模式一一对应，见文件末尾对照表
-- ============================================================

-- ─── 唯一性 ─────────────────────────────────────────────────────
CREATE UNIQUE INDEX IF NOT EXISTS users_email_unique
  ON users (lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS profiles_email_unique
  ON profiles (lower(email))
  WHERE email IS NOT NULL AND email <> '';

CREATE UNIQUE INDEX IF NOT EXISTS auth_tokens_hash_unique
  ON auth_tokens (token_hash);

-- 每个用户只能有一份主简历
CREATE UNIQUE INDEX IF NOT EXISTS user_resumes_one_primary
  ON user_resumes (user_id)
  WHERE is_primary;

CREATE UNIQUE INDEX IF NOT EXISTS coach_profiles_user_unique
  ON coach_profiles (user_id);

-- 同一教练同一开始时间不重复建时段
CREATE UNIQUE INDEX IF NOT EXISTS coach_slots_unique
  ON coach_slots (coach_id, start_at);

-- 一次预约只能评价一次
CREATE UNIQUE INDEX IF NOT EXISTS coach_reviews_booking_unique
  ON coach_reviews (booking_id);

-- ─── 查询索引 ───────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS profiles_name_created_idx
  ON profiles (name, created_at DESC);

CREATE INDEX IF NOT EXISTS user_resumes_user_idx
  ON user_resumes (user_id, is_primary DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS diagnostic_reports_user_created_idx
  ON diagnostic_reports (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS simulator_sessions_user_created_idx
  ON simulator_sessions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS tasks_user_order_idx
  ON tasks (user_id, order_index ASC);

CREATE INDEX IF NOT EXISTS tasks_report_idx
  ON tasks (report_id) WHERE report_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS coach_profiles_verified_created_idx
  ON coach_profiles (verified, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_profiles_status_idx
  ON coach_profiles (verification_status, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_profiles_tier_idx
  ON coach_profiles (tier);

CREATE INDEX IF NOT EXISTS coach_slots_coach_start_idx
  ON coach_slots (coach_id, start_at);

CREATE INDEX IF NOT EXISTS coach_orders_coachee_created_idx
  ON coach_orders (coachee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_orders_coach_status_idx
  ON coach_orders (coach_id, status);

CREATE INDEX IF NOT EXISTS coach_orders_payment_idx
  ON coach_orders (payment_status, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_bookings_coachee_created_idx
  ON coach_bookings (coachee_id, created_at DESC);

CREATE INDEX IF NOT EXISTS coach_bookings_coach_status_idx
  ON coach_bookings (coach_id, status);

CREATE INDEX IF NOT EXISTS coach_reviews_coach_created_idx
  ON coach_reviews (coach_id, created_at DESC);

CREATE INDEX IF NOT EXISTS concierge_bookings_status_created_idx
  ON concierge_bookings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS concierge_bookings_user_idx
  ON concierge_bookings (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS auth_tokens_user_kind_idx
  ON auth_tokens (user_id, kind);

CREATE INDEX IF NOT EXISTS auth_tokens_expires_idx
  ON auth_tokens (expires_at);

CREATE INDEX IF NOT EXISTS rate_limits_expires_idx
  ON rate_limits (expires_at);

-- ─── 可选：pg_trgm（BM25 模糊匹配用） ────────────────────────────
-- 若实例支持该扩展，取消注释后执行：
-- CREATE EXTENSION IF NOT EXISTS pg_trgm;
-- CREATE INDEX IF NOT EXISTS coach_profiles_search_trgm_idx
--   ON coach_profiles USING gin (search_text gin_trgm_ops);

-- ─── 可选：pgvector（比 jsonb 存储向量更省空间、可走 ANN 索引） ──
-- 阿里云 RDS PostgreSQL 14+ 支持。启用后：
--   ALTER TABLE coach_profiles ADD COLUMN embedding_vec vector(1024);
--   UPDATE coach_profiles SET embedding_vec = embedding::text::vector WHERE embedding IS NOT NULL;
--   CREATE INDEX coach_profiles_embedding_ann ON coach_profiles
--     USING hnsw (embedding_vec vector_cosine_ops);
--   -- 然后删除 embedding jsonb 列，改写 data layer 读写。

-- ─── 可选：数据校验通过后再启用外键 ─────────────────────────────
-- 迁移阶段不建外键，避免 Firestore 历史脏数据导致导入中断。
-- 校验 SQL（应为 0 行）：
--   SELECT b.id FROM coach_bookings b
--     LEFT JOIN coach_orders o ON o.id = b.order_id
--     WHERE b.order_id IS NOT NULL AND o.id IS NULL;
--   SELECT r.id FROM coach_reviews r
--     LEFT JOIN coach_bookings b ON b.id = r.booking_id
--     WHERE b.id IS NULL;
-- 确认无误后再执行：
-- ALTER TABLE coach_bookings
--   ADD CONSTRAINT coach_bookings_order_fk
--   FOREIGN KEY (order_id) REFERENCES coach_orders (id) ON DELETE CASCADE;
-- ALTER TABLE coach_reviews
--   ADD CONSTRAINT coach_reviews_booking_fk
--   FOREIGN KEY (booking_id) REFERENCES coach_bookings (id) ON DELETE CASCADE;

-- ─── Firestore 查询 → SQL 索引对照 ───────────────────────────────
-- profiles.where(name ==).orderBy(created_at desc)  → profiles_name_created_idx
-- diagnostic_reports.where(user_id ==).orderBy(created_at desc) → diagnostic_reports_user_created_idx
-- simulator_sessions.where(user_id ==).orderBy(created_at desc) → simulator_sessions_user_created_idx
-- tasks.where(user_id ==).orderBy(order_index asc) → tasks_user_order_idx
-- user_resumes.where(user_id ==).orderBy(is_primary desc, created_at desc) → user_resumes_user_idx
-- coach_profiles.where(user_id ==) → coach_profiles_user_unique
-- coach_slots.where(coach_id ==).orderBy(start_at) → coach_slots_coach_start_idx
-- coach_orders.where(coachee_id ==).orderBy(created_at desc) → coach_orders_coachee_created_idx
-- coach_bookings.where(coach_id ==).where(status ==) → coach_bookings_coach_status_idx
-- coach_reviews.where(coach_id ==) → coach_reviews_coach_created_idx
-- concierge_bookings.where(status ==) → concierge_bookings_status_created_idx
