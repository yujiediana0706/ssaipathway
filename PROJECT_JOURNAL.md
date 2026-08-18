# Pathway 项目开发日志

> 记录项目开发过程中的关键决策、技术选型和重要工作。

---

## 📅 2026-08-18：项目初始化

### 完成工作

1. **创建 GitHub 仓库**
   - 仓库地址：`https://github.com/yujiediana0706/ssaipathway.git`
   - 配置 SSH 认证
   - 创建 `frontend/` 和 `backend/` 目录结构

2. **搭建前端基础架构**
   - Next.js 16 (App Router) + TypeScript
   - Tailwind CSS 4 样式框架
   - 基础页面路由：首页、登录、onboarding

3. **设计数据库结构**
   - 7 张核心表：`profiles`, `diagnostic_reports`, `simulator_sessions`, `coach_profiles`, `bookings`, `tasks`, `coach_conversations`
   - RLS 安全策略 + 索引优化
   - 文档：`backend/schema.sql`

---

## 📅 2026-08-18：核心功能开发

### 完成工作

1. **AI 转型探索功能**
   - `/explore` 页面：多轮对话收集用户信息
   - 集成 GLM API（智谱 AI）生成转型诊断报告
   - 支持语音输入（Web Speech API）

2. **AI 诊断报告**
   - `/report` 页面：展示匹配度、技能差距、行动计划
   - 结构化数据存储（JSONB 字段）

3. **岗位模拟器**
   - `/simulator` 页面：面试模式 + 真人日体验
   - 角色选择 + 对话动画效果

4. **Coach 双轨系统**
   - `/coach` 页面：AI Coach + 真人教练预约
   - 教练数据 Mock（7 位教练）

5. **个人工作台**
   - `/dashboard` 页面：进度追踪 + 任务管理
   - 数据自动从 AI 报告同步

---

## 📅 2026-08-18：UI/UX 优化

### 关键决策

1. **主题配色方案**
   - 主色调：深藏青 `#0f3460`
   - 辅助色：青蓝色 `#06b6d4`
   - 风格：科技感、现代、专业
   - 替换了原来的黑色主题

2. **页面流程调整**
   - 首页：极简设计，单 CTA "开始探索你的转型之旅"
   - 登录页：姓名输入即可（适合 MVP）
   - Onboarding：4 步信息收集

3. **Dashboard 数据修复**
   - 问题：待掌握技能显示的是用户自评技能，而非 AI 推荐技能
   - 修复：数据源从 `user.skills` 改为 `report.skillsToAcquire`
   - 新增 `reportStore.ts` 持久化报告数据

---

## 📅 2026-08-18：Supabase 集成

### 完成工作

1. **Supabase 项目搭建**
   - 创建项目：`hfowtvhgrvraqpgfwjpl.supabase.co`
   - 执行建表语句（7 张表 + RLS + 索引）
   - 导入教练 Mock 数据

2. **前端 Supabase 集成**
   - 创建 `lib/supabase.ts`：Supabase 客户端
   - 创建 `lib/db.ts`：数据访问层（懒加载，避免启动错误）
   - 实现 localStorage + Supabase 双层同步

3. **API Routes**
   - `/api/db/profile`：用户档案 CRUD
   - `/api/db/report`：报告 CRUD
   - `/api/db/tasks`：任务 CRUD
   - `/api/db/coach`：教练 + 预约 CRUD

4. **环境变量配置**
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `NEXT_PUBLIC_GLM_API_KEY`

---

## 📅 2026-08-19：部署与协作

### 完成工作

1. **Vercel 部署**
   - 连接 GitHub 仓库
   - 配置 Root Directory 为 `frontend`
   - 添加 4 个环境变量
   - 解决 Node.js 版本兼容性问题

2. **发现的问题**
   - 国内网络无法直接访问 Vercel（公司/学校网络限制）
   - 解决方案：本地开发 + git pull 同步

3. **团队协作文档**
   - 更新 README.md：完整的组员上手指南
   - 包含本地开发和 Vercel 部署两种方式
   - 添加常见问题排查

---

## 🏗️ 架构设计

### 数据流向

```
用户操作 → localStorage（即时响应）
         ↕ 双向同步
      API Routes（service_role key）
         ↓
      Supabase PostgreSQL（持久化存储）
```

### 安全策略

- RLS（Row Level Security）：用户只能访问自己的数据
- `service_role` key 仅在服务端使用
- JSONB 字段存储 AI 生成的结构化数据

### 技术选型理由

| 技术 | 选择理由 |
|------|----------|
| Next.js App Router | 现代 React 框架，SSR + API Routes 一体化 |
| Supabase | 开源 BaaS，PostgreSQL + Auth + RLS，免费额度充足 |
| GLM API | 智谱 AI，中文优化好，性价比高 |
| Tailwind CSS | 原子化 CSS，快速实现设计系统 |

---

## 📝 待办事项

- [ ] 解决国内 Vercel 访问问题（购买域名 + CDN 加速）
- [ ] 添加更多 AI 功能（对话摘要、情绪分析）
- [ ] 实现真人教练预约流程
- [ ] 添加用户认证系统（Supabase Auth）
- [ ] 优化移动端体验
- [ ] 添加数据统计分析 Dashboard

---

## 🔗 相关资源

- [Supabase Dashboard](https://supabase.com/dashboard/project/hfowtvhgrvraqpgfwjpl)
- [Vercel Dashboard](https://vercel.com/dashboard)
- [GLM API 文档](https://open.bigmodel.cn/dev/api)
- [Next.js 文档](https://nextjs.org/docs)
