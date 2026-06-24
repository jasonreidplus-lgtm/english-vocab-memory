import { useEffect, useState } from 'react';
import { loadDict } from './dict.js';

/* 阅读类页面用：挂载时异步加载广义词典，加载完成后触发重标注。返回 dict 对象(未就绪为 null)。 */
export function useDict() {
  const [dict, setDict] = useState(null);
  useEffect(() => {
    let alive = true;
    loadDict().then((d) => alive && setDict(d));
    return () => {
      alive = false;
    };
  }, []);
  return dict;
}
