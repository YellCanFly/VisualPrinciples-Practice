# 眼球模型资产接入口

当前版本使用 `src/components/viewer/EyeModel.tsx` 中的本地程序几何 Demo Eye，本目录没有正式 GLB 资产。演示不需要联网加载模型。

后续可将有明确使用授权的模型放在本目录，例如 `eye_full.glb`、`eye_cutaway.glb`。请同时记录资产来源、作者、许可和修改情况。不要通过远程地址加载核心模型。

## 结构命名

模型由独立结构组成。建议保留以下 Mesh 名称；如果资产名称不同，统一修改 `src/data/eyeStructures.ts` 的 `modelObjectName` 与导出的 `meshStructureMap`。

| 结构 | Mesh 名称 | 结构 ID |
| --- | --- | --- |
| 角膜 | `Cornea_Mesh` | `cornea` |
| 虹膜 | `Iris_Mesh` | `iris` |
| 瞳孔开口边缘 | `Pupil_Mesh` | `pupil` |
| 晶状体 | `Lens_Mesh` | `lens` |
| 睫状体 | `CiliaryBody_Mesh` | `ciliary-body` |
| 玻璃体 | `Vitreous_Mesh` | `vitreous` |
| 视网膜 | `Retina_Mesh` | `retina` |
| 黄斑 | `Macula_Mesh` | `macula` |
| 巩膜 | `Sclera_Mesh` | `sclera` |
| 视神经 | `OpticNerve_Mesh` | `optic-nerve` |

瞳孔必须作为虹膜中央的真实开口呈现，不能用实心黑盘遮挡教学光线。

## 坐标与替换流程

- 眼球中心为 `(0, 0, 0)`，示意半径约 `1.65`；前方为 X 负方向，Y 向上。
- 剖视移除 Z 正半球，使眼内结构从侧面可见。
- 导入时统一尺寸与坐标，让角膜、晶状体、视网膜与现有光学路径相符。
- 在 Viewer 内增加 GLB 加载、中文加载状态与失败回退，并复用结构 ID 处理选择与高亮。
- 调整 `src/data/annotations.ts` 的锚点和标签位置，避免标签与剖切面重叠。
- 保持结构、光线、动画和页面的独立接口；完成后更新架构和项目记忆，并检查完整 / 剖视、结构选择、标注及六个教学步骤。

本模型用于视觉原理教学，尺寸与光学路径均为示意，不作为临床解剖或诊断依据。
