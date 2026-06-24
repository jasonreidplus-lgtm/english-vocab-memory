import { useEffect, useState } from 'react';
import { loadFreq } from './freq.js';

/* 词典就绪后统计真题库词频(确保词典词计入)；返回 Map(词目→次数) 或 null。 */
export function useFreq(lookup, dict) {
  const [freq, setFreq] = useState(null);
  useEffect(() => {
    if (!lookup || !dict) return;
    let alive = true;
    loadFreq(lookup).then((m) => alive && setFreq(m));
    return () => {
      alive = false;
    };
  }, [lookup, dict]);
  return freq;
}
