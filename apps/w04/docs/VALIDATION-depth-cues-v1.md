# 简化版验证记录

日期：2026-10-22。此次根据用户要求精简操作面板与信息展示，以下结果来自当前基础交互版本。完整初版的测试记录已保存在 [VALIDATION-full-v1.md](VALIDATION-full-v1.md)，不作为当前界面的通过声明。

## 环境与结果

Windows，Node.js 22.14.0 / npm 10.9.2。浏览器为 Chrome / Chromium 155.0.8059.84，无头模式、SwiftShader WebGL2；桌面 1440×900、1920×1080、1024×768，移动触摸模拟 390×844。

| 检查 | 结果 |
| --- | --- |
| 数学与状态单元测试 `npm run test` | 34/34 通过 |
| 静态服务 `node --test scripts/serve-static.test.mjs` | 5/5 通过 |
| Windows 启动链路 `node --test scripts/launcher.test.mjs` | 2/2 通过 |
| 类型检查与构建 `npm run build` | 通过，输出当前 `dist/` |
| 当前基础交互浏览器回归 `npm run test:e2e` | 7/7 通过，约 36.0 秒 |

最终构建入口 `index-BsU_uCKk.js`，样式 `index-C3VYsw2S.css`；当前构建整体约 0.94MB，JS gzip 合计约 256KB、CSS gzip 约 4KB。Rollup 对 Zod 注释和 Three.js chunk 体积的提示不影响构建结果。

## 实际覆盖的行为

1. D09 距离滑块改变主图像素；网格开关只改变线索、不修改目标与拍摄相机；A/B/C 可选择，各模块保存独立参数，刷新恢复；重置当前实验不影响其他模块。
2. D09 “画面一样大”在改变目标距离后仍保持三个标准色卡的投影高度一致；退出后保留当前真实尺寸。
3. D10 球体从 18m 沿参考视线移至 30m，实际位置/尺寸变化但参考相机下的上、下、接触锚点投影保持；横移机位后几何冻结，回到正面只恢复相机。
4. D12 焦距和距离可分别编辑；开启“主体大小不变”后焦距只读，距离驱动焦距并保持主体投影高度；关闭锁定后可继续编辑。
5. 空间视图默认隐藏，展开后的拖动不改变拍摄实验。1440px 与 1024px 宽度下主图保持 16:9，页面无水平溢出。
6. 构建产物真实挂载在 `/stereo-perception-lab/`。阻断全部非本机网络请求后仍可加载、刷新恢复参数和操作三模块，无外部资源请求。
7. 390px 触摸模拟可切换模块、打开大小锁定、操作距离和展开空间，且无水平溢出。

当前页面不再渲染预设网格、测量表、误差地图、曲线、参数差异、A/B 快照、导入导出、分享、时间轴和密集投影标记。浏览器检查直接操作真实滑块/开关并读取实际保存状态；图像变化另用主图截图比较。

首轮曾发现 D12 精确可行距离下界与 HTML range 步长错位，导致输入整数时被吸附到 11.995714m 等值；已修复为向可行范围内舍入 UI 边界，重跑完整 7 项全部通过。底层精确几何约束不变。

## 视觉检查与截图

当前截图在 `docs/screenshots/`：

- `simple-desktop-1440x900.png` / `simple-desktop-1920x1080.png`：默认大画面、少量基础控制；1440×900 时主要操作无需滚动。
- `simple-d09.png`：修改后的深度线索场景。
- `simple-d10-front.png` / `simple-d10-side.png`：正面接触与侧移拆解。
- `simple-d12.png`：主体画面大小锁定后的镜头与机位。
- `simple-space.png`：按需展开的独立空间视图。
- `simple-mobile-default.png` / `simple-mobile-390.png`：窄屏默认和触摸操作。

已对上述代表图做目检。旧版截图仍保留，但不代表当前界面。

## 复核命令与边界

```powershell
npm run typecheck
npm run test
node --test scripts/serve-static.test.mjs scripts/launcher.test.mjs
npm run build
npm run test:e2e
```

Playwright 自动启动根路径 4180 和子路径 4181。HTML 报告在 `docs/playwright-report/`，失败 trace 在 `test-results/`。Windows 使用系统 Chrome，其他系统需先安装 Playwright Chromium。

本次前端变化未改动已修复的 UTF-8/CRLF Windows 启动器；真实批处理启动和错误诊断保留仍通过。默认端口被占用时自动使用后续空闲端口，不停止其他工程。

软件渲染和触摸模拟不能替代课堂真实显卡、投影仪清晰度、实际平板手感及长期内存观察。GitHub Pages 工作流已提供，本次未执行线上发布。

## 背景线索与错位片场光影追加

2026-10-22 按用户追加要求更新，最终构建入口为 `index-BsU_uCKk.js`。本次构建通过、数学与状态单元测试 34/34 通过，并在此最终构建完整运行浏览器回归 7/7（36.0 秒）。

- D09 新增“背景透视环境”（侧墙与门框）和“地面”开关，连同网格、阴影、雾、遮挡板共六项线索。实际点击会改变画面；目标与相机不变，反复开关和刷新保存正常。
- D10 主取景恢复受光材质、明暗层次与托架自阴影；球体 18m / 36m 的上、下、接触锚点投影保持，侧移时几何冻结，最远球体显示完整。
- 目检并修复阴影条纹；照明只作用于简化版 D10 主取景，切回其他模块恢复原设置。采用 1024 阴影贴图，无运行时外部资源。
- 1440×900 默认界面六项线索全部首屏可见，面板底部约 y=823，主图仍为16:9且无横向溢出。

本轮截图：`cues-desktop-1440x900.png`、`cues-d09-background-on.png` / `cues-d09-background-off.png`、`cues-d10-lit-18.png` / `cues-d10-lit-36.png`。另外 `d10-light-18.png` / `d10-light-36.png` 为最终光影局部目检图。
