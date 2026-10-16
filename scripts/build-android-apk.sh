#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"
source "$PROJECT_DIR/scripts/android-env.sh"

"$PROJECT_DIR/scripts/sync-android.sh"

echo "[3/3] 生成可直接安装的 debug APK"
cd "$PROJECT_DIR/android"
./gradlew --no-daemon assembleDebug

SOURCE_APK="$PROJECT_DIR/android/app/build/outputs/apk/debug/app-debug.apk"
OUTPUT_DIR="$PROJECT_DIR/outputs/android"
OUTPUT_APK="$OUTPUT_DIR/mage-knight-solo-debug.apk"
mkdir -p "$OUTPUT_DIR"
cp "$SOURCE_APK" "$OUTPUT_APK"

echo "APK 已生成：$OUTPUT_APK"
