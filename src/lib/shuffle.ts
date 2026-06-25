// 洗牌 / 取样小工具(真实浏览器环境，直接用 Math.random)

export function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// 从数组中随机取 n 个不重复元素
export function sample<T>(arr: T[], n: number): T[] {
  return shuffle(arr).slice(0, n);
}
