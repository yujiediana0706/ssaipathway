-- ============================================================
-- Pathway — 真人教练市场迁移
-- 执行方式：Supabase Dashboard → SQL Editor → 粘贴 → Run
-- 幂等：可重复执行
-- 说明：旧的 mock 表 coach_profiles / bookings / coach_conversations 将被删除重建
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------------------------
-- 0. 管理员判定（固定邮箱）
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(auth.email() = 'yujie_diana@outlook.com', false);
$$;

-- ------------------------------------------------------------
-- 1. 清理旧 mock 表（coach_conversations 无代码引用）
-- ------------------------------------------------------------
DROP TABLE IF EXISTS public.coach_conversations CASCADE;
DROP TABLE IF EXISTS public.bookings CASCADE;
DROP TABLE IF EXISTS public.coach_profiles CASCADE;

-- ------------------------------------------------------------
-- 2. coach_profiles — 教练主页
-- ------------------------------------------------------------
CREATE TABLE public.coach_profiles (
    id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id              uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name         text NOT NULL,
    avatar_url           text,
    headline             text,
    bio                  text,
    companies            text[] NOT NULL DEFAULT '{}',
    schools              text[] NOT NULL DEFAULT '{}',
    topic_tags           text[] NOT NULL DEFAULT '{}',
    price_single         numeric(10,2),
    price_package_5      numeric(10,2),
    meeting_link         text,
    education_docs       jsonb NOT NULL DEFAULT '[]',  -- [{path,name,uploaded_at}]
    work_docs            jsonb NOT NULL DEFAULT '[]',
    other_docs           jsonb NOT NULL DEFAULT '[]',
    verification_docs    jsonb NOT NULL DEFAULT '[]',
    verification_status  text NOT NULL DEFAULT 'none'
                           CHECK (verification_status IN ('none','pending','approved','rejected')),
    verification_reason  text,
    verified             boolean NOT NULL DEFAULT false,
    reviewed_at          timestamptz,
    sessions_count       integer NOT NULL DEFAULT 0,
    created_at           timestamptz NOT NULL DEFAULT now(),
    updated_at           timestamptz NOT NULL DEFAULT now(),
    -- 硬性材料：至少各 1 份；至少一种定价；非负
    CONSTRAINT docs_education_present CHECK (jsonb_array_length(education_docs) >= 1),
    CONSTRAINT docs_work_present      CHECK (jsonb_array_length(work_docs) >= 1),
    CONSTRAINT at_least_one_price     CHECK (price_single IS NOT NULL OR price_package_5 IS NOT NULL),
    CONSTRAINT prices_non_negative    CHECK (
        (price_single IS NULL OR price_single >= 0)
        AND (price_package_5 IS NULL OR price_package_5 >= 0)
    )
);

CREATE INDEX idx_coach_profiles_verified ON public.coach_profiles(verified);
CREATE INDEX idx_coach_profiles_tags     ON public.coach_profiles USING gin(topic_tags);
CREATE INDEX idx_coach_profiles_companies ON public.coach_profiles USING gin(companies);
CREATE INDEX idx_coach_profiles_schools    ON public.coach_profiles USING gin(schools);

-- ------------------------------------------------------------
-- 3. coach_slots — 可预约档期（每次会话 60 分钟）
-- ------------------------------------------------------------
CREATE TABLE public.coach_slots (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coach_id     uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    start_at     timestamptz NOT NULL,
    duration_min integer NOT NULL DEFAULT 60,
    status       text NOT NULL DEFAULT 'available'
                   CHECK (status IN ('available','booked','blocked')),
    created_at   timestamptz NOT NULL DEFAULT now(),
    UNIQUE (coach_id, start_at)
);

CREATE INDEX idx_slots_coach_time ON public.coach_slots(coach_id, start_at);
CREATE INDEX idx_slots_status ON public.coach_slots(status);

-- ------------------------------------------------------------
-- 4. coach_orders — 担保订单（购买行为；套餐=1 个订单含 5 次会话）
-- ------------------------------------------------------------
CREATE TABLE public.coach_orders (
    id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    coachee_id            uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coach_id              uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    kind                  text NOT NULL CHECK (kind IN ('single','package_5')),
    amount                numeric(10,2) NOT NULL CHECK (amount >= 0),
    remaining_redemptions integer NOT NULL DEFAULT 0,  -- 套餐首次之外还可约 4 次
    status                text NOT NULL DEFAULT 'held'
                            CHECK (status IN ('held','confirmed','completed','released','refunded')),
    cancel_reason         text,
    created_at            timestamptz NOT NULL DEFAULT now(),
    confirmed_at          timestamptz,
    completed_at          timestamptz,
    released_at           timestamptz,
    refunded_at           timestamptz
);

CREATE INDEX idx_orders_coachee ON public.coach_orders(coachee_id, created_at DESC);
CREATE INDEX idx_orders_coach   ON public.coach_orders(coach_id, created_at DESC);
CREATE INDEX idx_orders_status  ON public.coach_orders(status);

-- ------------------------------------------------------------
-- 5. coach_bookings — 具体会话预约（订单下的每次会话）
-- ------------------------------------------------------------
CREATE TABLE public.coach_bookings (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id         uuid NOT NULL REFERENCES public.coach_orders(id) ON DELETE CASCADE,
    coachee_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    coach_id         uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    slot_id          uuid NOT NULL REFERENCES public.coach_slots(id) ON DELETE RESTRICT,
    status           text NOT NULL DEFAULT 'held'
                       CHECK (status IN ('held','confirmed','completed','released','refunded')),
    meeting_snapshot text,  -- 确认时从教练主页复制的会议链接
    created_at       timestamptz NOT NULL DEFAULT now(),
    confirmed_at     timestamptz,
    completed_at     timestamptz,
    released_at      timestamptz,
    refunded_at      timestamptz
);

-- 同一档期只允许一个有效预约（held/confirmed/completed/released），防重复占用
CREATE UNIQUE INDEX uniq_active_booking_slot
    ON public.coach_bookings(slot_id)
    WHERE status IN ('held','confirmed','completed','released');

CREATE INDEX idx_bookings_coachee ON public.coach_bookings(coachee_id, created_at DESC);
CREATE INDEX idx_bookings_coach   ON public.coach_bookings(coach_id, created_at DESC);
CREATE INDEX idx_bookings_order   ON public.coach_bookings(order_id);
CREATE INDEX idx_bookings_status  ON public.coach_bookings(status);

-- ------------------------------------------------------------
-- 6. coach_reviews — 会话评价（每单一次）
-- ------------------------------------------------------------
CREATE TABLE public.coach_reviews (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id  uuid NOT NULL UNIQUE REFERENCES public.coach_bookings(id) ON DELETE CASCADE,
    coach_id    uuid NOT NULL REFERENCES public.coach_profiles(id) ON DELETE CASCADE,
    reviewer_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    rating      integer NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment     text NOT NULL CHECK (char_length(comment) >= 5),
    created_at  timestamptz NOT NULL DEFAULT now(),
    updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_reviews_coach ON public.coach_reviews(coach_id, created_at DESC);

-- ============================================================
-- RLS（纵深防御；API 侧使用 service_role 并在路由里做归属校验）
-- ============================================================
ALTER TABLE public.coach_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_slots    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_orders   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coach_reviews  ENABLE ROW LEVEL SECURITY;

-- coach_profiles：公开可读；本人可写；admin 全权
DROP POLICY IF EXISTS cp_public_read ON public.coach_profiles;
CREATE POLICY cp_public_read ON public.coach_profiles FOR SELECT USING (true);
DROP POLICY IF EXISTS cp_owner_write ON public.coach_profiles;
CREATE POLICY cp_owner_write ON public.coach_profiles FOR ALL
    USING (user_id = auth.uid() OR public.is_admin())
    WITH CHECK (user_id = auth.uid());

-- coach_slots：公开可读；仅所属教练可写
DROP POLICY IF EXISTS cs_public_read ON public.coach_slots;
CREATE POLICY cs_public_read ON public.coach_slots FOR SELECT USING (true);
DROP POLICY IF EXISTS cs_owner_write ON public.coach_slots;
CREATE POLICY cs_owner_write ON public.coach_slots FOR ALL
    USING (
        public.is_admin()
        OR EXISTS (SELECT 1 FROM public.coach_profiles cp
                   WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    )
    WITH CHECK (
        EXISTS (SELECT 1 FROM public.coach_profiles cp
                WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    );

-- coach_orders：买卖双方可读；买家可建；双方/admin 可改
DROP POLICY IF EXISTS co_party_read ON public.coach_orders;
CREATE POLICY co_party_read ON public.coach_orders FOR SELECT
    USING (
        public.is_admin()
        OR coachee_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.coach_profiles cp
                   WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    );
DROP POLICY IF EXISTS co_buyer_insert ON public.coach_orders;
CREATE POLICY co_buyer_insert ON public.coach_orders FOR INSERT
    WITH CHECK (coachee_id = auth.uid());
DROP POLICY IF EXISTS co_party_update ON public.coach_orders;
CREATE POLICY co_party_update ON public.coach_orders FOR UPDATE
    USING (
        public.is_admin()
        OR coachee_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.coach_profiles cp
                   WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    );

-- coach_bookings：同订单归属规则
DROP POLICY IF EXISTS cb_party_read ON public.coach_bookings;
CREATE POLICY cb_party_read ON public.coach_bookings FOR SELECT
    USING (
        public.is_admin()
        OR coachee_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.coach_profiles cp
                   WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    );
DROP POLICY IF EXISTS cb_buyer_insert ON public.coach_bookings;
CREATE POLICY cb_buyer_insert ON public.coach_bookings FOR INSERT
    WITH CHECK (coachee_id = auth.uid());
DROP POLICY IF EXISTS cb_party_update ON public.coach_bookings;
CREATE POLICY cb_party_update ON public.coach_bookings FOR UPDATE
    USING (
        public.is_admin()
        OR coachee_id = auth.uid()
        OR EXISTS (SELECT 1 FROM public.coach_profiles cp
                   WHERE cp.id = coach_id AND cp.user_id = auth.uid())
    );

-- coach_reviews：公开可读；作者可写
DROP POLICY IF EXISTS cr_public_read ON public.coach_reviews;
CREATE POLICY cr_public_read ON public.coach_reviews FOR SELECT USING (true);
DROP POLICY IF EXISTS cr_author_insert ON public.coach_reviews;
CREATE POLICY cr_author_insert ON public.coach_reviews FOR INSERT
    WITH CHECK (reviewer_id = auth.uid());
DROP POLICY IF EXISTS cr_author_update ON public.coach_reviews;
CREATE POLICY cr_author_update ON public.coach_reviews FOR UPDATE
    USING (reviewer_id = auth.uid());

-- ============================================================
-- Storage buckets
--   coach-docs   私有：学历/工作/资质材料
--   coach-avatars 公开：头像
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-docs', 'coach-docs', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('coach-avatars', 'coach-avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- coach-docs：本人（路径第一级目录=uid）或 admin 可读；仅本人可写
DROP POLICY IF EXISTS "coach-docs read" ON storage.objects;
CREATE POLICY "coach-docs read" ON storage.objects FOR SELECT
    USING (
        bucket_id = 'coach-docs'
        AND (
            (storage.foldername(name))[1] = auth.uid()::text
            OR public.is_admin()
        )
    );
DROP POLICY IF EXISTS "coach-docs insert" ON storage.objects;
CREATE POLICY "coach-docs insert" ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'coach-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
DROP POLICY IF EXISTS "coach-docs update" ON storage.objects;
CREATE POLICY "coach-docs update" ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'coach-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
DROP POLICY IF EXISTS "coach-docs delete" ON storage.objects;
CREATE POLICY "coach-docs delete" ON storage.objects FOR DELETE
    USING (
        bucket_id = 'coach-docs'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- coach-avatars：公开读；仅本人可写
DROP POLICY IF EXISTS "coach-avatars read" ON storage.objects;
CREATE POLICY "coach-avatars read" ON storage.objects FOR SELECT
    USING (bucket_id = 'coach-avatars');
DROP POLICY IF EXISTS "coach-avatars insert" ON storage.objects;
CREATE POLICY "coach-avatars insert" ON storage.objects FOR INSERT
    WITH CHECK (
        bucket_id = 'coach-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
DROP POLICY IF EXISTS "coach-avatars update" ON storage.objects;
CREATE POLICY "coach-avatars update" ON storage.objects FOR UPDATE
    USING (
        bucket_id = 'coach-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );
DROP POLICY IF EXISTS "coach-avatars delete" ON storage.objects;
CREATE POLICY "coach-avatars delete" ON storage.objects FOR DELETE
    USING (
        bucket_id = 'coach-avatars'
        AND (storage.foldername(name))[1] = auth.uid()::text
    );

-- ============================================================
-- 完成。验证：
--   SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'coach_%';
--   期望：coach_profiles / coach_slots / coach_orders / coach_bookings / coach_reviews
-- ============================================================
