# 立体感知 · 空间实验室

工程直接位于 `W04-Practice/`。开发文档、验收记录和后续维护信息集中在本目录；原始技术方案保留为需求依据。

## 本地课堂运行

已构建的交付包含 `dist/`、`scripts/serve-static.mjs` 和 `启动实验室.cmd`。安装 Node.js 22.14 或以上版本后，双击 `启动实验室.cmd`，浏览器会打开本机页面。请保留启动器窗口；按 Ctrl+C 结束服务。

也可在工程根目录运行：

```powershell
node scripts/serve-static.mjs
```

默认尝试 `http://127.0.0.1:4173/`；如果被其他工程占用，会自动依次尝试 4174–4193 并打开实际地址。窗口打印的地址为准。显式使用 `--port 4174` 时会固定该端口。已构建版本不需要安装 npm 开发依赖；运行资源来自本地。不能直接双击 `dist/index.html` 代替 HTTP 服务。

课堂分发用 `立体感知实验室-本地运行包.zip`：完整解压后再双击启动器。重新构建并通过验证后，可在 PowerShell 7 执行 `./scripts/package-local.ps1` 更新运行包。

## 开发与构建

```powershell
npm ci
npm run dev
npm run typecheck
npm run test
node --test scripts/serve-static.test.mjs
npm run build
npm run test:e2e
npm run preview
```

开发环境使用 Node.js 22.14.0 / npm 10.9.2。依赖精确版本见 `package-lock.json`。`npm run build` 生成可独立托管的 `dist/`；`preview` 用于检查构建结果，本地分发使用独立静态服务器。

浏览器测试在 Windows 使用已安装的 Chrome；其他系统先运行 `npx playwright install chromium`。测试会自行启动独立的根路径和子路径静态服务，无需手动启动开发服务器。

## 实验和保存

- **深度线索 D09**：改变目标近远和高度，切换网格、阴影、雾、环境和遮挡，比较同实际高度与补偿画面高度。
- **错位片场 D10**：在参考相机下对齐接触点；冻结几何后侧移机位，观察分离误差。投影保持缩放会一起改变距离、实际尺寸和离地高度。
- **机位与焦距 D12**：分别探索原地变焦、固定焦距移动、保持主体画面高度。联动模式只允许距离驱动焦距。
- A/B 保存冻结状态与图像，继续编辑不会改写既有快照；恢复快照进入撤销历史。
- JSON 用于跨机器、跨地址迁移；浏览器本地保存只属于当前站点和部署路径。复制链接只携带当前实验参数，不包含快照位图和撤销历史。
- 这里的立体感知指单屏画面中的空间与深度线索；网页未向左右眼分送图像。

## 根路径与仓库子路径

Vite 使用相对资源路径，同一 `dist` 可以放在根路径或仓库子目录。仅使用 hash 状态入口，不依赖服务器的 SPA 重写。

模拟仓库子路径：

```powershell
node scripts/serve-static.mjs --port 4174 --base /stereo-perception-lab/
```

打开 `http://127.0.0.1:4174/stereo-perception-lab/`。复制链接后在新标签打开，刷新应仍加载同一状态。静态服务器只绑定本机地址、允许 GET/HEAD，并限制可读文件在 `dist` 内。

## GitHub Pages

`.github/workflows/pages.yml` 是**以 W04-Practice 为仓库根目录**的部署工作流。它执行安装、类型检查、数学测试、静态服务器测试、构建，再上传并部署 `dist/`。在 GitHub 仓库 Settings → Pages 中把来源设为 GitHub Actions；默认触发分支为 `main`。

目前工程嵌套在课程目录中，尚未建立或发布 GitHub 仓库。若将整个课程作为仓库，需要把工作流复制到**仓库根目录** `.github/workflows/`，为 build job 添加 `defaults.run.working-directory: Footages/W04/W04-Practice`，并调整 `setup-node` 的 `cache-dependency-path` 与上传步骤 `path` 到该子目录的锁文件和 `dist`。GitHub 不会执行嵌套工程内的工作流。

Actions 版本按 2026-10-22 读取的 [Vite 官方部署示例](https://vite.dev/guide/static-deploy.html#github-pages) 的提交 SHA 固定；Node 版本与本地验证一致。参考 [GitHub Pages artifact](https://github.com/actions/upload-pages-artifact) 和 [部署 action](https://github.com/actions/deploy-pages)。本次开发不触发线上发布。

## 维护入口

- [技术方案](立体感知交互实验室_D09-D10-D12_网页技术方案.md)：需求、几何约定、M01–M10 / I01–I15 验收标准。
- [开发记忆](DEVELOPMENT.md)：代码职责、不变量和后续维护规则。
- [实际验证记录](VALIDATION.md)：测试环境、已执行检查、截图和待真实设备复核的范围。

## 启动窗口闪退（已修复）

2026-10-22 实测原启动器使用 LF 换行时，Windows `cmd.exe` 会报命令语法错误。现已统一为 CRLF；任何正常或异常退出都会保留诊断窗口。维护 `.cmd` 时请保留 CRLF。自动端口回退也避免默认端口被其他工程占用时误开页面。

手动启动：在工程目录的 PowerShell 运行 `node scripts/serve-static.mjs --open`，按输出中的地址打开。窗口必须保持运行。若使用旧压缩包，请改用已更新的本地运行包。`node --test scripts/launcher.test.mjs` 可复核 Windows 双击等价入口，测试在其他系统跳过。
