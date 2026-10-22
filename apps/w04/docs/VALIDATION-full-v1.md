# 验证记录

日期：2026-10-22。此文件仅记录实际执行结果，未列为通过的项目不能视作已验收。

## 环境

- Windows 本地工程。
- Node.js 22.14.0，npm 10.9.2。
- 系统 Chrome / Chromium 155.0.8059.84，无头模式，SwiftShader WebGL2。
- 主桌面验证 1440×1000，另检 1440×900、1024×768、390×844；移动端包含触摸事件模拟。

## 已执行

| 检查 | 命令 / 方法 | 结果 |
| --- | --- | --- |
| 独立静态服务器 | `node --test scripts/serve-static.test.mjs` | 5/5 通过 |
| 数学与状态单元测试 | `npm run test` | 核心 28 项 + 状态存储 6 项，共 34/34 通过 |
| TypeScript 与静态构建 | `npm run build` | 通过；输出完整 `dist/` |
| 最终完整浏览器回归 | `npm run test:e2e` | 15/15 通过，耗时约 1.2 分钟；覆盖最终冻结构建 |

静态服务器测试实际检查：子路径主页和相对 JS、HTML/JS MIME、HEAD 空正文、尾斜线重定向、缺失资源 404、拒绝写入方法、非法编码、空字节、隐藏文件、路径穿越和 Windows 分隔符。

浏览器实际验证模块独立状态、单次撤销、线索开关不改变几何；D10 机位观察冻结几何、保留参考相机，0.1m 横移显示 20.74 参考像素，误差地图恢复参考朝向和焦距；D12 12m 距离派生 70mm 且主体占比 57.61%，时间轴重复定位相同；A/B 位图冻结、分割线、恢复可撤销；分享恢复、窗口 resize、独立观察、空间对象手柄、锚点拖动 Esc 取消、触屏替代控件。

导出实际检查 PNG 文件签名和三种尺寸：主图 1920×1080、主图＋空间 1920×1660、A/B 并排 2560×720。JSON 全量导出、修改后的导入恢复、撤销导入和拒绝未知版本均通过。空格播放/暂停会提交最终姿态到本地存储，刷新保持同一姿态。D12 裁切预设自动保存 35mm/70mm 快照，2×中央裁切、恢复 A/B 的焦距分别验证。D10 在当前 70mm、参考 35mm 条件下拖动锚点跟随当前图像指针，参考相机未改变。

子路径测试实际通过 `/stereo-perception-lab/` 挂载 `dist`，阻断所有非本机网络请求后可重载并操作三模块，无外部资源请求。此检查验证离线资源自足，未通过拔除本机网卡进行物理断网。

最终产物约 1.00MB（未压缩），JS gzip 合计约 268KB，CSS gzip 约 7.5KB。最终 JS 入口为 `index-JdkIi2M8.js`，CSS 为 `index-DSY23LOZ.css`。构建提示 Three.js chunk 超过 500KB（未压缩）和 Zod 注释标注被 Rollup 移除，未影响构建结果。

## 着色与几何依据

已核对本地锁定 Three.js 0.186.1：`fog_vertex` 使用 `-mvPosition.z`，`fog_fragment` 为 `1 - exp(-ρ² × depth²)`。D09 雾透过率 `exp[-(ρD)²]` 采用同一光轴深度定义，是模型值。

屏幕视觉与离屏图像使用同一解析实验状态和 Three.js 输出变换；本地截图见 `screenshots/`。自动化 PNG 检查不等于逐像素颜色验收，代表图另作人工目检。

WebGL 异常降级已实际检查：用 Chrome `--disable-webgl` 启动，页面显示中文 WebGL2 说明、静态 SVG 和重试按钮；参数及计算读数继续工作，文件菜单成功下载 `stereo-lab-all.json`。截图 `screenshots/final-webgl-fallback.png`。

## 可重跑检查与截图

```powershell
npm run typecheck
npm run test
node --test scripts/serve-static.test.mjs
npm run build
npm run test:e2e
```

Playwright 自动启动根路径端口 4180、子路径端口 4181；Windows 使用系统 Chrome。其他系统先安装 Playwright Chromium。HTML 报告在 `docs/playwright-report/`，失败时的截图与 trace 在 `test-results/`。

代表截图：D09 深度线索、D10 参考正面与侧移、D12 6m/35mm 与 12m/70mm、A/B 分割、390px 窄屏。另有 `render-*.png` 离屏导出检查图；对应 `scripts/render-qa.mjs` 与 `scripts/render-ui-qa.mjs` 需开发服务 `http://localhost:5173`。

## 需要真实设备复核的范围

- 课堂投影仪和低性能显卡上的清晰度、流畅度；无头软件渲染不代表课堂显卡帧率。
- 真实平板/触屏拖动手感、不同浏览器与驱动的 WebGL2 行为。
- 长时间连续演示的内存走势与稳定性。
- GitHub Pages 实际发布结果；本次不创建仓库或发布线上版本。

上述通过结果来自代码冻结后的最终构建与完整回归；课堂实际设备条件仍需按本节复核。

## 2026-10-22 启动器修复复核

- 原 `.cmd` 使用 LF 换行，经 `cmd.exe /d /c .\启动实验室.cmd` 真实执行复现 `The syntax of the command is incorrect.`；规范为 CRLF 后消失。
- Windows 启动器改为所有退出路径保留诊断，并传回实际退出代码；`.gitattributes` 固定 `.cmd` 的 CRLF。
- 默认 4173 被另一个工程占用时，服务自动改用 4174；实际请求返回 HTTP 200，页面标题确认为本实验室，而非占用原端口的其他工程。
- 原有静态服务测试 5/5 通过。网页源代码和已验证的 `dist` 未更改。- 新增真实 Windows 启动链路测试 `node --test scripts/launcher.test.mjs`，2/2 通过：中文路径批处理启动、持续监听和正确页面；非法端口诊断保留、确认后返回错误码 1。测试仅清理自己创建的临时进程树。
