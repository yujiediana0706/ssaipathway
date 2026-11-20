# 香港 ACR 部署手册（GitHub Actions 构建）

目标：GitHub `main` 推送后由 **GitHub Actions** 构建镜像并推送到 **阿里云 ACR 个人版（香港）**，
服务器只做 `pull` + `up -d`。个人版 ACR **没有自动构建**，构建全部在 GitHub 侧完成。
**任何情况下都不在服务器执行 `docker build` / `docker compose build`。**

---

## 1. ACR 仓库信息（个人版 · 香港）

| 项目 | 值 |
|---|---|
| Registry 地址 | `crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com` |
| 命名空间 | `pathway` |
| 仓库名称 | `web` |
| 完整镜像地址 | `crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com/pathway/web` |
| 镜像 Tag | `latest`（生产）+ `sha-<短提交>`（每次构建，用于回滚） |
| 仓库类型 | 私有，服务器需要 `docker login` |

个人版控制台只有「访问凭证 / 镜像版本 / 触发器」，**不需要也不支持配置自动构建**。

---

## 2. GitHub Actions 构建

工作流文件：`.github/workflows/build-image.yml`

- 触发：push 到 `main`（仅 `frontend/**` 或该工作流自身变化），以及 `workflow_dispatch` 手动触发
- Runner：`ubuntu-latest`
- 构建：`frontend/Dockerfile`，`context: frontend`，`platforms: linux/amd64`
- 推送：`<ACR_REGISTRY>/pathway/web:latest` 和 `:sha-<短提交>`（`docker/metadata-action` 生成）
- 缓存：`cache-from/to: type=gha`（GitHub 侧缓存，不占服务器磁盘）
- 日志末尾输出镜像 **digest** 与 commit SHA

### 需要添加的 3 个 GitHub Secrets

仓库 → Settings → Secrets and variables → Actions → New repository secret：

| Secret | 值 |
|---|---|
| `ACR_REGISTRY` | `crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com` |
| `ACR_USERNAME` | ACR 访问凭证里的**用户名**（个人版通常是阿里云账号全名） |
| `ACR_PASSWORD` | ACR 访问凭证里设置的**固定密码**（不是阿里云登录密码） |

### 耗时与失败处理

- Runner 在海外：拉 GitHub 代码 + 推镜像到香港 ACR 都是公网，正常 **3–8 分钟**。
- 若推送到 ACR 超时：**用 `workflow_dispatch` 重跑一次**（镜像已缓存，通常更快）。
- **不要**因为 CI 失败就回退到服务器 `docker build`。

### 构建期公开变量（已随仓库提供）

`NEXT_PUBLIC_*` 会在 `next build` 时内联，仓库内 `frontend/.env.build` 只含 7 个公开值，
`Dockerfile` 在 builder 阶段 `COPY .env.build .env.production`。
部署机 `.env.production`（含 `FIREBASE_PRIVATE_KEY` 等）不会进入构建上下文，只在运行期通过 `env_file` 注入。

**首次部署后验证**：确认线上 Firebase 配置不是空值，例如页面能正常加载教练列表、
浏览器控制台无 `auth/invalid-api-key`；或用 §5 的方式检查镜像内 bundle 是否含项目 ID。

---

## 3. 服务器一次性准备

```bash
cd /opt/ssaipathway/frontend

# 1) 写入 compose 变量文件（compose 自动读取同目录 .env，用于 ${REGISTRY}/${TAG} 插值）
#    注意：运行期密钥仍在 .env.production，两者不要混用
cat > .env <<'EOF'
REGISTRY=crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com
TAG=latest
EOF

# 2) 登录 ACR（个人版用访问凭证里的固定密码，不是阿里云登录密码）
docker login crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com -u <ACR 用户名>

# 3) 磁盘必须 > 5G（镜像约 414MB，拉取需要临时空间）
df -h /
```

> `.env` 只放 `REGISTRY` / `TAG`，不要写入任何密钥；`env_file: .env.production` 保持不变。

---

## 4. 每次发布（服务器侧，4 条命令）

```bash
cd /opt/ssaipathway/frontend

df -h /                                   # 可用空间必须 > 5G
docker compose pull pathway               # 只拉镜像，不 build
docker compose up -d --no-build --force-recreate pathway
docker compose ps                         # 期望 Up ... (healthy)
```

`pull` 阶段：ACR 与服务器都在香港，通常几十秒；若走公网仍偏慢，属正常现象，不要中断重试。

---

## 5. 部署后自检（防止“以为部署了其实是旧镜像”）

在服务器执行：

```bash
cd /opt/ssaipathway
HEAD_ISO=$(git log -1 --format=%cI)
IMG_CREATED=$(docker image inspect -f '{{.Created}}' "$(docker inspect -f '{{.Config.Image}}' pathway-app)")
echo "HEAD=$HEAD_ISO"
echo "IMAGE=$IMG_CREATED"

node -e '
const [c,h] = process.argv.slice(1);
const p = s => Date.parse(s.replace(/\.(\d{3})\d+/, ".$1"));
if (p(c) + 60000 < p(h)) { console.log("STALE: 镜像早于 HEAD 提交，未生效"); process.exit(1); }
console.log("OK: 镜像创建时间不早于 HEAD 提交时间");
' "$IMG_CREATED" "$HEAD_ISO"
```

再补一条运行镜像一致性检查（compose 解析出的镜像必须与实际容器一致）：

```bash
docker inspect -f '{{.Config.Image}} {{.Image}}' pathway-app
# 渲染到文件再过滤，避免密钥落屏
docker compose config > /tmp/compose.rendered 2>/dev/null
grep -E '^    image:' /tmp/compose.rendered
rm -f /tmp/compose.rendered
```

**判定规则：`IMAGE` 的 Created 早于 `HEAD` 的提交时间 ⇒ 视为本次发布未生效。**

---

## 6. 回滚到上一个 tag

前提：ACR 里保留了历史 `sha-<短提交>` tag（每次 CI 构建都会打）。

```bash
cd /opt/ssaipathway/frontend

# 列出可用 tag
docker image ls --format '{{.Tag}}' crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com/pathway/web

# 直接指定 TAG 覆盖 .env 中的值；回滚到上一次发布
docker pull crpi-tjvh03jbl2y3dozm.cn-hongkong.personal.cr.aliyuncs.com/pathway/web:sha-<old>
TAG=sha-<old> docker compose pull pathway
TAG=sha-<old> docker compose up -d --no-build --force-recreate pathway

docker compose ps
docker inspect -f '{{.Config.Image}}' pathway-app   # 确认已指向 sha-<old>
```

回滚后同样跑一遍 §5 的自检（此时 Expected 是回滚 tag 对应的提交时间，而不是当前 HEAD）。

---

## 7. 红线与容量提醒

- **绝对禁止在服务器上 `docker build`、`docker compose build`、`docker buildx build`。**
  这台 2C4G / 50G 的机器曾因构建占满资源导致整机失联。
- 拉取前先 `df -h /`，**可用空间必须 > 5G**；不足时先 `docker image prune -f`、`docker builder prune -f`。
- 不要 `docker system prune -a`（会删掉正在回滚所需的旧镜像）。
- 拉取慢是正常现象；失败时先看 `docker pull` 的具体报错，不要在服务器改网络/MTU 配置。

---

## 8. Dockerfile / 缓存问题（已实施）

1. **已删除无用的 `deps` 阶段**：原先多跑一次 `npm ci --only=production`，产物从未被复制。
2. **构建缓存不再落在服务器**：构建迁到 GitHub Actions，使用 `type=gha` 缓存；服务器只存放运行镜像。
3. **`.dockerignore` 已收紧**：排除 `node_modules`、`.next`、`.git`、`.env*`，仅放行公开的 `.env.build`。
4. **`.env.production` 不再进入构建上下文**：部署机密钥只在运行期通过 `env_file` 注入；构建期只用 `.env.build` 里的公开 `NEXT_PUBLIC_*`。
5. **`npm ci` 已加 `--mount=type=cache,target=/root/.npm`**：冷构建可省 20–40 秒。
