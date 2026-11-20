#!/usr/bin/env bash
# ============================================================
# Pathway 部署脚本（绝不在服务器上构建）
#
# 两种模式：
#   --acr   本地 buildx 构建 linux/amd64 → 推送 ACR → 服务器 pull + up -d
#   --save  本地 buildx 构建 linux/amd64 → docker save | gzip → scp → 服务器 load + up -d
#
# 用法：
#   IMAGE_REPO=registry.cn-hangzhou.aliyuncs.com/<ns>/pathway scripts/deploy/deploy.sh --acr
#   scripts/deploy/deploy.sh --save
#
# 可选环境变量：
#   IMAGE_TAG    默认当前 git short sha
#   SERVER       默认 root@47.79.76.66
#   REMOTE_DIR   默认 /opt/ssaipathway/frontend
#   SERVICE      默认 pathway（docker-compose.yml 中的服务名）
#   SKIP_SMOKE=1 跳过部署后的 HTTPS 冒烟检查
# ============================================================
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
# 仓库根在 ssaipathway/，Docker 构建上下文是 frontend/
cd "$REPO_ROOT/frontend"

SERVER="${SERVER:-root@47.79.76.66}"
REMOTE_DIR="${REMOTE_DIR:-/opt/ssaipathway/frontend}"
SERVICE="${SERVICE:-pathway}"
PLATFORM="linux/amd64"
HEAD_SHA="$(git rev-parse HEAD)"
IMAGE_TAG="${IMAGE_TAG:-$(git rev-parse --short HEAD)}"
IMAGE_REPO="${IMAGE_REPO:-crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com/pathway/web}"
LOCAL_IMAGE="pathway-deploy:${IMAGE_TAG}"
SSH_OPTS=(-o StrictHostKeyChecking=no -o ConnectTimeout=20 -o ConnectionAttempts=1)
TARBALL=""

log()  { printf '\033[1;34m[deploy]\033[0m %s\n' "$*"; }
warn() { printf '\033[1;33m[warn]\033[0m %s\n' "$*"; }
die()  { printf '\033[1;31m[fail]\033[0m %s\n' "$*" >&2; exit 1; }
trap '[[ -n "$TARBALL" && -f "$TARBALL" ]] && rm -f "$TARBALL"' EXIT

MODE=""
for arg in "$@"; do
  case "$arg" in
    --acr|--save)
      [[ -n "$MODE" ]] && die "只能指定一种模式"
      MODE="${arg#--}" ;;
    -h|--help)
      sed -n '2,22p' "$0"; exit 0 ;;
    *)
      die "未知参数：$arg（仅支持 --acr / --save）" ;;
  esac
done
[[ -n "$MODE" ]] || die "必须指定 --acr 或 --save"

# ─── 通用前置检查 ────────────────────────────────────────────
precheck_local() {
  command -v docker >/dev/null || die "本地未安装 docker"
  docker info >/dev/null 2>&1 || die "本地 Docker 未运行（Docker Desktop 是否已启动？）"
  docker buildx version >/dev/null 2>&1 || die "缺少 docker buildx"
  # 仅允许构建 amd64 镜像；宿主是 arm64 时走 QEMU 模拟，速度慢但产物架构正确
  log "本地宿主架构：$(uname -m)，构建目标：${PLATFORM}"
  if ! git diff --quiet || ! git diff --cached --quiet; then
    warn "工作区有未提交改动，镜像内容会包含它们，但镜像标签仍指向 ${HEAD_SHA}"
  fi
}

precheck_server() {
  local avail_kb busy
  ssh "${SSH_OPTS[@]}" "$SERVER" "true" 2>/dev/null || die "SSH 连不上 ${SERVER}"
  avail_kb="$(ssh "${SSH_OPTS[@]}" "$SERVER" "df -Pk / | awk 'NR==2 {print \$4}'")"
  log "服务器根分区可用：$((avail_kb / 1024 / 1024)) GiB"
  (( avail_kb > 5 * 1024 * 1024 )) || die "服务器磁盘可用不足 5 GiB（${avail_kb} KiB），先清理再部署"
  busy="$(ssh "${SSH_OPTS[@]}" "$SERVER" \
    "ps -eo args | grep -E 'docker (build|compose build|buildx build)|buildkitd.*build' | grep -v grep || true")"
  [[ -z "$busy" ]] || die "服务器上仍有构建进程，禁止在服务器构建：
$busy"
  log "服务器无构建进程（符合“绝不在服务器 build”约束）"
}

# ─── 构建 ────────────────────────────────────────────────────
build_image() {
  log "本地构建 ${LOCAL_IMAGE}（${PLATFORM}）"
  docker buildx build \
    --platform "$PLATFORM" \
    --provenance=false \
    --label "org.opencontainers.image.revision=${HEAD_SHA}" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -t "$LOCAL_IMAGE" \
    --load \
    .
}

# 镜像自检：架构 + revision 标签 + 创建时间必须晚于当前 HEAD 提交时间
check_image() {
  local image="$1" arch rev created img_ms head_ms
  arch="$(docker image inspect -f '{{.Architecture}}' "$image")"
  [[ "$arch" == "amd64" ]] || die "镜像架构为 ${arch}，期望 amd64"

  rev="$(docker image inspect -f '{{ index .Config.Labels "org.opencontainers.image.revision" }}' "$image")"
  [[ "$rev" == "$HEAD_SHA" ]] || die "镜像 revision=${rev} 与 HEAD=${HEAD_SHA} 不一致（疑似旧镜像）"

  created="$(docker image inspect -f '{{.Created}}' "$image")"
  img_ms="$(node -e 'const s=process.argv[1].replace(/\.(\d{3})\d+/, ".$1");const t=Date.parse(s);if(Number.isNaN(t))process.exit(2);process.stdout.write(String(t))' "$created")"
  head_ms="$(node -e 'const t=Date.parse(process.argv[1]);if(Number.isNaN(t))process.exit(2);process.stdout.write(String(t))' "$(git show -s --format=%cI HEAD)")"
  # 允许 60s 时钟误差；镜像创建时间必须 >= HEAD 提交时间
  (( img_ms + 60000 >= head_ms )) || die "镜像创建时间 ${created} 早于 HEAD 提交时间，疑似未包含最新代码"
  log "镜像自检通过：arch=${arch} revision=${rev:0:12} created=${created}"
}

# ─── 发布 ────────────────────────────────────────────────────
remote_deploy() {
  local source_ref="$1"          # 服务器上可用于 docker tag 的镜像名
  local expected_id
  expected_id="$(ssh "${SSH_OPTS[@]}" "$SERVER" \
    "docker image inspect -f '{{.Id}}' '$source_ref'")"

  log "服务器切换镜像并重启服务（不构建）"
  ssh "${SSH_OPTS[@]}" "$SERVER" "set -e
    current_image=\$(docker inspect -f '{{.Config.Image}}' pathway-app 2>/dev/null || echo frontend-pathway)
    docker tag '$source_ref' \"\$current_image\"
    cd '$REMOTE_DIR'
    docker compose up -d --no-build --no-deps --force-recreate '$SERVICE'
    docker inspect -f 'container={{.Name}} image={{.Image}} status={{.State.Status}} health={{.State.Health.Status}}' pathway-app"

  local running_id
  running_id="$(ssh "${SSH_OPTS[@]}" "$SERVER" "docker inspect -f '{{.Image}}' pathway-app")"
  [[ "$running_id" == "$expected_id" ]] || die "运行中容器镜像 ${running_id} 与期望 ${expected_id} 不一致"
  log "运行容器镜像校验通过：${running_id:0:19}"
}

smoke_test() {
  [[ "${SKIP_SMOKE:-0}" == "1" ]] && { warn "已跳过 HTTPS 冒烟"; return; }
  local code
  code="$(curl -s -o /dev/null -m 20 -w '%{http_code}' https://yourpathwayai.com/zh/coach || true)"
  [[ "$code" == "200" ]] || die "冒烟检查失败：/zh/coach 返回 ${code}"
  log "冒烟检查通过：/zh/coach 200"
}

# ─── 两种模式 ────────────────────────────────────────────────
deploy_acr() {
  [[ -n "${IMAGE_REPO:-}" ]] || die "--acr 模式需要设置 IMAGE_REPO"
  local remote_ref="${IMAGE_REPO}:${IMAGE_TAG}"
  log "ACR 模式：构建并推送 ${remote_ref}"
  docker buildx build \
    --platform "$PLATFORM" \
    --provenance=false \
    --label "org.opencontainers.image.revision=${HEAD_SHA}" \
    --label "org.opencontainers.image.created=$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
    -t "$remote_ref" \
    --push \
    .
  log "推送完成，服务器拉取（只 pull，不 build）"
  ssh "${SSH_OPTS[@]}" "$SERVER" "docker pull '$remote_ref'"
  remote_deploy "$remote_ref"
}

deploy_save() {
  build_image
  check_image "$LOCAL_IMAGE"

  TARBALL="$(mktemp -t pathway-image).tar.gz"
  log "导出镜像（gzip）到 ${TARBALL}"
  docker save "$LOCAL_IMAGE" | gzip -1 > "$TARBALL"
  local size_mb
  size_mb=$(( $(wc -c < "$TARBALL") / 1024 / 1024 ))
  log "镜像包大小：${size_mb} MiB"

  local remote_tmp="/tmp/pathway-${IMAGE_TAG}.tar.gz"
  log "传输到服务器 ${remote_tmp}"
  scp -o StrictHostKeyChecking=no "$TARBALL" "${SERVER}:${remote_tmp}"

  log "服务器 docker load（不 build）"
  ssh "${SSH_OPTS[@]}" "$SERVER" "set -e
    gunzip -c '$remote_tmp' | docker load
    rm -f '$remote_tmp'"
  remote_deploy "$LOCAL_IMAGE"
}

precheck_local
precheck_server

case "$MODE" in
  acr)  deploy_acr ;;
  save) deploy_save ;;
esac

smoke_test
log "部署完成：${LOCAL_IMAGE}（HEAD ${HEAD_SHA:0:12}）"
