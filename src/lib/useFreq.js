import { useEffect, useState } from 'react';
import { loadFreq } from './freq.js';

/* 加载预计算的真题词频表(freq.json，36KB)。返回 Map(词目→次数) 或 null。
   词目解析(freqOf)用到的词典在阅读页已单独加载；闯关只用核心词，无需词典。 */
export function useFreq() {
  const [freq, setFreq] = useState(null);
  useEffect(() => {
    let alive = true;
    loadFreq().then((m) => alive && setFreq(m));
    return () => {
      alive = false;
    };
  }, []);
  return freq;
}
