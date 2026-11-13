#!/usr/bin/env bash
# ============================================================
# Firebase Storage → 阿里云 OSS 文件迁移
#
# 依赖：gcloud/gsutil（本地已安装）、ossutil（阿里云官方 CLI）
# 用法：
#   export GCS_BUCKET="pathway-app-512202-prod"
#   export OSS_BUCKET="pathway-prod"
#   export OSS_ENDPOINT="oss-cn-hangzhou.aliyuncs.com"
#   ./migrate-storage.sh
#
# 说明：
#   - 只迁 resumes/、coach-docs/、coach-avatars/ 三个前缀
#   - 先落本地临时目录再上传，便于校验数量与体积
#   - 匿名简历目录（resumes/anonymous/）建议迁移后设 30 天生命周期
#   - OSS Bucket 必须保持“私有”，读取走签名 URL
# ============================================================
set -euo pipefail

: "${GCS_BUCKET:?请设置 GCS_BUCKET}"
: "${OSS_BUCKET:?请设置 OSS_BUCKET}"

WORK_DIR="${WORK_DIR:-./storage-dump}"
PREFIXES=("resumes" "coach-docs" "coach-avatars")

mkdir -p "$WORK_DIR"

for prefix in "${PREFIXES[@]}"; do
  echo "==> 下载 gs://${GCS_BUCKET}/${prefix}"
  mkdir -p "${WORK_DIR}/${prefix}"
  gsutil -m rsync -r "gs://${GCS_BUCKET}/${prefix}" "${WORK_DIR}/${prefix}"
  echo "    本地文件数: $(find "${WORK_DIR}/${prefix}" -type f | wc -l | tr -d ' ')"
done

echo "==> 上传到 oss://${OSS_BUCKET}"
for prefix in "${PREFIXES[@]}"; do
  ossutil cp -r "${WORK_DIR}/${prefix}" "oss://${OSS_BUCKET}/" --update --jobs 8
done

echo "==> OSS 对象数校验"
ossutil ls "oss://${OSS_BUCKET}/resumes/" | tail -1
ossutil ls "oss://${OSS_BUCKET}/coach-docs/" | tail -1
ossutil ls "oss://${OSS_BUCKET}/coach-avatars/" | tail -1

cat <<'EOF'

完成。后续检查：
  1) OSS 控制台确认 Bucket ACL = 私有
  2) 为 resumes/anonymous/ 配置 30 天生命周期规则
  3) 应用侧改为 ali-oss SDK + 签名 URL（api/resume/upload、api/coach-docs/*）
  4) 校验通过后再删除 GCS 源文件（保留至少 7 天）
EOF
