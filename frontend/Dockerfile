# ============================================================
# Pathway — 生产镜像（Next.js 16 standalone）
# 构建期只注入公开的 NEXT_PUBLIC_*（.env.build，随仓库提交）；
# 运行期密钥由部署机 .env.production 通过 env_file 提供，绝不进入构建上下文。
# ============================================================

# --- Stage 1: Build ---
FROM node:22-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY . .
# 公开构建变量（非密钥）：仅 NEXT_PUBLIC_*，覆盖镜像内的空 .env.production
COPY .env.build .env.production

RUN npm run build

# --- Stage 2: Runtime ---
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000

# 创建非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# standalone 输出所需文件
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
