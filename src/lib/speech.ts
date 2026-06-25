// 朗读单词 —— 用浏览器自带 SpeechSynthesis，免费、不调任何 API。
// (P1 功能的最小实现：Learn/Quiz 里点喇叭即可发音)
export function speak(text: string, lang: string = 'en-US'): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth || !text) return;
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = 0.95;
    synth.speak(u);
  } catch {
    /* 不支持就静默 */
  }
}

export function speechAvailable(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}
