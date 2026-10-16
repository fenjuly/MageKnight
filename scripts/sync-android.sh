#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"
source "$PROJECT_DIR/scripts/android-env.sh"

if [[ ! -d "$PROJECT_DIR/android" ]]; then
  echo "错误：Android 工程不存在。请确认仓库中的 android/ 目录完整。" >&2
  exit 1
fi

echo "[1/2] 构建离线移动端资源"
npm run build:mobile

echo "[2/2] 同步到 Android 工程"
npx cap sync android

echo "Android 工程已同步。"
