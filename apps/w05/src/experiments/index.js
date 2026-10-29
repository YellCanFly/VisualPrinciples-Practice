// Add each future W05 case here; its mount function returns a cleanup function.
import { mountWaterStrobe } from './water-strobe/index.js';
import { mountMotionRhythm } from './motion-rhythm/index.js';

export const experiments = [
  {
    id: 'motion-rhythm',
    title: '运动的快慢与节奏',
    mount: mountMotionRhythm,
  },
  {
    id: 'water-strobe',
    title: '水滴倒流',
    mount: mountWaterStrobe,
  },
];
