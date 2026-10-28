// Add each future W05 case here; its mount function returns a cleanup function.
import { mountWaterStrobe } from './water-strobe/index.js';

export const experiments = [
  {
    id: 'water-strobe',
    title: '水滴倒流',
    mount: mountWaterStrobe,
  },
];
