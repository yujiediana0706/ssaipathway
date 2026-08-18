# Pathway — AI Career Transformation Companion

<p align="center">
  <strong>SSAI 2026 Hackathon Team Pathway</strong>
</p>

<p align="center">
  AI 驱动的职业转型平台：通过 AI 诊断、岗位模拟和教练陪跑，帮助用户低成本完成职业探索与转型。
</p>

---

## ✨ 产品功能

| 功能 | 说明 |
|------|------|
| 🤖 **AI 转型诊断** | 多轮对话收集用户信息，生成结构化转型诊断报告 |
| 🎭 **岗位模拟器** | 沉浸式体验目标岗位真实工作日常，低成本试错 |
| 👥 **Coach 双轨陪伴** | AI Coach 长期陪跑 + 真人教练预约平台 |
| 📊 **个人工作台** | 追踪转型进度、管理学习任务、查看诊断报告 |
| 🎙️ **语音输入** | 支持语音输入所有对话界面，提升体验 |

---

## 🏗️ 技术栈

| 层次 | 技术 | 版本 |
|------|------|------|
| 前端框架 | Next.js | 16.x (App Router) |
| 语言 | TypeScript | 5.x |
| 样式 | Tailwind CSS | 4.x |
| 后端服务 | Supabase (PostgreSQL + Auth) | — |
| AI 引擎 | 智谱 AI (GLM API) | — |
| 运行时 | Node.js | 22+ |
| 部署平台 | Vercel | — |

---

## 📁 项目结构

```
ssaipathway/
├── frontend/                    # Next.js 前端应用
│   ├── src/
│   │   ├── app/                  # App Router 页面
│   │   │   ├── layout.tsx        # 根布局
│   │   │   ├── page.tsx          # 首页
│   │   │   ├── onboarding/       # 新用户注册流程
│   │   │   ├── login/            # 登录页面
│   │   │   ├── explore/          # AI 探索对话
│   │   │   ├── report/           # 诊断报告
│   │   │   ├── simulator/        # 岗位模拟器
│   │   │   ├── coach/            # AI Coach + 真人预约
│   │   │   ├── dashboard/       # 个人工作台
│   │   │   └── api/              # API Routes
│   │   │       ├── chat/         # GLM 对话接口
│   │   │       ├── report/       # GLM 报告接口
│   │   │       └── db/           # Supabase 数据接口
│   │   │           ├── profile/  # 用户档案 CRUD
│   │   │           ├── report/   # 报告 CRUD
│   │   │           ├── tasks/    # 任务 CRUD
│   │   │           └── coach/    # 教练 + 预约 CRUD
│   │   ├── components/           # 共享组件
│   │   │   ├── NavBar.tsx        # 顶部导航
│   │   │   └── VoiceButton.tsx   # 语音输入按钮
│   │   ├── hooks/                # 自定义 Hooks
│   │   │   └── useVoiceInput.ts  # 语音输入 Hook
│   │   ├── lib/                  # 工具库
│   │   │   ├── glm.ts            # GLM API 客户端
│   │   │   ├── supabase.ts       # Supabase 客户端
│   │   │   ├── db.ts             # 数据访问层（懒加载）
│   │   │   ├── types.ts          # TypeScript 类型定义
│   │   │   ├── mockData.ts       # Mock 数据 + 教练列表
│   │   │   ├── userStore.ts      # 用户状态管理
│   │   │   └── reportStore.ts    # 报告状态管理
│   │   └── globals.css           # 全局样式 + 主题变量
│   ├── .env.local                # 环境变量（需自行创建）
│   ├── next.config.ts
│   ├── tailwind.config.ts
│   └── package.json
├── backend/                     # Supabase 后端配置
│   ├── schema.sql               # 数据库建表语句
│   ├── seed.sql                 # 初始数据（教练 Mock）
│   └── README.md                # 后端文档
├── PROJECT_JOURNAL.md           # 项目开发日志
├── README.md                    # 本文档
└── LICENSE
```

---

## 🚀 组员快速上手指南

### 你想要：预览最新代码效果？

### 方式 A：本地开发（推荐 ✅）

这是最简单、最完整的方式。你可以在自己电脑上运行项目，每次代码更新都能立即预览。

#### 前置条件

| 工具 | 要求 | 检查命令 |
|------|------|----------|
| Node.js | **22 或更高版本** | `node --version` |
| npm | 最新版 | `npm --version` |
| Git | 任意版本 | `git --version` |

#### Step 1：克隆项目并切换到 main 分支

```bash
git clone https://github.com/yujiediana0706/ssaipathway.git
cd ssaipathway
git checkout main
git pull origin main
```

#### Step 2：安装依赖

```bash
cd frontend
npm install
```

#### Step 3：配置环境变量

在 `frontend/` 目录下创建 `.env.local` 文件，将以下内容填入（向项目负责人获取实际的 Key）：

```env
# Supabase 数据库配置
NEXT_PUBLIC_SUPABASE_URL=https://hfowtvhgrvraqpgfwjpl.supabase.com
NEXT_PUBLIC_SUPABASE_ANON_KEY=（从项目负责人处获取）
SUPABASE_SERVICE_ROLE_KEY=（从项目负责人处获取，绝对保密）

# GLM AI 配置
NEXT_PUBLIC_GLM_API_KEY=（从项目负责人处获取）
```

> ⚠️ **安全提示**：`SUPABASE_SERVICE_ROLE_KEY` 仅用于服务端，**请勿分享给他人**或提交到 Git。

#### Step 4：启动开发服务器

```bash
npm run dev
```

启动成功后，终端会显示：
```
- Local:        http://localhost:3000
```

打开浏览器访问 http://localhost:3000 即可预览。

#### Step 5：保持代码同步

当项目有更新时，在终端运行：
```bash
git pull origin main
```

然后开发服务器会自动热更新，刷新浏览器即可看到最新效果。

---

### 方式 B：Vercel 预览部署（可选，适合无法本地运行的情况）

如果你不想在本地配置环境，可以在 Vercel 上部署一个属于自己的预览版本。每次 main 分支有更新时，Vercel 会自动重新部署。

#### Step 1：注册 Vercel

1. 打开 [vercel.com](https://vercel.com)
2. 用 **GitHub 账号**登录

#### Step 2：导入项目

1. 点击右上角 **"Add New Project"**
2. 选择 `ssaipathway` 仓库
3. 点击 **"Import"**

#### Step 3：配置项目

在 Configure Project 页面：

| 设置项 | 填写内容 |
|--------|----------|
| **Root Directory** | `frontend`（⚠️ 重要！默认是根目录） |
| Framework | 自动识别为 Next.js，保持默认 |
| Build Command | 保持默认 `next build` |

#### Step 4：添加环境变量

在 Environment Variables 区域，逐个添加（从项目负责人处获取实际值）：

| 变量名 | 说明 |
|--------|------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase 项目 URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Anon Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Service Role Key |
| `NEXT_PUBLIC_GLM_API_KEY` | GLM AI API Key |

每个变量添加时，勾选 **Production** 环境。

#### Step 5：部署

1. 点击 **"Deploy"** 按钮
2. 等待 1-2 分钟
3. 部署完成后会得到一个 URL，类似 `https://ssaipathway-xxxx.vercel.app`

#### Step 6：自动更新

Vercel 与 GitHub 集成后，每次 `main` 分支有新的 commit，Vercel 会**自动触发重新部署**。你只需访问同一个 URL 即可看到最新版本。

---

## 🗄️ 数据库配置说明

本项目使用 Supabase 作为后端数据库。项目已配置好，组员**无需自行创建**。

### 数据库表结构（7 张表）

| 表名 | 用途 |
|------|------|
| `profiles` | 用户基本档案 |
| `diagnostic_reports` | AI 诊断报告 |
| `simulator_sessions` | AI 模拟面试会话 |
| `coach_profiles` | AI/真人教练档案（公开） |
| `bookings` | 用户预约教练记录 |
| `tasks` | 个性化学习任务清单 |
| `coach_conversations` | AI Coach 对话记录 |

### 数据安全

- 所有表启用 **RLS (Row Level Security)**，用户只能访问自己的数据
- `SUPABASE_SERVICE_ROLE_KEY` 严禁暴露到前端

---

## 📖 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 首页（极简风格，单 CTA） |
| `/login` | 登录页面 |
| `/onboarding` | 新用户注册（4 步信息收集） |
| `/explore` | AI 探索对话（多轮对话生成诊断） |
| `/report` | AI 诊断报告（匹配度 + 技能差距 + 行动计划） |
| `/simulator` | 岗位模拟器（面试模式 + 真人日体验） |
| `/coach` | Coach 双轨（AI Coach + 真人预约） |
| `/dashboard` | 个人工作台（进度追踪 + 任务管理） |

---

## 🔑 关键设计决策

### 1. 主题配色

- **主色调**：深藏青 `#0f3460`
- **辅助色**：青蓝色 `#06b6d4`
- **风格**：科技感、现代、专业

### 2. 数据同步策略

前端使用 **localStorage + Supabase 云端同步** 的双层架构：
- localStorage 提供即时响应（流畅体验）
- 关键操作自动同步到 Supabase（持久化存储）

### 3. AI 报告与 Dashboard 联动

Dashboard 的"待掌握技能"和"学习任务"**直接来自 AI 诊断报告**，确保用户看到的是 AI 推荐的转型方向。

### 4. 双轨 Coach 系统

- **AI Coach**：集成 AI API，24 小时可用
- **真人教练**：通过 `coach_profiles` 表管理，支持预约

### 5. 语音输入

所有对话界面支持 Web Speech API，通过 `VoiceButton` 组件和 `useVoiceInput` Hook 实现。

---

## 🛠️ 开发指南

### 添加新页面

1. 在 `src/app/` 下创建新目录和 `page.tsx`
2. 使用 Next.js App Router 规范
3. 复用 `components/` 中的组件

### 添加新 API

1. 在 `src/app/api/` 下创建路由文件夹
2. 参考现有 `route.ts` 格式
3. 数据操作通过 `lib/db.ts` 统一管理

### 添加新的数据库表

1. 在 `backend/schema.sql` 添加建表语句
2. 同时在 `lib/types.ts` 添加对应的 TypeScript 类型
3. 在 `lib/db.ts` 添加数据访问函数
4. 联系项目负责人在 Supabase 执行 schema 更新

### 提交代码

```bash
# 创建新分支
git checkout -b feature/your-feature-name

# 提交代码
git add .
git commit -m "feat: 描述你做的改动"

# 推送到远程
git push origin feature/your-feature-name

# 创建 Pull Request（在 GitHub 上）
```

---

## ⚠️ 常见问题

### Q: 启动报错 "Supabase URL not found"

检查 `.env.local` 是否正确创建并填入了 `NEXT_PUBLIC_SUPABASE_URL`。

### Q: 启动报错 "GLM API key not configured"

需要向项目负责人获取 `NEXT_PUBLIC_GLM_API_KEY` 并填入 `.env.local`。

### Q: npm install 很慢或报错

```bash
# 清除缓存后重试
npm cache clean --force
npm install
```

### Q: 端口 3000 被占用

```bash
# 查找占用进程
lsof -ti:3000

# 终止进程
kill -9 $(lsof -ti:3000)

# 或者使用其他端口启动
npm run dev -- -p 3001
```

### Q: Vercel 部署后访问超时

国内网络可能限制 Vercel 访问，建议使用**本地开发方式**预览，或通过手机热点访问。

### Q: Git pull 冲突

```bash
# 保存你的修改
git stash

# 拉取最新代码
git pull origin main

# 恢复你的修改
git stash pop
```

---

## 📚 更多文档

- [后端数据库设计](backend/README.md)
- [项目开发日志](PROJECT_JOURNAL.md)

---

## 🏆 团队

SSAI 2026 Hackathon Team Pathway

---

<p align="center">
  <strong>Made with ❤️ for career changers</strong>
