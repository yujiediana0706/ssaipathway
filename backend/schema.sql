-- ============================================================
-- Pathway — 完整 Supabase Schema
-- 7 tables: profiles, diagnostic_reports, simulator_sessions,
--           coach_profiles, bookings, tasks, coach_conversations
-- ============================================================

-- 启用 UUID 扩展
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. profiles — 用户基本档案
-- ============================================================
CREATE TABLE profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    "current_role" text,
    "target_role" text,
    experience text,
    skills text[] DEFAULT '{}',
    interests text,
    "user_type" text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- 2. diagnostic_reports — AI 诊断报告
-- ============================================================
CREATE TABLE diagnostic_reports (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    match_score integer DEFAULT 0,
    current_assessment text,
    feasibility text,
    skills_to_acquire jsonb DEFAULT '[]',
    action_plan jsonb DEFAULT '{}',
    possible_paths jsonb DEFAULT '[]',
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 3. simulator_sessions — 模拟岗位会话
-- ============================================================
CREATE TABLE simulator_sessions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    "role" text NOT NULL,
    session_type text,
    score integer DEFAULT 0,
    personality_tag text,
    decisions jsonb DEFAULT '{}',
    transcript jsonb DEFAULT '[]',
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- ============================================================
-- 4. coach_profiles — AI/真人教练档案
-- ============================================================
CREATE TABLE coach_profiles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name text NOT NULL,
    avatar_url text,
    headline text,
    industry text,
    years_experience integer DEFAULT 0,
    rate_per_hour integer DEFAULT 0,
    rating numeric(2,1) DEFAULT 0.0,
    sessions_count integer DEFAULT 0,
    available_slots jsonb DEFAULT '[]',
    coach_type text DEFAULT 'human',
    bio text,
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 5. bookings — 预约记录
-- ============================================================
CREATE TABLE bookings (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id uuid NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
    slot_date date NOT NULL,
    slot_time text NOT NULL,
    status text DEFAULT 'pending',
    notes text,
    created_at timestamptz DEFAULT now(),
    completed_at timestamptz
);

-- ============================================================
-- 6. tasks — 学习任务清单
-- ============================================================
CREATE TABLE tasks (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    report_id uuid REFERENCES diagnostic_reports(id) ON DELETE SET NULL,
    title text NOT NULL,
    category text,
    priority text DEFAULT 'medium',
    completed boolean DEFAULT false,
    due_date date,
    order_index integer DEFAULT 0,
    created_at timestamptz DEFAULT now()
);

-- ============================================================
-- 7. coach_conversations — AI Coach 对话记录
-- ============================================================
CREATE TABLE coach_conversations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    coach_id uuid NOT NULL REFERENCES coach_profiles(id) ON DELETE CASCADE,
    messages jsonb DEFAULT '[]',
    summary text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- ============================================================
-- RLS 策略：用户只能访问自己的数据
-- ============================================================

-- profiles：用户只能查看和更新自己的档案
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
    ON profiles FOR SELECT
    USING (id = auth.uid());

CREATE POLICY "Users can insert own profile"
    ON profiles FOR INSERT
    WITH CHECK (id = auth.uid());

CREATE POLICY "Users can update own profile"
    ON profiles FOR UPDATE
    USING (id = auth.uid());

-- diagnostic_reports：用户只能查看自己的诊断报告
ALTER TABLE diagnostic_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own diagnostic reports"
    ON diagnostic_reports FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own diagnostic reports"
    ON diagnostic_reports FOR INSERT
    WITH CHECK (user_id = auth.uid());

-- simulator_sessions：用户只能查看自己的模拟会话
ALTER TABLE simulator_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own simulator sessions"
    ON simulator_sessions FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own simulator sessions"
    ON simulator_sessions FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own simulator sessions"
    ON simulator_sessions FOR UPDATE
    USING (user_id = auth.uid());

-- coach_profiles：所有人可读取，仅管理员可写入
ALTER TABLE coach_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coach profiles are publicly readable"
    ON coach_profiles FOR SELECT
    USING (true);

CREATE POLICY "Only service role can modify coach profiles"
    ON coach_profiles FOR ALL
    USING (auth.role() = 'service_role');

-- bookings：用户只能查看自己的预约
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own bookings"
    ON bookings FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can create own bookings"
    ON bookings FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own bookings"
    ON bookings FOR UPDATE
    USING (user_id = auth.uid());

-- tasks：用户只能管理自己的任务
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own tasks"
    ON tasks FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own tasks"
    ON tasks FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own tasks"
    ON tasks FOR UPDATE
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own tasks"
    ON tasks FOR DELETE
    USING (user_id = auth.uid());

-- coach_conversations：用户只能查看自己的对话
ALTER TABLE coach_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own conversations"
    ON coach_conversations FOR SELECT
    USING (user_id = auth.uid());

CREATE POLICY "Users can insert own conversations"
    ON coach_conversations FOR INSERT
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own conversations"
    ON coach_conversations FOR UPDATE
    USING (user_id = auth.uid());

-- ============================================================
-- 索引
-- ============================================================
CREATE INDEX idx_reports_user ON diagnostic_reports(user_id);
CREATE INDEX idx_sessions_user ON simulator_sessions(user_id);
CREATE INDEX idx_sessions_role ON simulator_sessions("role");
CREATE INDEX idx_bookings_user ON bookings(user_id);
CREATE INDEX idx_bookings_coach ON bookings(coach_id);
CREATE INDEX idx_bookings_status ON bookings(status);
CREATE INDEX idx_tasks_user ON tasks(user_id);
CREATE INDEX idx_tasks_completed ON tasks(completed);
CREATE INDEX idx_tasks_report ON tasks(report_id);
CREATE INDEX idx_coach_conv_user ON coach_conversations(user_id);
CREATE INDEX idx_coach_conv_coach ON coach_conversations(coach_id);
