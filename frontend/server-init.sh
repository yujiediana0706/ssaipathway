#!/bin/bash
# Pathway 阿里云香港 ECS 服务器一键初始化
# 在服务器上以 root 运行： bash server-init.sh
set -e

echo "==> [1/5] 更新系统..."
apt-get update -y && apt-get upgrade -y

echo "==> [2/5] 安装 Docker + Docker Compose..."
apt-get install -y ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker && systemctl start docker
echo "Docker: $(docker --version)"
echo "Compose: $(docker compose version)"

echo "==> [3/5] 安装 Nginx..."
apt-get install -y nginx
systemctl enable nginx

echo "==> [4/5] 安装 Certbot（免费 SSL 证书）..."
apt-get install -y certbot python3-certbot-nginx

echo "==> [5/5] 防火墙开放 80/443 端口..."
ufw allow 80/tcp
ufw allow 443/tcp
ufw allow 22/tcp
ufw --force enable || true

echo ""
echo "=========================================="
echo "服务器初始化完成！"
echo "=========================================="
echo ""
echo "接下来："
echo "1. 将代码上传到服务器（scp 或 git clone）"
echo "2. cd 到 frontend 目录，确认 .env.production 配置正确"
echo "3. 运行 ./deploy-aliyun.sh 构建并启动"
echo "4. 配置 Nginx + SSL（参考 nginx.conf.example）"
echo ""
echo "Docker 版本: $(docker --version)"
echo "Nginx 状态: $(systemctl is-active nginx)"
