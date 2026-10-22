import type { PhotoreceptorLight, PhotoreceptorRegion, Vector3Tuple } from '../types'
import { MACULA_POSITION, OPTIC_DISC_DIRECTION } from './eyeLandmarks'

interface PhotoreceptorCell {
  nameZh: string
  color: string
  count: number
  countLabel: string
  shape: string
  sensitivity: string
  visionRole: string
  distribution: string
}

/** 单眼数量采用 Curcio 等（1990）样本均值，不作为每个人的固定计数。 */
export const photoreceptorCells: Record<'cone' | 'rod', PhotoreceptorCell> = {
  cone: {
    nameZh: '视锥细胞', color: '#d48b35', count: 4_600_000, countLabel: '约 460 万',
    shape: '典型周边视锥的外节逐渐变细；中央凹视锥更细长。',
    sensitivity: '较明亮时主导视觉，弱光敏感度低于视杆。',
    visionRole: '支持颜色分辨与精细视觉；色觉来自三类视锥信号的比较。',
    distribution: '中央凹中心最密集，向外迅速减少；周边仍有视锥。',
  },
  rod: {
    nameZh: '视杆细胞', color: '#528eb5', count: 92_000_000, countLabel: '约 9200 万',
    shape: '外节通常呈细长圆柱状，内部含有感光膜盘。',
    sensitivity: '对弱光更敏感；强光下通常趋于饱和，对视觉贡献较小。',
    visionRole: '暗光下帮助察觉明暗与轮廓；单独的视杆系统不能分辨颜色，精细分辨能力较低。',
    distribution: '中央凹中心没有视杆，外围占优势；密度高峰在中心外的环带。',
  },
}

function onRetina(position: Vector3Tuple): Vector3Tuple {
  const scale = 1.525 / Math.hypot(...position)
  return position.map((value) => value * scale) as Vector3Tuple
}

export const photoreceptorRegions: Record<PhotoreceptorRegion, {
  nameZh: string; description: string; position: Vector3Tuple; labelPosition: Vector3Tuple
}> = {
  fovea: {
    nameZh: '中央凹中心',
    description: '位于黄斑中央。视锥高度密集，中央小凹的中心无视杆；不能把整个黄斑理解为只有视锥。',
    position: onRetina(MACULA_POSITION), labelPosition: [1.88, -0.45, 0.1],
  },
  peripheral: {
    nameZh: '周边视网膜',
    description: '中央凹之外，两类细胞共同分布，整体以视杆为主。视杆密度先增后减，并非越靠最远边缘越多。',
    position: onRetina([0.3, 1.2, -0.85]), labelPosition: [0.05, 2, 0.1],
  },
  'optic-disc': {
    nameZh: '视盘',
    description: '视神经纤维离开眼球的区域，不含视锥和视杆，因此形成生理盲点。它与中央凹是不同位置。',
    position: onRetina(OPTIC_DISC_DIRECTION), labelPosition: [2.25, 1.05, 0.1],
  },
}

export const photoreceptorLightModes: Record<PhotoreceptorLight, {
  nameZh: string; description: string; coneLabel: string; rodLabel: string
}> = {
  bright: {
    nameZh: '明亮', description: '视锥主导颜色与细节视觉；视杆对视觉的贡献通常较小。',
    coneLabel: '颜色与细节：视锥主导', rodLabel: '通常趋于饱和，贡献较小',
  },
  twilight: {
    nameZh: '暮光', description: '在中间亮度下，视锥与视杆共同参与，颜色和细节能力逐渐下降。',
    coneLabel: '仍参与，色觉与细节减弱', rodLabel: '共同参与，弱光优势显现',
  },
  dark: {
    nameZh: '暗光', description: '这里指仍有微弱光线且已暗适应的环境。视杆主导，难以辨色，细节变少；完全无光时两类细胞都不能形成物体视觉。',
    coneLabel: '作用较小，色觉明显减弱', rodLabel: '暗适应后，弱光视觉主导',
  },
}

export const photoreceptorSources = [
  { id: 'counts', title: '人类感光细胞分布与数量 · 原始研究', url: 'https://pubmed.ncbi.nlm.nih.gov/2324310/' },
  { id: 'anatomy', title: '感光细胞形态与分布 · 专业教材', url: 'https://www.ncbi.nlm.nih.gov/books/NBK11522/' },
  { id: 'function', title: '视杆与视锥的功能分工 · 神经科学教材', url: 'https://www.ncbi.nlm.nih.gov/books/NBK10850/' },
  { id: 'layers', title: '视网膜层次与信号通路 · 开放教材', url: 'https://openstax.org/books/introduction-behavioral-neuroscience/pages/6-2-the-retina' },
]

export const PHOTORECEPTOR_MODEL_NOTE = '形状、配色、区域标记与比例为教学示意；分布点不代表实际细胞计数，亮度表示相对视觉贡献，不是生理响应测量。'
