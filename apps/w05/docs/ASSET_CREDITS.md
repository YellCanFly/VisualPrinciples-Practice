# W05 素材与来源

## 运动的快慢与节奏

- 章节依据：用户指定的 ChatGPT 对话“品牌动态案例PPT制作”（会话 ID `6ae2b801-07f4-83ea-a91b-f2a1bdc55e08`）中新增的“运动的快慢与节奏”章节。2026-10-29 读取到的对话记录包含曲线类别、讲解顺序和演示要求；本次以这些内容开发交互功能，没有导入或重新分发该 PPT 的视频文件。
- CSS 语义核对：[W3C · CSS Easing Functions Level 1](https://www.w3.org/TR/css-easing-1/)。用于核对输入时间与输出进度、Bézier 控制点与 CSS 关键词、Steps 跳变位置。基础 Cubic 幂函数与 CSS 同名 `ease-in`、`ease-out`、`ease-in-out` 预设在教学说明中分别标识。
- Spring 讲解参考：[Apple · Animate with springs（WWDC23）](https://developer.apple.com/videos/play/wwdc2023/10158/)。用于核对质量、刚度、阻尼、初速度和逐渐收敛的关系；本实验独立计算理想线性弹簧响应，不是 Apple 动画 API 的复刻。
- 曲线、游标、运动物体、对比轨道及课堂练习由本项目的 SVG/DOM/CSS 代码生成。没有新增品牌标志、外部图像、视频、音轨或字体文件。
- 模型边界：缓动是时间到进度的映射，曲线高度不是速度。Back／Elastic／Bounce 是用于表现运动感觉的函数；Spring 为包含初始条件的物理响应，展示窗口结束不等于物理上恰好停止。

## 水滴倒流

- 案例参考：[《水滴为什么会倒流？这是频闪光源导致的》· 李论科学，Bilibili BV19W4y1E7qS](https://www.bilibili.com/video/BV19W4y1E7qS)。本项目仅保存来源链接与原理解释，不复制、打包或重新分发视频、音轨及视频截图。
- 原理核对：[Appalachian State University · Falling Drops](https://physics.appstate.edu/catalog/1-mechanics/1c-motion-one-dimension/falling-drops)；[Steven Vogel / Duke · 芝加哥大学出版社课堂讲义](https://press.uchicago.edu/sites/vogel/Page163_Droplet.pdf)。两者支持接近滴水频率时，灯频略高产生表观上移、略低产生表观下移的结论。
- 水滴、装置、时间采样示意由本项目的 Canvas/SVG/CSS 代码绘制，为此次教学演示原创，无外部图像或模型素材。

原理边界：以理想周期滴水、重力下落和离散采样保持解释表观运动，不复刻视频中的具体器材参数，也不把水滴图样的上移解释为同一颗水滴上升。

2026-10-28 获取范围：B 站网页直接访问返回 412；通过公开元数据与官方缩略图序列确认标题、作者与讲解形式，字幕接口未提供字幕，未完整观看或下载视频。实现依据上述可核实信息与独立物理模型。

## 共享资源

- 首页预览图 `public/previews/w05.svg` 为课程原创矢量示意，2026-10-29 更新为缓动曲线与频闪水滴两部分，可随课程源码使用和分发，无第三方图像授权依赖。
- 使用系统字体，无新增字体文件或外部字体请求。
- Vite 及其依赖的许可见各依赖包；依赖通过本周 `package-lock.json` 固定，不将 `node_modules/` 纳入源码。
