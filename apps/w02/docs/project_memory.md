# 项目长期记忆

## 2026-10-22 统一课程工程迁移
- 当前源码副本位于 `VisualPrinciples-Practice/apps/w02/`；原独立工程保留。
- 已先补充需求与架构记录，再将 Vite 基址改为 `./`，顶部增加相对 `../` 的“课程首页”链接，并适配窄屏显示。
- 总工程统一生成 `/w02/` 页面和发布产物；开发、提交、发布以 `../../README.md` 为准，旧部署章节与嵌套工作流仅作历史参考。
- 教学模型、光路、动画和状态管理保持原有实现；此迁移的构建、单元测试及浏览器验收由总工程统一执行并记录。

更新时间：2026-10-07（用户所在时区：Asia/Shanghai）

## 当前项目状态
**第一阶段与视锥 / 视杆细胞交互扩展已完成。** 在中文眼球模型、六步骤、结构选择、标注与远近明暗调节基础上，增加整体分布、局部细胞形态与定性视觉贡献教学。

## 2026-10-07 GitHub Pages 部署
- 用户已要求完成必要调整、推送 GitHub 并部署到 GitHub Pages；仓库为 `YellCanFly/EyeVisPro`，公开仓库、默认分支 `main`。
- Vite `base` 为 `/EyeVisPro/`，开发与预览同样使用子路径；目标线上地址为 `https://yellcanfly.github.io/EyeVisPro/`。
- 新增 `.github/workflows/deploy.yml`：Node.js 22、`npm ci`、`npm test`、`npm run build`，构建成功后发布 `dist/` 到 `github-pages`。支持 `main` 推送与手动触发，仅部署任务有 Pages 写入和身份令牌权限。
- 本地验证：3 个测试文件、15 项测试通过，严格 TypeScript 与生产构建通过；子路径产物的 JS、CSS、favicon 路径正确，浏览器眼球场景正常，Console 无 error / warn。Three.js 约 704KB 的既有构建提示不影响发布。
- 当前无 URL 路由或运行时远程资产依赖，无需额外路由回退；正式模型尚未接入，未来本地资产加载须使用 `import.meta.env.BASE_URL`。
- 远端已启用 Actions 发布与强制 HTTPS，配置已推送 `main`。首次运行 `37568147094` 构建、测试和部署成功，线上首页与全部脚本、样式、图标返回 HTTP 200。
- 根据首次 CI 的 Node.js 20 弃用提示，部署 Actions 更新为官方 Node.js 24 运行时版本：checkout v7、setup-node v7、configure-pages v6、upload-pages-artifact v5、deploy-pages v5；应用构建仍使用 Node.js 22。最终部署提交 `11921fe`，Actions 运行 `37568270948` 的构建与发布均成功，Node.js 20 弃用提示已消除。
- 线上 Chrome 验收通过：默认半剖眼球、完整眼球切换、感光细胞模块、局部放大及暮光交互，三维场景和中文说明正常，Console 无 error / warn；最终版本重新加载正常。后续推送 `main` 会自动测试、构建并发布。

## 2026-10-07 感光细胞扩展
- 第三导航标签“感光细胞”：选择中央凹中心 / 周边视网膜 / 视盘，单独看视锥、视杆或两者。
- 整体半剖眼球显示抽样分布与区域标记，可仅保留视网膜；双击区域或使用按钮放大局部。
- 局部显示外节、内节、胞体、突触端、色素上皮和玻璃体侧；典型周边视锥外节渐细、视杆长柱。中央凹画细长视锥并省略普通厚神经层；视盘无两类细胞，展示纤维出口。
- 独立明亮 / 暮光 / 暗光教学条件；材质在 useFrame/ref 中阻尼变化，颜色/细节图案为全眼定性感知趋势。暗光假设仍有微弱光线且已暗适应，完全无光不能看见。
- 中文功能/形态比较、数量比例条约1:20、可展开的科学资料链接。数量采用 Curcio 等（1990）单眼样本均值：视锥460万、视杆9200万，注明个体差异。研究/教材有不同估计，详见 photoreceptor_science.md。
- 排除中央凹中心视杆及视盘两类细胞，密度显示趋势而非实测地图；模型点数、配色、尺寸、角域、亮度贡献均为教学编码。
- 进入模块暂停六步骤，保存视图与进度；退出后保留进度和光线/标签偏好，不擅自继续播放。原理、结构或重播动作正确恢复眼球场景。
- 统一 eyeLandmarks.ts：Z正定义为鼻侧；视盘位于中央凹鼻侧略上，修正初版下方出口，同步视神经模型、神经脉冲与区域锚点。神经信号路径独立于光线路径。
- 新增 data/photoreceptors.ts、photoreceptorAnnotations.ts、eyeLandmarks.ts，utils/photoreceptors.ts，viewer/PhotoreceptorSystem.tsx，以及 photoreceptors/ 内三个 UI 组件；数据、模型、动画、UI分离，维持单Canvas/主树DOM标签，无远程运行依赖。
- 新增 tests/photoreceptors.test.ts：分布禁区、鼻颞/上下关系、模式边界与进度/偏好恢复；最终3个文件、15项测试通过。生产构建通过，仍有既有Three.js核心包超过500KB提示，无构建错误。
- 本地Chrome开发页面实际验证：整体/局部、两类筛选、中央凹视杆空态/细长视锥、视盘无细胞/出口、旋转/重置、视网膜隔离、双击投影标注放大、三档光照、来源链接展开；Console无error/warn。1366×768页面宽1366、高768，无溢出，细胞局部stage约358px，侧栏可内部滚动。
- 浏览器回归：第5步暂停17%，进入细胞模块再返回仍17%，完整眼球模式恢复；第6步说明与神经出口同步。
- 最终生产预览 http://localhost:4173/ 已验证两种视图、暮光、视网膜隔离、直接点击三维视锥与数量条，Console无error/warn；1614×977默认窗口无横向溢出。分布相机略从前侧观察内壁，使中央凹/视盘位置更容易辨认。docs/photoreceptor_preview.jpg 与 photoreceptor_distribution.jpg 保存本次生产预览。

## 技术栈
- React / React DOM 19.3、TypeScript 5.9、Vite 7.3。
- Three.js 0.180、React Three Fiber 9.8、drei 10.7。
- Zustand 5、CSS、lucide-react 本地图标。
- Vitest 5：光学与教学状态约束测试。
- Node.js 22.14.0 / npm 10.9.2 已在当前环境验证；package-lock.json 锁定安装版本。
- 无后端、SaaS、CDN 字体、远程纹理或运行时外部资产依赖。

## 已完成模块
1. 全中文三栏工作台：顶部品牌 / 操作帮助、左侧原理与结构标签、中间 3D、右侧说明、底部六步进度与播放控制。
2. React Three Fiber Canvas、灯光、OrbitControls、阻尼相机、动态适配及重置。
3. 本地程序 Demo Eye 十结构：角膜、虹膜、瞳孔、晶状体、睫状体、玻璃体、视网膜、黄斑、巩膜、视神经。
4. 完整 / 半剖模式，多层球壳切缘、虹膜放射纹理、外部血丝、双凸晶状体、视神经纤维。
5. Mesh 点击、Hover 和选中高亮，结构列表与三维选择同步；内部结构选择自动切剖视。
6. 五个结构标注，世界空间连线、DOM 位置逐帧投影；标签支持选择与隐藏。
7. 独立光线路径，双色上下物点光束、角膜和晶状体折向、视网膜反向缩小箭头。
8. 六步骤动画、播放 / 暂停 / 重播、上一步 / 下一步、自动推进；视神经紫色脉冲。
9. 远近物体与晶状体厚度平滑变化，明暗与虹膜中央开口变化。
10. 原生中文帮助弹窗、Esc 与焦点约束、Tab 方向键导航、WebGL 错误边界与上下文中断提示。
11. 桌面 / 笔记本适配；较矮桌面布局保持动画控制在屏内，说明和导航可内部滚动。
12. README、模型接入口说明、AGENTS 开发约定、需求与架构文档。

## 关键技术决策
- 模型暂为程序几何，**没有正式 GLB**；public/models/eye/ 为资产接入口，不会请求不存在的模型。
- 剖视方案 B：独立结构 + 不同半球几何，而非 clipping plane；切除 Z 正半球，保留可见的球壳切缘。
- X 负为前端、Y 向上、眼球半径约 1.65。角膜 X=-1.72、虹膜=-1.3、晶状体=-1.03、视网膜像平面约1.55。
- 晶状体沿 X 半厚度：far=.18 / near=.25；近距最前表面 -1.28，仍位于虹膜之后，避免几何重叠。
- 明亮 / 较暗瞳孔半径 .23 / .38。瞳孔是真实开口，没有遮挡光线的实心黑盘。
- 标注使用主 React 树中的单层 DOM overlay；Canvas 内 LabelProjector 用 ref 投影，保留三维连线。未采用 drei Html，因为其独立 root 清理在本环境产生 Console 错误。
- 入口保留 React StrictMode；几何显式释放。所有运动在 useFrame / ref 内执行，仅10Hz同步进度。
- 模型映射、结构说明、步骤和标注独立于界面；未来替换 GLB 保持结构 ID、store 和 UI 接口。

## 页面与文件结构
- src/App.tsx：页面组合；main.tsx 为入口，styles.css 为响应式样式。
- src/components/layout/：Header、PrinciplePanel（包含结构标签）、InfoPanel。
- src/components/controls/：ViewControls、ContextControls、AnimationControls。
- src/components/ui/HelpDialog.tsx：中文原生操作帮助。
- src/components/viewer/：EyeViewer、EyeModel、LightRaySystem、VisionAnimation、CameraController、AnnotationLayer、ProjectedLabels、SelectionHighlight。
- src/data/：eyeStructures.ts、visionPrinciples.ts、annotations.ts。
- src/store/viewerStore.ts；src/types/index.ts；src/utils/optics.ts。
- tests/：optics.test.ts、viewerStore.test.ts。
- public/models/eye/README.md：资产命名与替换流程；public/favicon.svg 本地图标。
- docs/：requirements.md、architecture.md、project_memory.md、preview.png。
- 根目录：README.md、AGENTS.md、package.json、package-lock.json、index.html、Vite/TS/Vitest 配置。
- dist/ 为已验证的生产构建产物，node_modules/ 与 dist/ 均忽略提交。

## 当前光线模拟
optics.ts 生成分段直线路径；角膜与晶状体处弯折，角膜→瞳孔→晶状体段保持共线，瞳孔不是折射面。每个物体端点有一组同源光线，全部汇聚到单一反向视网膜端点；不同端点对应不同像点。far 入射角范围更小，near 更发散；物体图标距离不按实际物距比例。暗光显示更多代表性光线，但两种模式均通过实际瞳孔开口。
TubeGeometry 表达静态及激活路径，按累计路径长度采样光点，保留折角。示意路径不是严格物理 Ray Tracing。

## 当前支持的视觉原理与动画
1. 光线进入眼睛：外界物体到角膜。
2. 角膜折射：角膜前后方向改变。
3. 瞳孔控制进光量：前侧相机、虹膜开口与环境调节。
4. 晶状体聚焦：远近条件、屈光示意与晶状体厚度变化。
5. 视网膜成像：两束光落于反向端点，显示倒立缩小箭头。
6. 视觉信号传递：单独紫色脉冲沿视神经，明确传递的是神经信号。
每步有独立 duration、相关结构、相机预设与中文短说明。暂停保持当前ref时间；重播清零；连续播放抵达末步停止；隐藏光线与标注不终止教学时钟。

## 已解决的重要问题
- 瞳孔透明点击目标原缩放方向错误，会抢虹膜；修正局部缩放轴。
- 透明玻璃体抢视网膜事件：玻璃体壳不参与 raycast，通过列表仍可选择。
- 完整模式透明角膜抢虹膜：角膜只在边缘拾取，中央透视区可点击虹膜/瞳孔，角膜仍有标签入口。
- 近距晶状体穿入虹膜：调整半厚度而保留坐标。
- 二维 SVG 光束穿过实体虹膜：改为穿中央开口。
- Canvas 初始连接后六个 Html 子 root 同步清理产生 React Error：替换全部 Html 为单层投影标注；恢复 StrictMode 后重新加载 Console 无错误。
- Html 不继承 group.visible 造成隐藏光線后字幕残留：DOM overlay 根据 showLightRays 条件渲染。
- 完整眼球不显示被遮挡的内部成像字幕，避免将像点标到外壳。
- 相机未读取步骤 front 预设、重置未恢复 zoom：现读取步骤 / 选择，并按修订号重置 fitZoom。
- 低高度桌面动画控制在屏外：改为100dvh弹性工作台与内部滚动。
- 早期测试依赖 audit 有提示：升级 Vitest 5，最终完整 npm audit 为0漏洞。

## 验证结果
- npm install：成功。
- npm test：**2个文件，11项测试通过**。覆盖真实瞳孔口径、同源会聚、倒立缩小像、瞳孔不折射、近远发散差异、明暗光线数量、路径采样与状态边界。
- npm run build：成功，包含严格 TypeScript 检查。Three.js 核心单块约704KB（gzip181KB）触发 Vite 默认500KB大小提示，属于本地三维依赖体积，无构建错误。
- npm audit：**0漏洞**。
- 开发浏览器 Console：新加载及旋转、缩放、重置、步骤与条件切换后无 error / warn。
- 生产预览 http://127.0.0.1:4173/：页面和三维模型加载成功，Console 无 error / warn。
- 1920×1080、2560×1440、1366×768：无页面横向溢出；1366×768页面高768，动画控制下边界约716，核心操作在屏内。
- 浏览器验证：完整 / 剖视、直接点击三维虹膜、内部晶状体选择、远近与明暗、标注 / 光线隐藏、暂停进度保持61%、帮助弹窗与Esc、相机旋转与标签跟随、滚轮缩放与重置。
- 连续播放实际从第5步推进第6步，结束进度100%、播放状态停止、下一步禁用。
- docs/preview.png 为生产版1920×1080视网膜成像预览。

## 当前已知限制
- 程序模型、光路与速度仅教学示意，无临床资产或严格物理计算。
- 正式 GLB 加载、资产许可验证、模型替换适配属于后续任务；当前未宣称已实现 GLB loader。
- 无疾病成像、镜片矫正、双眼视觉、独立盲点测试或完整大脑模型；细胞模块已说明视盘形成生理盲点。
- 移动端有基础堆叠适配，但本次验收重点为桌面和笔记本。
- Viewer 在不支持 WebGL / 图形上下文失败时给中文提示，正文面板保持可用；未在真实无GPU设备上验收。

## 下一阶段建议
1. 如需更真实解剖效果，选择有明确授权的分结构 GLB，记录许可和坐标并接入模型适配层。
2. 根据正式模型调整标注、剖面切缘和光学交点，保持现有数据与UI。
3. 增加循序教学引导与每步专用演示细节，之后再按用户需求加入近视/远视/矫正镜片。

## 用户重要需求变化
2026-10-07：用户要求从本地静态工程扩展为 GitHub Pages 发布，补齐子路径与自动部署、推送远端并完成线上验收；保留本地与离线教学边界。
2026-10-07：用户要求新增视锥 / 视杆细胞可视化，比较感光、形状与数量，建立整体分布与局部放大的对应，并检索验证知识。需求先写入 requirements.md，架构先记录后编码，科学来源与限制另存 photoreceptor_science.md。
