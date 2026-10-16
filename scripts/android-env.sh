#!/usr/bin/env bash

# Shared environment discovery for the Android helper scripts. Source this file
# after PROJECT_DIR has been set by the caller.

if ! command -v node >/dev/null 2>&1; then
  echo "错误：没有找到 Node.js 22 或更高版本。" >&2
  exit 1
fi

NODE_MAJOR="$(node -p 'Number(process.versions.node.split(".")[0])')"
if (( NODE_MAJOR < 22 )); then
  echo "错误：当前 Node.js 为 $(node --version)，Capacitor 8 需要 Node.js 22 或更高版本。" >&2
  exit 1
fi

if [[ -z "${ANDROID_HOME:-}" && -z "${ANDROID_SDK_ROOT:-}" ]]; then
  case "$(uname -s)" in
    Darwin) ANDROID_SDK_CANDIDATE="${HOME}/Library/Android/sdk" ;;
    Linux) ANDROID_SDK_CANDIDATE="${HOME}/Android/Sdk" ;;
    *) ANDROID_SDK_CANDIDATE="" ;;
  esac
  if [[ -n "$ANDROID_SDK_CANDIDATE" && -d "$ANDROID_SDK_CANDIDATE" ]]; then
    export ANDROID_HOME="$ANDROID_SDK_CANDIDATE"
    export ANDROID_SDK_ROOT="$ANDROID_SDK_CANDIDATE"
  fi
elif [[ -z "${ANDROID_HOME:-}" ]]; then
  export ANDROID_HOME="$ANDROID_SDK_ROOT"
elif [[ -z "${ANDROID_SDK_ROOT:-}" ]]; then
  export ANDROID_SDK_ROOT="$ANDROID_HOME"
fi

if [[ -z "${ANDROID_HOME:-}" || ! -d "$ANDROID_HOME" ]]; then
  echo "错误：没有找到 Android SDK。请安装 Android Studio，并设置 ANDROID_HOME。" >&2
  exit 1
fi

if [[ -z "${JAVA_HOME:-}" ]]; then
  for ANDROID_JAVA_CANDIDATE in \
    "/Applications/Android Studio.app/Contents/jbr/Contents/Home" \
    "/opt/android-studio/jbr"; do
    if [[ -d "$ANDROID_JAVA_CANDIDATE" ]]; then
      export JAVA_HOME="$ANDROID_JAVA_CANDIDATE"
      break
    fi
  done
fi

if ! command -v java >/dev/null 2>&1 && [[ -z "${JAVA_HOME:-}" ]]; then
  echo "错误：没有找到 Java。请使用 Android Studio 自带的 JDK。" >&2
  exit 1
fi

# Keep Gradle downloads and locks inside the project so the build behaves the
# same in restricted workspaces and ordinary terminals. The directory is ignored.
export GRADLE_USER_HOME="${GRADLE_USER_HOME:-$PROJECT_DIR/.gradle-user-home}"
