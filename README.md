# Pathway — AI Career Transformation Companion

SSAI 2026 Hackathon Team Pathway

AI 驱动的职业转型平台：通过 AI 诊断、岗位模拟和教练陪跑，帮助用户低成本完成职业探索与转型。

## 产品功能

1. **AI 转型诊断** — 多轮对话收集用户信息，生成结构化转型诊断报告
2. **岗位模拟器** — 沉浸式体验目标岗位真实工作日常，低成本试错
3. **Coach 双轨陪伴** — AI Coach 长期陪跑 + 真人教练预约平台

## 项目结构

```
ssaipathway/
├── frontend/           # Next.js 前端应用
│   ├── src/
│   │   ├── app/         # App Router 页面
│   │   ├── components/  # 共享组件
│   │   └── lib/         # 工具库（mock数据、类型、GLM API、Supabase客户端）
│   └── package.json
└── backend/            # Supabase 后端配置
    ├── schema.sql      # 数据库表结构
    └── .env.example    # 环境变量模板
```

## 技术栈

- **前端**: Next.js 16 (App Router) + TypeScript + Tailwind CSS 4
- **后端**: Supabase (BaaS)
- **AI**: GLM (Zhipu AI API)
- **运行时**: Node.js 20+

## 快速开始

### 前端开发

```bash
cd frontend
npm install
npm run dev
```

访问 http://localhost:3000

### 后端配置

1. 创建 [Supabase](https://supabase.com) 项目
2. 在 SQL Editor 中执行 `backend/schema.sql`
3. 复制 `backend/.env.example` 到 `frontend/.env.local` 并填入实际凭据
4. 配置 GLM API Key 用于 AI 功能

## 页面路由

| 路由 | 说明 |
|------|------|
| `/` | 首页（极简，单 CTA） |
| `/explore` | AI 探索对话流程 |
| `/report` | 转型诊断报告 |
| `/simulator` | 岗位模拟器 |
| `/coach` | AI Coach + 真人教练预约 |
| `/dashboard` | 老用户工作台 |
