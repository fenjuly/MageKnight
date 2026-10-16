#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$PROJECT_DIR"
source "$PROJECT_DIR/scripts/android-env.sh"

APK_PATH="$PROJECT_DIR/outputs/android/mage-knight-solo-debug.apk"
if [[ ! -f "$APK_PATH" ]]; then
  "$PROJECT_DIR/scripts/build-android-apk.sh"
fi

if ! command -v adb >/dev/null 2>&1; then
  ADB_CANDIDATE="$ANDROID_HOME/platform-tools/adb"
  if [[ -x "$ADB_CANDIDATE" ]]; then
    ADB_COMMAND="$ADB_CANDIDATE"
  else
    echo "错误：没有找到 adb。请在 Android Studio 的 SDK Manager 中安装 Platform Tools。" >&2
    exit 1
  fi
else
  ADB_COMMAND="$(command -v adb)"
fi

if ! "$ADB_COMMAND" get-state >/dev/null 2>&1; then
  echo "错误：没有连接可用的 Android 设备或模拟器。请开启 USB 调试后重试。" >&2
  exit 1
fi

"$ADB_COMMAND" install -r "$APK_PATH"
echo "安装完成；升级安装会保留应用内的本地存档。"
