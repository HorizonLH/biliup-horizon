#!/usr/bin/env bash
set -Eeuo pipefail

# Build the Linux release binary from the Horizon GitHub repository.
# Override these variables when needed, for example:
#   BUILD_DIR="$HOME/src/biliup-horizon" ./build-linux.sh

REPO_URL="${REPO_URL:-https://github.com/HorizonLH/biliup-horizon.git}"
BRANCH="${BRANCH:-master}"
BUILD_DIR="${BUILD_DIR:-$HOME/biliup-horizon}"

need_command() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "错误：缺少命令 $1。请先安装 Node.js/npm、Rust 或 Git。" >&2
    exit 1
  }
}

for command_name in git npm cargo; do
  need_command "$command_name"
done

if [[ -e "$BUILD_DIR" && ! -d "$BUILD_DIR/.git" ]]; then
  echo "错误：目标目录已存在但不是 Git 仓库：$BUILD_DIR" >&2
  exit 1
fi

if [[ -d "$BUILD_DIR/.git" ]]; then
  echo "更新代码：$BUILD_DIR"
  git -C "$BUILD_DIR" fetch origin "$BRANCH"
  git -C "$BUILD_DIR" checkout "$BRANCH"
  git -C "$BUILD_DIR" pull --ff-only origin "$BRANCH"
else
  echo "下载代码：$REPO_URL"
  git clone --branch "$BRANCH" --single-branch "$REPO_URL" "$BUILD_DIR"
fi

cd "$BUILD_DIR"

echo "安装前端依赖"
npm ci

echo "构建 Web UI（必须先于 Rust）"
npm run build

echo "编译 Linux release 二进制"
cargo build -p biliup-cli --bin biliup --release --locked

OUTPUT="$BUILD_DIR/target/release/biliup"
if [[ ! -x "$OUTPUT" ]]; then
  echo "错误：编译完成但未找到可执行文件：$OUTPUT" >&2
  exit 1
fi

echo
echo "构建完成：$OUTPUT"
echo "文件大小：$(du -h "$OUTPUT" | awk '{print $1}')"
echo "SHA-256：$(sha256sum "$OUTPUT" | awk '{print $1}')"
echo
echo "验证版本："
"$OUTPUT" --version
