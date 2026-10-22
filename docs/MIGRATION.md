# W02–W04 整合说明

迁移日期：2026-10-22（Asia/Shanghai）。

## 来源与边界

新仓库为 `YellCanFly/VisualPrinciples-Practice`，本地目录为课程 `Footages/VisualPrinciples-Practice/`。迁移读取原仓库当前 `main`，将源文件复制到各周子目录；未移动、删除或覆盖原仓库及原本地工程，也没有嵌入原仓库的 `.git/`。

| 来源仓库 | 来源提交 | 新位置 |
| --- | --- | --- |
| `YellCanFly/VisualPrinciples-W02-Practice` | `1e0abe45cd6592e522b07cc7dafb571a10afc81d` | `apps/w02/` |
| `YellCanFly/VisualPrinciples-W03-Practice` | `ecd944428689d7c35854bf292a46c4435dd802e4` | `apps/w03/` |
| `YellCanFly/VisualPrinciples-W04-Practice` | `a9036d8ad771221d6089e17fcd053b7e3c72ece4` | `apps/w04/` |

[migration-sources.json](migration-sources.json) 记录精确来源、初始复制文件数量和排除项。新仓库形成独立提交历史；原有历史继续保存在原仓库。

## 保留的内容

- 每周完整应用源码、类型定义、测试、锁文件及开发文档。
- W02 程序几何眼球、光线与感光细胞教学系统及其来源说明。
- W03 本地字体、字形覆盖表、字体许可、画布与分析逻辑。
- W04 内置模型、模型准备脚本、来源及许可、测试用 FBX、反透视实现与历史验收截图。

W04 原仓库跟踪的 `dist/` 和 `立体感知实验室-本地运行包.zip` 是可重新生成的产物，本次不复制到新仓库。对应源码和资源仍完整保留；总工程统一生成新的 `dist/`。`node_modules/` 和本地测试输出不纳入版本管理。

## 集成方式

首页由 `config/weeks.json` 生成课程入口；各周仍是完整独立页面。根脚本管理安装、开发、测试与构建，最终输出 `dist/w02/`、`dist/w03/`、`dist/w04/`，与首页一起部署。

保留各周依赖版本和锁文件，避免迁移时同时升级 React、Three.js、Vite 等依赖引入额外变化。源码与资源路径采用相对路径或 Vite `BASE_URL`，适配 `/VisualPrinciples-Practice/wXX/`。W02 原 `/EyeVisPro/` 固定前缀改为适合新目录的相对前缀。

各周增加课程首页入口；存在延迟自动保存的页面在离开前保存当前状态。每周内部原有操作流程和路由独立保留。

唯一生效的发布工作流是根 `.github/workflows/pages.yml`。`apps/wXX/.github/workflows/` 与原部署示例保留供追溯，其旧仓库发布说明属于历史上下文；新工程维护与发布以根 README 为准。

## 浏览器数据

W03 继续使用 `w03-design-lab-v2` IndexedDB 数据库。同一浏览器配置、同一协议和域名下，原 GitHub Pages 与新入口可以访问相同作品库。localhost 与 GitHub Pages 不同源，其他浏览器和设备也不会共享该库。可使用 W03 的 JSON 导出和导入备份、迁移作品。

W04 的 localStorage 键包含页面 pathname，因此新旧地址的实验参数独立保存。新入口不会自动覆盖或读取旧路径的设置；如需重现某次实验，可在旧页面查看参数后在新页面设置。当前简化界面没有通用 JSON 设置迁移按钮。反透视内置模型参数可在当前路径保存，本机导入的 FBX 只保留在当前会话，刷新后仍需重新导入。

本次整合不迁移浏览器之外的个人数据；所有教学页面继续在浏览器中运行。

## 验证范围

根 `check` 检查注册表与目录，`test` 执行每周单元测试，`build` 完成每周类型检查与统一产物构建，`verify:dist` 检查仓库子路径下的构建资源。

浏览器验收应覆盖首页导航、每周核心交互、返回前保存、窄屏、字体与模型加载以及 Console。实际执行结果以本次验收记录或对应 GitHub Actions 运行为准；原应用文档内的既有测试数字和截图是原版本历史记录。
