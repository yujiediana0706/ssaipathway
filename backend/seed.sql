-- ============================================================
-- Pathway — 教练 Mock 数据初始化
-- 在 Schema 执行完毕后运行
-- ============================================================

INSERT INTO coach_profiles (id, name, avatar_url, headline, industry, years_experience, rate_per_hour, rating, sessions_count, available_slots, coach_type, bio) VALUES
(
    gen_random_uuid(),
    '陈思远',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=chen',
    '资深产品经理 | 前字节跳动',
    'AI产品',
    6,
    299,
    4.9,
    128,
    '[{"day": "周一", "time": "14:00"}, {"day": "周三", "time": "10:00"}, {"day": "周五", "time": "16:00"}]'::jsonb,
    'human',
    '专注 AI 产品设计与用户增长，熟悉从 0 到 1 的产品搭建流程'
),
(
    gen_random_uuid(),
    '林晓晴',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=lin',
    '数据科学家 | 前美团',
    '数据科学',
    4,
    249,
    4.8,
    86,
    '[{"day": "周二", "time": "10:00"}, {"day": "周四", "time": "14:00"}]'::jsonb,
    'human',
    '擅长机器学习建模与商业数据分析，关注数据驱动决策'
),
(
    gen_random_uuid(),
    '王浩宇',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=wang',
    '品牌总监 | 前宝洁',
    '品牌/市场',
    8,
    399,
    5.0,
    215,
    '[{"day": "周一", "time": "16:00"}, {"day": "周三", "time": "14:00"}, {"day": "周六", "time": "10:00"}]'::jsonb,
    'human',
    '资深品牌策略专家，专注品牌建设与市场营销创新'
),
(
    gen_random_uuid(),
    '赵雨萌',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=zhao',
    'UX 设计师 | 前腾讯',
    '设计/UX',
    5,
    279,
    4.7,
    94,
    '[{"day": "周二", "time": "14:00"}, {"day": "周四", "time": "10:00"}]'::jsonb,
    'human',
    '用户体验设计专家，关注人性化交互设计与可用性研究'
),
(
    gen_random_uuid(),
    '刘思成',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=liu',
    '创业者 | 连续3次创业',
    '创业',
    10,
    499,
    4.9,
    67,
    '[{"day": "周五", "time": "14:00"}, {"day": "周日", "time": "10:00"}]'::jsonb,
    'human',
    '连续创业者，专注商业模式创新与创业团队搭建'
),
(
    gen_random_uuid(),
    '张雅婷',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=zhang',
    '金融分析师 | 前高盛',
    '金融/投资',
    7,
    379,
    4.8,
    112,
    '[{"day": "周一", "time": "10:00"}, {"day": "周三", "time": "16:00"}]'::jsonb,
    'human',
    '资深金融分析师，擅长投资分析与财务建模'
);

-- AI Coach (内置)
INSERT INTO coach_profiles (id, name, avatar_url, headline, industry, years_experience, rate_per_hour, rating, sessions_count, available_slots, coach_type, bio) VALUES
(
    gen_random_uuid(),
    'AI 小 Path',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=pathway',
    'AI 职业转型陪跑教练',
    '职业转型',
    99,
    0,
    4.8,
    9999,
    '[{"day": "每天", "time": "全天"}]'::jsonb,
    'ai',
    'Pathway 专属 AI 教练，随时为你提供职业转型建议与行动指导'
);
