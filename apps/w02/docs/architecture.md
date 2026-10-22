# 技术架构

## 统一课程工程（2026-10-22，迁移前决策）
- 本应用位于 `apps/w02/`，保持独立的 Vite root、依赖锁定、模型与状态管理；总工程将构建结果放到 `dist/w02/`。
- Vite `base` 使用 `./`，生产脚本、样式与本地图标相对于当前周目录解析，兼容本地与 GitHub Pages 的双层子路径。
- `Header` 以 `../` 链接课程首页，不绑定仓库名称或域名；不将不同周应用的全局 CSS 与 React 根混用。
- 总工程根工作流负责统一发布。本周 `.github/workflows/` 中的旧配置只作历史记录，以下独立部署章节保留历史背景。

更新时间：2026-10-07。第一阶段编码前决策。

## 技术栈与边界
React 19 + TypeScript + Vite；Three.js、React Three Fiber 9、drei；Zustand 管理教学状态；普通 CSS 构建中文响应式 UI，lucide-react 提供图标。核心无 SaaS、CDN、远程字体、远程纹理或运行时网络依赖。Node.js 22.14+。

## 静态部署（2026-10-07，配置前决策）
- Vite `base` 统一为 `/EyeVisPro/`，对应 `https://yellcanfly.github.io/EyeVisPro/`；开发与生产预览使用同一子路径。
- `.github/workflows/deploy.yml` 在 `main` 推送或手动触发时运行。构建任务使用 Node.js 22、`npm ci`、`npm test`、`npm run build`，仅上传 `dist/`。
- 部署任务依赖构建成功，在 `github-pages` 环境发布；仅部署任务授予 `pages: write` 和 `id-token: write`，源码访问保持 `contents: read`。
- GitHub Pages 使用 Actions 构建来源，不提交生成的 `dist/`，不增加应用运行时服务或远程模型依赖。
- 当前没有 URL 路由，模块切换保存在本地状态中，不需要服务端路由回退。

## 组件层级
App → Header / PrinciplePanel（原理和结构两个标签）/ EyeViewer / InfoPanel / AnimationControls。EyeViewer → Canvas → EyeModel + LightRaySystem + AnnotationLayer + CameraController + LabelProjector；ProjectedLabels 在 Canvas 外与主 React 树共享单层 DOM overlay。HTML 面板独立于 WebGL，局部渲染错误由中文回退界面承接。

## 状态管理
src/store/viewerStore.ts：selectedStructure、hoveredStructure、currentVisionStep、viewMode、showAnnotations、showLightRays、isAnimationPlaying、focusMode、ambientMode、cameraRevision、playbackRevision、animationProgress、autoAdvance。相机变更用修订号触发，运动在 useFrame/ref 内执行，进度只节流同步 UI。

## 坐标与模型组织
眼球中心 (0,0,0)，半径约 1.65；前端为 X 负方向，后端为 X 正方向；Y 向上；Z 正半球为剖切移除区域。观察物体 X≈-3.6，角膜 X≈-1.72，虹膜 X≈-1.3，晶状体 X≈-1.03，视网膜 X≈1.55，视神经延伸到 X≈2.8。
EyeModel 第一阶段由球壳、环、双凸椭球和管构成。独立命名各结构 Mesh，模型名称映射由 eyeStructures.ts 输出。未来 GLB 放在 public/models/eye，通过映射接入同一状态与数据系统。

## 完整 / 半剖模式：方案 B
使用独立结构 Mesh 与程序生成半球几何，在 full/cutaway 切换不同几何可见性。剖视去除面向相机的 Z 正半球，显示多层球壳切缘与内部结构。选择 B 是因为没有正式 GLB，几何可离线生成、可靠显示切缘、没有 clipping 端盖问题；不引入双套外部模型资源。之后 GLB 可按命名隐藏切面 Mesh，仍保持 Viewer 接口。

## Picking 与高亮
R3F Raycaster 派发 Mesh 点击 / hover，统一按结构 ID 读取数据，stopPropagation 避免后层抢选。hover 轻度材质高亮，selected 或 relatedStructures 加强 emissive。外层透明玻璃体不抢占内部结构事件。未知映射不崩溃。

## Annotation
annotations.ts 定义结构 ID、三维锚点、标签偏移。EyeViewer 在同一 React 树中维护单层 HTML overlay；Canvas 内 useFrame 将世界坐标投影到 DOM ref 的 transform，并保留世界空间连线。相机变更时标签自动跟随，不逐帧更新 React 状态。full 模式隐藏内部标签与成像字幕，避免将遮挡的内部像点误标到外壳。避免渲染不存在结构，标签点击与 Mesh 点击共用选择动作。

## 光线路径
LightRaySystem 独立于模型，路径在 src/utils/optics.ts 中生成。折线 / TubeGeometry 表达物体→角膜→瞳孔→晶状体→视网膜。两组示意光线分别对应物体上/下端并反向落在视网膜下/上端；far 使用接近平行入射、near 使用更发散入射。角膜与晶状体处改变传播方向。光线通过虹膜开口。隐藏光线同时隐藏光点与成像箭头。

## 动画
useFrame 在复用的 Mesh ref 上更新光点和视神经脉冲，播放 / 暂停 / 重播受 store 控制。六个步骤限定动画阶段、关联结构与中文说明。进度节流同步，暂停保留当前时间，结束后停止或按 autoAdvance 进入下一步骤。晶状体厚度与虹膜内径随远近 / 明暗模式平滑变化。

## 相机与自适应
OrthographicCamera + OrbitControls，旋转、滚轮缩放、右键平移。依据 Canvas 尺寸适配宽高与缩放；full 使用可看到虹膜的前侧视角、cutaway 使用剖面侧视角。重置 / 教学步骤选用 cameraPreset，过渡阻尼并在正常交互时不锁定相机。

## 文件目录
- docs/：需求、架构、长期记忆。
- public/models/eye/：正式资产接入口与说明；暂无 GLB。
- src/components/viewer/：WebGL、模型、光线、标注、相机、错误边界。
- src/components/layout/、controls/、ui/：中文页面与操作组件。
- src/data/：结构、步骤和标签。
- src/store/：统一状态。
- src/types/：共享数据类型。
- src/utils/：光线路径与模型映射工具。
- tests/：有意义的光学与状态验证（如实现），避免低价值镜像测试。

## 性能与错误处理
DPR 最高 1.75；几何 useMemo；无每帧 React setState；Canvas 资源由 R3F dispose。程序模型无需网络加载；Canvas fallback、ErrorBoundary 和上下文丢失消息为中文。未来 GLB 接入需 Suspense、加载失败处理、映射验证。开发阶段检查 tsc、生产构建、浏览器 Console、关键交互与窄屏。

## 感光细胞模块（2026-10-07，编码前决策）
- 眼球地标统一为 src/data/eyeLandmarks.ts；Z 正方向定义为示意眼的鼻侧。视盘位于中央凹鼻侧、略偏上，同步视神经模型、脉冲路径与分布图锚点，纠正第一阶段视盘在黄斑下方的粗略放置。
- 使用独立 explorationMode（vision / photoreceptors），原眼球结构 ID 与 Mesh 映射保持稳定。新增局部/整体视图、区域、细胞选择、视网膜隔离和三档教学光照状态。
- src/data/photoreceptors.ts 保存中文知识、来源、区域世界锚点、配色及数量；photoreceptorAnnotations.ts 独立保存局部标签锚点与部位名称；src/utils/photoreceptors.ts 保存定性分布采样与贡献教学映射。分布点和放大细胞均为本地程序几何，无外部资产。
- 分布使用确定性抽样；中央凹中心不采样视杆、视盘不采样任一种细胞。点密度仅展示趋势，避免误称真实细胞密度图。局部区域用代表细胞展示形状，数量用独立比例条说明。
- EyeViewer 按模式显示 EyeModel / PhotoreceptorSystem；整体模式可仅保留视网膜，局部模式隐藏整体眼球、原光线和原标注。保持一个 Canvas、一个 DOM 标签层，不使用 drei Html 独立根。
- CameraController 新增分布/局部相机预设，切换与重置恢复适合的取景；细胞材质响应在 useFrame/ref 中阻尼更新，无逐帧 React 状态更新。
- UI 与三维模块分离，来源链接属于可选在线查阅，教学主体无需网络。细胞模式暂停六步骤时钟，返回保留原进度，原理/结构动作退出细胞模式。

## 浏览器联调决策
使用 Vitest 5 验证教学状态边界和光学约束。初次联调发现 drei Html 为标签创建独立 React root，Canvas 事件容器连接导致 Html target 变化，其 layout effect 清理同步 unmount 子 root，在 React 提交中产生 Console 错误。去除入口 StrictMode 仍复现，确认不是 StrictMode 根因。因此改用同一 React 树内的单层 HTML overlay + 世界坐标投影，加载提示也置于 Canvas 外；不修改第三方依赖或屏蔽日志。最终恢复入口 StrictMode，保留显式 Three.js 资源清理，并验证切换与重载。远近晶状体 X 半厚度为 .18 / .25，近距前表面仍处于虹膜平面之后。玻璃体透明壳不参与射线命中，避免抢占视网膜选择。
