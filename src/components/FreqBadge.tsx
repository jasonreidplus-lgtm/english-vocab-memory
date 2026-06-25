import React from 'react';
import { freqLabel, freqClass } from '../lib/freq';

/* 高亮词右上角的「真题出现次数」数字角标，颜色按次数分档(1灰/2-4黄/5-7红/8+黑)。 */
interface FreqBadgeProps {
  n?: number;
}

export default function FreqBadge({ n }: FreqBadgeProps) {
  if (!n) return null;
  return <sup className={`fq ${freqClass(n)}`} aria-hidden>{freqLabel(n)}</sup>;
}
