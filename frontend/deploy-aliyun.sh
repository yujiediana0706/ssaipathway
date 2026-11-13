#!/bin/bash
# Pathway 阿里云 ECS 一键部署脚本
# 使用方法：
#   1. 复制 .env.production.example 为 .env.production，填入真实值
#   2. chmod +x deploy-aliyun.sh
#   3. ./deploy-aliyun.sh

set -e

cd "$(dirname "$0")"

echo "==> 检查环境变量文件..."
if [ ! -f .env.production ]; then
  echo "错误：未找到 .env.production"
  echo "请执行：cp .env.production.example .env.production"
  echo "然后编辑填入真实值后重新运行"
  exit 1
fi

echo "==> 检查必要变量..."
MISSING=""
for VAR in NEXT_PUBLIC_FIREBASE_API_KEY NEXT_PUBLIC_FIREBASE_PROJECT_ID; do
  if ! grep -q "^${VAR}=" .env.production || [ -z "$(grep "^${VAR}=" .env.production | cut -d= -f2-)" ]; then
    MISSING="$MISSING $VAR"
  fi
done
if [ -n "$MISSING" ]; then
  echo "警告：以下变量未配置，可能导致功能异常：$MISSING"
  echo "按 Ctrl+C 取消，或 5 秒后继续..."
  sleep 5
fi

echo "==> 拉取最新代码..."
git pull || echo "（非 git 仓库，跳过）"

echo "==> 构建并启动容器..."
docker compose down
docker compose build --no-cache
docker compose up -d

echo "==> 等待服务启动..."
sleep 10

echo "==> 检查服务状态..."
if curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/ | grep -q "307\|200"; then
  echo "✓ 服务已启动，访问 http://localhost:3000"
else
  echo "✗ 服务启动异常，请查看日志：docker compose logs -f"
  exit 1
fi

echo ""
echo "部署完成！"
echo "下一步：配置 Nginx 反向代理 + SSL 证书（参考 nginx.conf.example）"
