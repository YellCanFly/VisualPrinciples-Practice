# 三维模型来源与复现

本课程工程将模型保存在本地，网页运行、切换模型和导出图片均不需要访问模型网站。模型统一使用页面设置的颜色；内置资源和导入 FBX 的外部贴图不参与反透视绘制。

| 内置模型 | 来源 | 工程中的处理 |
| --- | --- | --- |
| 立方体、球体、圆柱、圆锥、圆环、圆环结、四面体、八面体、二十面体 | Three.js 0.186.1 内置 Geometry | 本地生成；统一最大尺寸为 2，中心为原点 |
| Utah 茶壶 | Martin Newell 的 Utah teapot；Three.js 的 [TeapotGeometry](https://threejs.org/docs/pages/TeapotGeometry.html) 实现 | 使用原始茶壶控制点生成，12 段细分，包含壶身、壶盖和底部 |
| Stanford 兔子 | Stanford Computer Graphics Laboratory；[Stanford 3D Scanning Repository](https://graphics.stanford.edu/data/3Dscanrep/)，经 [Three.js FBX 示例](https://github.com/mrdoob/three.js/blob/dev/examples/models/fbx/stanford-bunny.fbx) 提供 | 将真实 FBX 网格转换为二进制 PLY，合并重合顶点，不替换模型形状；15,258 顶点、30,338 三角形 |
| Suzanne 猴头 | Blender 内置 Suzanne，原作者 Willem-Paul van Overbruggen；[Blender 基元源码](https://github.com/blender/blender/blob/v5.1.2/source/blender/bmesh/operators/bmo_primitive.cc) | 用 Blender 5.1.2 后台独立进程生成，应用一级细分，转换为 Y 轴向上并导出 PLY；2,012 顶点、3,936 三角形 |

## 授权记录

- Three.js 及其茶壶实现采用 MIT 许可。许可副本随运行资源保存在 `public/models/LICENSE-THREE.txt`。
- Stanford 仓库允许研究使用和免费镜像、再分发，并要求标明 Stanford Computer Graphics Laboratory。商业使用及进入出售产品需要另行取得许可，具体以[仓库使用说明](https://graphics.stanford.edu/data/3Dscanrep/)为准。本工程中的兔子用于课程实验。
- Suzanne 基元的 Blender 源码标注 `GPL-2.0-or-later`。本工程保留该来源和许可：`public/models/LICENSE-SUZANNE.txt`；对应 Blender 5.1.2 的完整基元源文件保存在 `public/models/sources/bmo_primitive.cc`，生成步骤保存在 `scripts/prepare-anamorph-models.py`，运行包资源中也包含这份生成脚本。本工程没有将该模型标为 CC0 或自制原创模型。

## 文件与复现

- `public/models/stanford-bunny.ply`：760,815 字节。
- `public/models/suzanne.ply`：82,015 字节。
- `tests/fixtures/stanford-bunny.fbx`：保留来源 FBX 用于真实导入测试；不进入网页运行包。
- `scripts/convert-bunny.mjs`：在项目目录执行 `node scripts/convert-bunny.mjs`，从上述 FBX 重新生成 Bunny PLY。转换依赖工程已有的 Three.js。
- `scripts/prepare-anamorph-models.py`：使用 Blender 5.1.2 执行 `blender --background --factory-startup --python scripts/prepare-anamorph-models.py`，重新生成 Suzanne PLY。该独立进程只处理自己的空场景，不连接或改变用户打开的 Blender 场景。

导入 FBX 时应用 50 MiB 文件大小、25 万三角形的上限。网格以导入时的静态姿态烘焙世界变换，并归一化；本模块不播放动画。空模型、无效坐标和超过上限的模型会返回中文错误。FBX 文件名引用的外部图片地址被拦截，不会主动下载本地路径或网络贴图。
