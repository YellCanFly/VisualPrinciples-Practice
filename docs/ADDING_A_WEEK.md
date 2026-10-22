# 新增每周实验

所有后续实验放在 `VisualPrinciples-Practice` 内。注册表 `config/weeks.json` 同时驱动首页和根工具链。

## 从模板开始

在仓库根目录执行：

```powershell
npm run add-week -- w05 "第五周实验主题"
npm run setup
npm run dev
```

编辑新生成的 `apps/w05/src/`，并更新注册项中的标题、描述、标签和预览图。新周的 `package-lock.json` 由首次安装生成，应与源码一起提交。

## 接入现有 Vite 页面

1. 将应用源码、`public/` 资源、依赖文件、配置、测试及许可复制到 `apps/w05/`。不要复制嵌套 `.git/`、`node_modules/` 或旧 `dist/`。
2. 为应用配置 `dev`、`build` 和 `test` 脚本。根工程通过每周应用自己的构建脚本生成其 `dist/`。
3. Vite 生产 `base` 使用 `'./'`，开发由根脚本提供该周的路径前缀。不要写死旧仓库名；通过 `import.meta.env.BASE_URL` 引用 `public/` 中的资源。
4. 在 `config/weeks.json` 数组中增加一项，`id`、`path`、`directory` 和开发 `port` 均应唯一。例如：

```json
{
  "id": "w05",
  "number": "05",
  "title": "第五周实验主题",
  "description": "用一句话说明本周可以观察和操作的内容。",
  "tags": ["主题标签"],
  "path": "w05/",
  "directory": "apps/w05",
  "port": 5215,
  "preview": "previews/w05.png"
}
```

5. 把对应预览图放入 `public/previews/`，记录新增素材的来源与许可。预览路径相对于首页 `public/`。
6. 增加“课程首页”入口。周页面部署于首页下一级，返回地址为 `../`；如使用延迟保存，导航前应先完成保存。

应用使用独立页面，样式和依赖无需与其他周合并。HashRouter 可以用于周内路由；若新增使用 History API 的深层路由，必须额外处理静态托管的直接访问和刷新，不要假设 GitHub Pages 有 SPA 回退服务。

## 验证与发布

```powershell
npm run setup
npm run check
npm test
npm run build
npm run verify:dist
npm run preview
```

在首页检查新卡片、每周页面入口和返回入口；操作关键功能，检查字体、图片、模型与导出，并查看浏览器 Console。至少检查桌面与窄屏布局。资源检查通过仅说明静态路径可访问，不能证明交互或 WebGL 渲染正确。

确认后把新应用、注册表、预览图与锁文件一并提交到当前仓库 `main`。根工作流从注册表构建所有应用，无需新增仓库或为每周建立单独的 Pages 工作流。

如只改已有周，直接编辑对应 `apps/wXX/`，其测试与开发约定仍然适用。保留原有教学意义、存储兼容性和素材许可。
