# Biliup 构建与部署指南

本文档供后续维护者和自动化代理使用，统一说明 Web 前端、`biliup` 命令行工具、Tauri 桌面应用以及 Docker 镜像的构建顺序和产物位置。

## 通用约定

- 所有命令默认从仓库根目录执行；特别标注工作目录的命令除外。
- 发布构建优先使用锁文件：Node.js 使用 `npm ci`，Rust 使用 `--locked`。
- `crates/biliup-cli/src/server/api/spa.rs` 会把根目录的 `out/` 嵌入 `biliup`。修改 Web UI 后，必须先执行 `npm run build`，再编译 Rust；顺序反过来会把旧页面打进二进制。
- 根目录 Rust release 配置启用了 LTO、单 codegen unit 和 strip，首次构建时间较长是正常现象。
- 默认服务端口是 `19159`。启动 Tauri 或本地服务前先检查端口占用，不能为了打包而终止用户已有的生产进程。
- 临时 QA 服务可使用 `19160`，但测试目录和进程应在验证后清理，不要把 `.codex-qa/` 当作长期运行目录或提交进 Git。

## 1. 构建 Web UI

```powershell
npm ci
npm run build
```

静态导出产物位于 `out/`。`npm run build` 同时执行前端编译、Lint 和 TypeScript 检查。已有的不相关警告可以记录，但新增错误必须修复后才能继续打包。

## 2. 打包 biliup 命令行工具

### Windows 本机构建

```powershell
npm ci
npm run build
cargo build -p biliup-cli --bin biliup --release --locked
```

产物：

```text
target/release/biliup.exe
```

需要分发 ZIP 时：

```powershell
New-Item -ItemType Directory -Force -Path dist/biliup | Out-Null
Copy-Item target/release/biliup.exe dist/biliup/biliup.exe -Force
Compress-Archive -Path dist/biliup -DestinationPath dist/biliup-windows-x64.zip -Force
```

打包前至少验证：

```powershell
target/release/biliup.exe --version
target/release/biliup.exe server --help
```

### 多平台发布

`.github/workflows/release.yml` 已定义 Windows、Linux、Linux musl、ARM Linux 和 macOS 构建矩阵。推送符合 `vX.Y.Z` 格式的 Git 标签会构建各平台二进制并生成发布压缩包。修改该工作流时仍须保留“先构建前端，再构建 Rust”的顺序。

## 3. 打包 Tauri 桌面应用

Tauri 应用不是独立后端。它会从资源目录启动 `binaries/biliup.exe server`，然后 WebView 跳转到 `http://localhost:19159`。因此 `biliup.exe` 是桌面应用必须内置的 sidecar，不应另外作为命令行安装包交付。

### Windows NSIS 安装包

```powershell
# 先生成根 Web UI，并将它嵌入 release sidecar
npm ci
npm run build
cargo build -p biliup-cli --bin biliup --release --locked

# 准备 Tauri 资源，文件名必须与 src-tauri/src/lib.rs 一致
New-Item -ItemType Directory -Force -Path tauri-app/src-tauri/binaries | Out-Null
Copy-Item target/release/biliup.exe tauri-app/src-tauri/binaries/biliup.exe -Force

# 安装 Tauri 前端依赖并只生成 NSIS 桌面安装包
npm ci --prefix tauri-app
Push-Location tauri-app
try {
    npm run tauri build -- --bundles nsis
} finally {
    Pop-Location
}
```

产物：

```text
tauri-app/src-tauri/target/release/bundle/nsis/bbup-app_<版本>_x64-setup.exe
```

重要检查：

- 根目录 `out/` 的生成时间必须早于 `target/release/biliup.exe`，否则 sidecar 可能嵌入旧页面。
- `tauri-app/src-tauri/binaries/biliup.exe` 必须是刚构建的 release 文件。
- `tauri-app/src-tauri/src/lib.rs` 启动 sidecar 时必须传入 `server` 子命令。
- Tauri 默认使用 `19159`；运行安装后的应用前应确保该端口没有被另一实例占用。
- 首次打包可能从 crates.io、GitHub 下载 Rust 依赖和 NSIS 工具，离线环境需预先准备 Cargo/npm 缓存以及 `%LOCALAPPDATA%/tauri/NSIS`。
- 只需要 Windows 安装包时使用 `--bundles nsis`，不要使用默认的 `targets: all` 额外生成 MSI。

安装包生成后可验证内容与哈希：

```powershell
7z l tauri-app/src-tauri/target/release/bundle/nsis/bbup-app_*_x64-setup.exe
Get-FileHash -Algorithm SHA256 tauri-app/src-tauri/target/release/bundle/nsis/bbup-app_*_x64-setup.exe
```

包内应至少包含 `tauri-app.exe` 和 `binaries/biliup.exe`。

## 4. Docker 构建与部署

根目录 `Dockerfile` 使用三阶段构建：Node.js 构建 Web UI，Rust/Python 构建 wheel，最终 Python slim 镜像安装 wheel 和 FFmpeg。纯音频平台的转换依赖 FFmpeg，因此不能随意从最终镜像移除它。

### 构建包含当前代码的本地镜像

```powershell
docker build --pull -t biliup-local:latest .
```

运行示例：

```powershell
docker run -d `
  --name biliup `
  --restart unless-stopped `
  -p 127.0.0.1:19159:19159 `
  -v "D:\biliup-data:/opt" `
  biliup-local:latest server --auth
```

`/opt` 必须映射到持久化目录，用于保存数据库、配置、凭据引用、日志和录制文件。需要局域网访问时可将端口映射中的 `127.0.0.1` 改成明确的宿主机地址；不要无意中把未启用认证的服务暴露到公网。

### 使用 docker-compose.yml

仓库当前的 `docker-compose.yml` 默认引用远程镜像 `ghcr.io/biliup/caution:latest`，它不会包含本地未发布修改。部署前必须：

1. 将 `<HOST_ADDRESS>`、`<HOST_PORT>` 和 `/path/to/save_folder` 替换为真实值。
2. 若部署当前工作区代码，将 `image` 改为前一步构建的 `biliup-local:latest`。
3. 若使用官方远程镜像，则保留原 `image`，并确认所需修改已经发布到该镜像。

启动与验证：

```powershell
docker compose config
docker compose up -d
docker compose ps
docker compose logs -f biliup
```

停止服务但保留 `/opt` 挂载数据：

```powershell
docker compose down
```

更新远程镜像部署：

```powershell
docker compose pull
docker compose up -d
```

不要使用 `docker compose down -v`，除非用户明确要求删除命名卷中的持久化数据。

## 5. 发布前检查清单

1. 执行 `git diff --check`，确认没有空白符错误。
2. 执行 `npm run build`，确认前端构建和类型检查通过。
3. 根据交付目标构建 CLI、Tauri 或 Docker，不要无要求地构建其他产物。
4. 记录实际产物路径、文件大小和 SHA-256。
5. Tauri 安装包应检查 sidecar 是否包含最新 Web UI，并确认启动命令为 `biliup.exe server`。
6. Docker 应确认 `/opt` 持久化挂载、端口绑定、认证选项和 FFmpeg 可用性。
7. 不要删除或覆盖用户已有的录制文件、数据库、Cookie 或封面资源。
