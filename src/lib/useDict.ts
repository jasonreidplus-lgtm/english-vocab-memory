import { useEffect, useState } from 'react';
import type { DictData } from '../types';
import { loadDict } from './dict';

/* 阅读类页面用：挂载时异步加载广义词典，加载完成后触发重标注。返回 dict 对象(未就绪为 null)。 */
export function useDict(): DictData | null {
  const [dict, setDict] = useState<DictData | null>(null);
  useEffect(() => {
    let alive = true;
    loadDict().then((d) => alive && setDict(d));
    return () => {
      alive = false;
    };
  }, []);
  return dict;
}
