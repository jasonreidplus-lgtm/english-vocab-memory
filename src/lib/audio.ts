/* 单词发音优先级：① 随 app 内置的本地 mp3(public/audio，同源、可离线) → ② 在线有道(未内置时补充)
   → ③ 浏览器 TTS(都失败时兜底)。单词才有内置音频；多词/句子直接走 TTS。
   美音=有道 type=2 / 英音=type=1，跟随设置里的 accent。所有发音入口都汇到 App.onSpeak → 这里。 */
import { speak } from './speech';

let current: HTMLAudioElement | null = null;
export type Accent = 'us' | 'uk';

const langOf = (a: Accent) => (a === 'uk' ? 'en-GB' : 'en-US');
const BASE = import.meta.env.BASE_URL || '/';

export function playWord(text: string, accent: Accent = 'us'): void {
  const word = (text || '').trim();
  if (!word) return;
  const lang = langOf(accent);
  // 含空格(短语/句子) → 浏览器 TTS
  if (/\s/.test(word)) {
    speak(word, lang);
    return;
  }
  if (current) {
    try { current.pause(); } catch { /* noop */ }
    current = null;
  }

  const enc = encodeURIComponent(word.toLowerCase());
  const sub = accent === 'uk' ? 'uk' : 'us';
  const type = accent === 'uk' ? 1 : 2;
  const srcs = [
    `${BASE}audio/${sub}/${enc}.mp3`, // 内置本地(可离线)
    `https://dict.youdao.com/dictvoice?audio=${enc}&type=${type}`, // 在线兜底
  ];

  let i = 0;
  const tryNext = () => {
    if (i >= srcs.length) {
      speak(word, lang); // 本地 + 在线都失败 → TTS
      return;
    }
    const a = new Audio(srcs[i++]);
    current = a;
    let advanced = false;
    const adv = () => {
      if (advanced) return; // 每个源只前进一次(error 与 play().catch 可能都触发)
      advanced = true;
      tryNext();
    };
    a.addEventListener('error', adv, { once: true });
    a.play().catch(adv);
  };
  tryNext();
}
