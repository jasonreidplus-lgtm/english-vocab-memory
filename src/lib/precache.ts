/* 一键把全词库发音缓存到离线：逐个 fetch 同源的 public/audio/{accent}/{word}.mp3，
   由 Service Worker 的 fetch 处理(stale-while-revalidate)写入缓存 → 之后全离线可用。
   只缓存当前口音的 5500 个；切换口音后可再缓存另一种。 */
const BASE = import.meta.env.BASE_URL || '/';

export interface PrecacheProgress {
  done: number;
  total: number;
  failed: number;
}

export async function precacheAudio(
  accent: 'us' | 'uk',
  onProgress: (p: PrecacheProgress) => void,
  control?: { cancelled: boolean }
): Promise<PrecacheProgress> {
  let words: string[] = [];
  try {
    const res = await fetch(`${BASE}data/vocab-index.json`, { cache: 'force-cache' });
    const idx = (await res.json()) as Array<{ word?: string }>;
    words = [...new Set(idx.map((w) => String(w.word || '').trim().toLowerCase()).filter(Boolean))];
  } catch {
    return { done: 0, total: 0, failed: 0 };
  }

  const total = words.length;
  let done = 0;
  let failed = 0;
  const CONC = 6;
  let i = 0;
  const tick = () => onProgress({ done, total, failed });
  tick();

  async function worker() {
    while (i < words.length) {
      if (control?.cancelled) return;
      const w = words[i++];
      try {
        const r = await fetch(`${BASE}audio/${accent}/${encodeURIComponent(w)}.mp3`, { cache: 'force-cache' });
        if (!r.ok) failed++;
      } catch {
        failed++;
      }
      done++;
      if (done % 25 === 0 || done === total) tick();
    }
  }

  await Promise.all(Array.from({ length: CONC }, () => worker()));
  tick();
  return { done, total, failed };
}
