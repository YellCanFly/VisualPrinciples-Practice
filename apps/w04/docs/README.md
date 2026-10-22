# 立体感知 · 空间实验室

> 2026-10-22：当前副本位于总工程 `apps/w04/`，统一开发与发布入口为[总工程 README](../../../README.md)。以下独立工程路径、启动器、运行包与部署说明保留为历史资料；后续更新提交到 `VisualPrinciples-Practice`。

工程直接位于 `W04-Practice/`。当前界面保留“深度线索”和“错位片场”，并以“反透视生成”替换“机位与焦距”。开发文档、截图与模型来源统一放在 `docs/`。

## 打开页面

安装 Node.js 22.14 或以上版本后，双击工程根目录 `启动实验室.cmd`。运行期间保留命令行窗口，按 Ctrl+C 停止。

默认从 `http://127.0.0.1:4173/` 开始，端口被占用时自动尝试 4174–4193，以窗口显示的实际地址为准。课堂分发请完整解压 `立体感知实验室-本地运行包.zip` 后再运行启动器；包中包含 `dist/`，无需重新安装开发依赖或联网加载模型。

也可在工程根目录执行：

```powershell
node scripts/serve-static.mjs --open
```

页面应通过 HTTP 服务访问。

## 三个模块

- **深度线索**：选择 A/B/C，调节目标距离、高度、相机横移；切换背景透视环境、地面、网格、阴影、雾和遮挡，或让目标在画面中等大。
- **错位片场**：调节球体距离，再横移观察机位，查看从正面相遇的形状如何分开。保留表面明暗与自阴影，“回到正面”恢复参考相机。
- **反透视生成**：选择内置模型或导入 FBX，设置视点方向、俯角、距离与模型旋转，查看平面变形图、指定视点效果和空间关系，并导出透明 PNG。

前两个模块继续采用基础滑块与开关。“查看空间”按需打开独立观察视图，重置只恢复当前模块。

## 反透视生成

内置几何体包括立方体、球体、圆柱、圆锥、圆环、圆环结、四面体、八面体和二十面体；参考模型包括 Stanford 兔子、Utah 茶壶与 Suzanne 猴头。模型资源随工程和运行包提供，来源与使用条件见 [模型来源](ASSET_CREDITS.md)。

操作顺序：

1. 选择模型，或从本机导入 FBX。
2. 调整指定视点及模型姿态。空间关系中可见眼位、虚拟模型、射线与实际画面平面。
3. 在“空间关系”点击“从指定视点看”，相机会到达生成图案的指定眼位。开关“显示虚像”检查模型轮廓与平面画是否重合；关闭后看到的只有平面图及地面网格。
4. 拖动或缩放可离开指定眼位，观察图案失真的过程；“空间总览”恢复侧面观察。“指定视点效果”始终从设定眼位观察平面画。
5. 选择导出分辨率，点击“导出透明PNG”。输出按实际画面平面的长宽比生成，透明区域不会写入网格、射线或背景。

FBX 以静态姿态与统一材质显示，并归一化尺寸。导入文件在当前会话内使用；切换模块可继续编辑，刷新页面后需重新导入。内置模型和眼位等参数保存于当前浏览器。

平面画只在指定眼位还原目标形状；观察方向、俯角和距离都需要匹配，仅朝相同方向看并不足够。停留在“从指定视点看”时，修改参数或模型会同步更新观察相机，拖动后恢复独立观察。

打印时保留 PNG 的长宽比例。若按比例缩小实际画面，观察位置也应按同一比例布置；普通正面观看会看到预先变形的图案。

原理与坐标约定见 [反透视实现说明](反透视生成_实现说明.md)。

## 开发、验证与构建

```powershell
npm ci
npm run dev
npm run typecheck
npm run test
node --test scripts/serve-static.test.mjs scripts/launcher.test.mjs
npm run build
npm run test:e2e
```

开发环境为 Node.js 22.14.0 / npm 10.9.2，依赖版本锁定在 `package-lock.json`。Windows 浏览器测试使用系统 Chrome；其他系统先运行 `npx playwright install chromium`。Windows 批处理入口测试在其他系统跳过。

运行包在完成构建与验证后，用 PowerShell 7 执行 `./scripts/package-local.ps1` 更新。

## 静态部署

当前独立仓库为 [YellCanFly/VisualPrinciples-W04-Practice](https://github.com/YellCanFly/VisualPrinciples-W04-Practice)，在线地址为 [GitHub Pages 实验室](https://yellcanfly.github.io/VisualPrinciples-W04-Practice/)。推送 `main` 后由 `.github/workflows/pages.yml` 自动测试、构建并发布；仓库 Pages 的发布来源使用 GitHub Actions。

Vite 使用相对资源路径，同一 `dist/` 支持根路径与仓库子目录。模拟子目录：

```powershell
node scripts/serve-static.mjs --port 4175 --base /stereo-perception-lab/
```

打开 `http://127.0.0.1:4175/stereo-perception-lab/`。本地服务只绑定本机地址，限制可读内容在 `dist/` 内。

`.github/workflows/pages.yml` 以 `W04-Practice` 为仓库根目录。若课程整体作为仓库，将工作流放在仓库根目录，设置 `defaults.run.working-directory: Footages/W04/W04-Practice`，并调整缓存锁文件和上传 `dist` 的路径。GitHub Pages 来源选择 GitHub Actions。

## 维护入口

- [开发记忆](DEVELOPMENT.md)
- [当前验证记录](VALIDATION.md)
- [模型来源与许可](ASSET_CREDITS.md)
- [反透视实现说明](反透视生成_实现说明.md)
- `VALIDATION-dpr-v1.md`、`VALIDATION-anamorph-v1.md`、`VALIDATION-depth-cues-v1.md` 与 `VALIDATION-full-v1.md` 保留先前版本的历史记录。

Windows 启动器须保持 UTF-8 无 BOM、CRLF，并在退出时保留诊断窗口。
