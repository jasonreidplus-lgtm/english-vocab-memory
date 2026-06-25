/* 单词发音：优先「有道词典」真人/词典语音(美音/英音随设置)，失败或离线时回退浏览器 TTS。
   有道 dictvoice：type=2 美音 / type=1 英音，直接 word→mp3，覆盖全词库；
   多词/句子用浏览器 TTS(dictvoice 主要面向单词)。所有发音入口都汇到 App.onSpeak → 这里。 */
import { speak } from './speech';

let current: HTMLAudioElement | null = null;

export type Accent = 'us' | 'uk';

const langOf = (accent: Accent) => (accent === 'uk' ? 'en-GB' : 'en-US');

export function playWord(text: string, accent: Accent = 'us'): void {
  const word = (text || '').trim();
  if (!word) return;
  // 含空格(短语/句子) → 直接浏览器 TTS
  if (/\s/.test(word)) {
    speak(word, langOf(accent));
    return;
  }
  try {
    if (current) {
      current.pause();
      current = null;
    }
    const type = accent === 'uk' ? 1 : 2; // 有道：1 英音 / 2 美音
    const audio = new Audio(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${type}`);
    current = audio;
    let fellBack = false;
    const fallback = () => {
      if (fellBack) return; // 只回退一次(error 与 play().catch 可能都触发)
      fellBack = true;
      speak(word, langOf(accent));
    };
    audio.addEventListener('error', fallback);
    audio.play().catch(fallback); // 网络失败 / 自动播放限制 → TTS
  } catch {
    speak(word, langOf(accent));
  }
}
