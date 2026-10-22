# VisualPrinciples-Practice

视觉原理课程的统一交互实验工程。课程首页汇集每周实践，全部源码、字体、模型、许可和开发文档保存在同一个仓库；后续课程直接在这里扩展。

- [GitHub 仓库](https://github.com/YellCanFly/VisualPrinciples-Practice)
- [课程首页](https://yellcanfly.github.io/VisualPrinciples-Practice/)

| 周次 | 实验内容 | 源码 | 页面 |
| --- | --- | --- | --- |
| W02 | 眼球结构、视觉形成、视锥与视杆细胞 | [apps/w02](apps/w02) | [进入实验](https://yellcanfly.github.io/VisualPrinciples-Practice/w02/) |
| W03 | 设计四原则、自由画布、画面分析与作品管理 | [apps/w03](apps/w03) | [进入实验](https://yellcanfly.github.io/VisualPrinciples-Practice/w03/) |
| W04 | 深度线索、错位片场与反透视生成 | [apps/w04](apps/w04) | [进入实验](https://yellcanfly.github.io/VisualPrinciples-Practice/w04/) |

## 本地打开

需要 **Node.js 22.14 或更高版本**及 npm。安装依赖需要联网；页面主体、字体和内置模型随工程提供。

在本工程根目录双击 `启动课程.cmd`：已有 `dist/` 时直接启动，首次运行缺少构建产物时会先安装依赖并构建，然后打开课程首页。运行期间保留终端窗口，按 Ctrl+C 停止。网页通过 HTTP 服务打开，不直接双击 HTML。

开发时在本工程根目录运行：

```powershell
npm run setup
npm run dev
```

打开 [本地课程首页](http://127.0.0.1:5173/)。一个命令同时启动首页和已注册的各周页面，统一从首页进入。已有依赖且依赖文件没有变化时，后续只需 `npm run dev`。

如果 5173 端口已被其他应用占用，可运行 `npm run dev -- --port 5180`，从 `http://127.0.0.1:5180/` 进入，无需停止其他应用。

如果 5173 端口已被其他应用占用，保留该应用运行，为课程首页指定另一个端口：

```powershell
npm run dev -- --port 5180
```

随后打开终端显示的地址，例如 `http://127.0.0.1:5180/`。

## 检查与构建

```powershell
npm run check
npm test
npm run build
npm run verify:dist
npm run preview
```

- `setup` 安装根工程和各周应用的依赖；有锁文件时执行 `npm ci`，新应用没有锁文件时执行 `npm install` 并生成锁文件。
- `check` 检查课程注册表与应用目录。
- `test` 运行各周已有单元测试。
- `build` 构建首页及全部已注册应用，各周构建包含自身 TypeScript 检查，最终输出统一的 `dist/`。
- `verify:dist` 检查构建结果在真实仓库子路径 `/VisualPrinciples-Practice/` 下的资源访问。
- `preview` 在 [本地预览地址](http://127.0.0.1:4173/) 提供构建结果。

各周原有浏览器测试保存在应用内部，可按对应 README 单独运行。单元测试、资源检查和浏览器交互验收的覆盖范围不同，不应互相替代。

## 工程组织

```text
VisualPrinciples-Practice/
├── index.html                 课程首页
├── src/                       首页脚本与样式
├── public/                    首页预览图等共享静态资源
├── config/weeks.json          每周应用注册表
├── apps/
│   ├── w02/                   完整 W02 应用、资源及文档
│   ├── w03/                   完整 W03 应用、资源及文档
│   └── w04/                   完整 W04 应用、资源及文档
├── scripts/                   统一安装、开发、构建与验证
├── docs/                      扩展与迁移说明
├── .github/workflows/pages.yml
└── dist/                      构建生成，不提交
    ├── index.html
    ├── w02/
    ├── w03/
    └── w04/
```

每周保留各自的 `package.json`、`package-lock.json`、Vite 配置与测试，兼容现有依赖版本。根脚本读取同一注册表组织开发和构建；无需在首页、构建脚本、部署脚本中分别维护周次列表。

## 增加下一周

```powershell
npm run add-week -- w05 "第五周实验主题"
npm run setup
npm run dev
```

该命令创建 `apps/w05/` 的 Vite + React + TypeScript 模板并加入注册表。在新应用中开发页面，更新 `config/weeks.json` 的说明、标签和预览图即可。已有其他页面也可以按 [新增每周实验](docs/ADDING_A_WEEK.md) 接入。

## 发布更新

GitHub Pages 的发布来源设置为 **GitHub Actions**。根 [.github/workflows/pages.yml](.github/workflows/pages.yml) 在推送 `main` 或手动触发时安装依赖、检查配置、运行单元测试、构建并检查路径，然后上传统一 `dist/` 发布。各周目录内保留的旧工作流仅作历史参考，GitHub 不会把它们作为根工作流执行。

在本工程根目录提交并推送：

```powershell
git add .
git commit -m "Update weekly practice"
git push origin main
```

发布状态以 [Actions](https://github.com/YellCanFly/VisualPrinciples-Practice/actions) 的实际结果为准。部署只需一个仓库、一个 Pages 站点。

## 数据与来源

原 W02、W03、W04 仓库及原本地工程保留。迁移来源提交、路径变化和原生成物的处理见 [迁移说明](docs/MIGRATION.md) 与 [精确来源记录](docs/migration-sources.json)。

W03 作品保存在浏览器 IndexedDB，同一浏览器、同一来源下的新旧 Pages 页面使用相同数据库；仍建议用 JSON 导出备份，切换浏览器或设备不会自动同步。W04 参数按页面路径分别保存，新入口从独立设置开始，原页面的数据仍在原路径下；本机导入的 FBX 刷新后需要重新导入。

字体许可保存在 `apps/w03/public/licenses/`；模型许可及来源保存在 `apps/w04/public/models/` 和 [模型来源说明](apps/w04/docs/ASSET_CREDITS.md)。各实验的科学与设计解释、教学示意范围以其原有文档为准。
