/* 英文切句小工具：按句末标点切分，丢弃太短的碎片(字母数 < 15)。
   真题精读(ClozeScreen) 与 关卡库导入(passages.js) 共用同一套规则。 */
export function splitEnSentences(text) {
  return (String(text || '').match(/[^.!?]+[.!?]+(?=\s|$)/g) || [])
    .map((s) => s.trim())
    .filter((s) => s.replace(/[^a-z]/gi, '').length >= 15);
}
