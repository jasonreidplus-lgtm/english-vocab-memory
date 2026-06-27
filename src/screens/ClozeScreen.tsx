import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Languages, ArrowLeft, ArrowRight, Shuffle, Pencil, Library, Check } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import WordPopup from '../components/WordPopup';
import { annotate, buildLookup } from '../lib/annotate';
import { resolveTap, isDictLoading, loadDict } from '../lib/dict';
import { useDict } from '../lib/useDict';
import { freqOf, isKeyHit } from '../lib/freq';
import { useFreq } from '../lib/useFreq';
import FreqBadge from '../components/FreqBadge';
import { shortMeaning } from '../game/quiz';
import { shuffle } from '../lib/shuffle';
import { fetchBuiltin } from '../lib/passages';
import { splitEnSentences } from '../lib/text';
import type { Word, Sentence, Passage } from '../types';

/* 长难句「就地划线」：复用已有 analysis.structure(角色〔修饰X〕：英文片段)，在原句上叠加彩色下划线，无需改数据。 */
function segRole(label: string): string {
  if (/主句|主干/.test(label)) return 'trunk';
  if (/同位语/.test(label)) return 'appos';
  if (/定语/.test(label)) return 'attr';
  if (/宾语从句|主语从句|表语从句|名词性从句|宾语|表语/.test(label)) return 'noun';
  if (/状语|条件|原因|让步|目的|结果|时间|方式|对比|排除|程度/.test(label)) return 'adv';
  if (/分词|不定式|动名词|非谓语/.test(label)) return 'verbal';
  if (/强调|倒装/.test(label)) return 'cleft';
  if (/并列/.test(label)) return 'coord';
  if (/插入/.test(label)) return 'paren';
  return 'misc';
}
const ROLE_ABBR: Record<string, string> = { attr: '定', noun: '宾', adv: '状', appos: '同', verbal: '非谓', cleft: '强调', coord: '并列', paren: '插入', misc: '' };
const qnorm = (s: string) => s.replace(/[「」“”‘’]/g, '"');
interface FragInfo { role: string; depth: number; label: string; note: string; en: string }
function parseFrag(line: string): FragInfo {
  const m = String(line).match(/^([\s│]*)(?:[└├]\s*)?([\s\S]*)$/);
  const depth = Math.round((m ? m[1].length : 0) / 4);
  let rest = (m ? m[2] : String(line)).trim();
  const ci = rest.indexOf('：');
  let label = ci >= 0 ? rest.slice(0, ci).trim() : rest.trim();
  let en = ci >= 0 ? rest.slice(ci + 1) : '';
  let note = '';
  const nm = label.match(/〔([^〕]*)〕/);
  if (nm) { note = nm[1]; label = label.replace(/〔[^〕]*〕/, '').trim(); }
  en = qnorm(en).replace(/（[^）]*）/g, ' ').replace(/〔[^〕]*〕/g, ' ').replace(/\s+/g, ' ').trim(); // 去中文括注〔〕（…）、统一引号
  return { role: segRole(label), depth, label, note, en };
}
// 在原句(已统一引号+小写的 matchEn)里定位片段，返回 [起,止]；索引与原句 1:1。失败回退到截断前缀。
function locate(matchEn: string, frag: string): [number, number] | null {
  const f = qnorm(frag).toLowerCase().trim();
  if (f.replace(/[^a-z]/g, '').length >= 4) {
    const i = matchEn.indexOf(f);
    if (i >= 0) return [i, i + f.length];
  }
  const pre = f.split(/…|\.\.\./)[0].trim();
  if (pre.replace(/[^a-z]/g, '').length >= 6) {
    const i = matchEn.indexOf(pre);
    if (i >= 0) return [i, i + pre.length];
  }
  const core = pre.replace(/^[^a-z0-9]+/, '').replace(/[^a-z0-9]+$/, ''); // 去首尾引号/标点再试(引语、标题等)
  if (core.length >= 6 && core !== pre) {
    const i = matchEn.indexOf(core);
    if (i >= 0) return [i, i + core.length];
  }
  return null;
}
/* 把原句切成「顶层意群」并编号：从句取最外层非重叠片段，主干=未被覆盖的部分(可不连续)，按出现顺序编号。 */
function buildComponents(en: string, lines: string[]) {
  const src = String(en || '');
  const matchEn = qnorm(src).toLowerCase();
  const subs: { s: number; e: number; role: string; label: string; note: string }[] = [];
  for (const line of lines || []) {
    const fi = parseFrag(line);
    if (fi.role === 'trunk' || !fi.en) continue;
    const pos = locate(matchEn, fi.en);
    if (pos) subs.push({ s: pos[0], e: pos[1], role: fi.role, label: fi.label, note: fi.note });
  }
  subs.sort((a, b) => a.s - b.s || b.e - a.e);
  const top: typeof subs = [];
  let lastEnd = -1;
  for (const sp of subs) if (sp.s >= lastEnd) { top.push(sp); lastEnd = sp.e; } // 仅取最外层、不重叠
  const comps: { role: string; label: string; note: string; text: string }[] = [];
  const pushGap = (gap: string) => {
    if (!gap) return;
    if (gap.replace(/[^A-Za-z]/g, '').length >= 3) comps.push({ role: 'trunk', label: '主干', note: '', text: gap });
    else if (comps.length) comps[comps.length - 1].text += gap; // 纯标点/连接词并入上一段，避免把逗号也编号
    else comps.push({ role: 'trunk', label: '主干', note: '', text: gap });
  };
  let cur = 0;
  for (const sp of top) {
    pushGap(src.slice(cur, sp.s));
    comps.push({ role: sp.role, label: sp.label || '从句', note: sp.note || '', text: src.slice(sp.s, sp.e) });
    cur = sp.e;
  }
  pushGap(src.slice(cur));
  return comps.map((c, i) => ({ ...c, n: i + 1 }));
}
/** 原句卡：整句照原文 + 各意群彩色下划线 + 圈码 + 下方图例 */
function AnaSentence({ en, lines }: { en: string; lines: string[] }) {
  const comps = useMemo(() => buildComponents(en, lines), [en, lines]);
  if (!comps.length) return <p className="ps-sent">{en}</p>;
  return (
    <>
      <p className="ps-sent">
        {comps.map((c, k) => (
          <span key={k} className={`ps-c rc-${c.role}`}><sup className="ps-num">{c.n}</sup>{c.text}</span>
        ))}
      </p>
      <div className="ps-legend">
        {comps.map((c, k) => (
          <span key={k} className={`ps-leg rc-${c.role}`}><b className="ps-num">{c.n}</b>{c.label}{c.note && <span className="ps-leg-note">（{c.note}）</span>}</span>
        ))}
      </div>
    </>
  );
}
/** 结构拆分树：按层级缩进的彩色行(角色标签 + 修饰对象 + 英文片段) */
function AnaTree({ lines }: { lines: string[] }) {
  const segs = useMemo(() => (lines || []).map(parseFrag), [lines]);
  return (
    <div className="ana-split">
      {segs.map((s, i) => (
        <div key={i} className={`ana-seg rc-${s.role}`} style={{ marginInlineStart: Math.min(s.depth, 4) * 14 }}>
          <span className="ana-seg__tag">{s.label}{s.note && <span className="ana-seg__note">（{s.note}）</span>}</span>
          {s.en && <span className="ana-seg__en">{s.en}</span>}
        </div>
      ))}
    </div>
  );
}

interface ClozeScreenProps {
  pool: Word[];
  sentences?: Sentence[]; // passage 模式：传 sentences + title + onDone
  title?: string;
  onDone?: () => void;
  themeKey: string;
  onTheme: (k: string) => void;
  onBack: () => void;
  onSpeak: (word: string) => void;
  onMarkWrong: (id: Word['id']) => void;
  hydrateWord: (w: Word) => Promise<Word>;
}

export default function ClozeScreen({
  pool, sentences, title, onDone, // passage 模式：传 sentences + title + onDone
  themeKey, onTheme, onBack, onSpeak, onMarkWrong, hydrateWord,
}: ClozeScreenProps) {
  const passageMode = Array.isArray(sentences);
  const [bank, setBank] = useState<Sentence[] | null>(null);
  const [src, setSrc] = useState<'bank' | 'paste'>('bank'); // bank | paste（仅独立「句子精读」用）
  const [pasteText, setPasteText] = useState('');
  const [order, setOrder] = useState<number[]>([]);
  const [idx, setIdx] = useState(0);
  const [showTrans, setShowTrans] = useState(false);
  const [showAna, setShowAna] = useState(false); // 长难句拆解展开
  const [picked, setPicked] = useState<Word | null>(null);
  const [rich, setRich] = useState<Word | null>(null);
  const [added, setAdded] = useState<Record<Word['id'], boolean>>({});
  const curId = useRef<Word['id'] | null>(null);

  const lookup = useMemo(() => buildLookup(pool), [pool]);
  useDict(); // 预加载广义词典：点任意词都能查（但不参与高亮，避免整句全亮）
  const freq = useFreq();

  useEffect(() => {
    if (passageMode) return;
    let alive = true;
    const base = import.meta.env.BASE_URL;
    Promise.all([
      fetch(`${base}data/sentences.json`).then((r) => r.json()),
      // 复用真题关卡库(共享 fetchBuiltin 的模块级缓存，避免重复下载 passages.json)：
      // 把每篇的 sents 摊平当作句库，逐句已带 cn 译文
      fetchBuiltin(),
    ])
      .then(([self, passages]: [Sentence[], Passage[]]) => {
        if (!alive) return;
        const real = Array.isArray(passages) ? passages.flatMap((p) => p.sents || []) : [];
        const all = [...(Array.isArray(self) ? self : []), ...real];
        setBank(all);
        setOrder(shuffle(all.map((_, i) => i)));
      })
      .catch(() => alive && setBank([]));
    return () => { alive = false; };
  }, [passageMode]);

  const pasteSents = useMemo<Sentence[]>(() => splitEnSentences(pasteText).map((en) => ({ en })), [pasteText]);
  const list = passageMode
    ? sentences
    : src === 'bank'
    ? bank ? order.map((i) => bank[i]) : []
    : pasteSents;
  const sentence = list[idx] || null;

  // 高亮只认考研核心词库(lookup)；广义词典词不高亮，但点击仍走 resolveTap 可查
  const segs = useMemo(() => (sentence ? annotate(sentence.en, lookup) : []), [sentence, lookup]);
  // 句中出现的不同考研词（用于点「翻译」后的词义清单）
  const marked = useMemo(() => {
    const seen = new Set<Word['id']>();
    const out: Word[] = [];
    for (const s of segs) if (isKeyHit(s.w, s.t, lookup, freq) && s.w && !seen.has(s.w.id)) { seen.add(s.w.id); out.push(s.w); }
    return out;
  }, [segs, lookup, freq]);

  useEffect(() => { setShowTrans(false); setShowAna(false); }, [idx, src, pasteText, bank, title]);
  useEffect(() => { setIdx(0); }, [src, title]);
  // 句源变化致句数减少时（如把粘贴文本换成更短的），把越界的 idx 收回范围内，避免停在空白句误显示空状态
  useEffect(() => { if (idx > list.length - 1) setIdx(Math.max(0, list.length - 1)); }, [list.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const openWord = async (entry: Word) => {
    curId.current = entry.id;
    setPicked(entry);
    setRich(null);
    if (hydrateWord) {
      const h = await hydrateWord(entry);
      if (curId.current === entry.id) setRich(h);
    }
  };
  const closePop = () => { curId.current = null; setPicked(null); setRich(null); };
  const tapWord = async (raw: string) => {
    let entry = resolveTap(raw, lookup);
    if (entry._missing && isDictLoading()) {
      openWord({ ...entry, base_meaning: '词典加载中…' });
      await loadDict();
      entry = resolveTap(raw, lookup); // 词典就绪后重判
    }
    openWord(entry);
  };

  const total = list.length;
  const go = (d: number) => setIdx((v) => Math.max(0, Math.min(total - 1, v + d)));
  const reshuffle = () => { if (bank) { setOrder(shuffle(bank.map((_, i) => i))); setIdx(0); } };
  const isLast = idx >= total - 1;

  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="section-title">
        {passageMode ? title : '句子精读'}
        {!passageMode && (
          <span className="seg" style={{ marginLeft: 'auto' }}>
            <button className={src === 'bank' ? 'on' : ''} onClick={() => setSrc('bank')}><Library size={13} /> 句库</button>
            <button className={src === 'paste' ? 'on' : ''} onClick={() => setSrc('paste')}><Pencil size={13} /> 我的真题</button>
          </span>
        )}
      </div>

      {!passageMode && src === 'paste' && (
        <textarea
          className="read-input"
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          placeholder="把你真题书里的句子/段落粘进来（英文）。自动切句、标出考研词，本机处理不上传。"
          rows={4}
          style={{ marginBottom: 10 }}
        />
      )}

      {!sentence ? (
        <div className="label center" style={{ paddingTop: 40 }}>
          {!passageMode && src === 'paste' ? '粘一段英文进来开始精读' : bank === null && !passageMode ? '加载中…' : '没有句子'}
        </div>
      ) : (
        <>
          <div className="row between">
            <span className="label">
              {passageMode ? `第 ${idx + 1}/${total} 句` : `${src === 'bank' ? '句库' : '我的真题'} ${idx + 1}/${total}`}
              {' · '}{marked.length} 重点词
            </span>
            {!passageMode && src === 'bank' && (
              <button className="pill" onClick={reshuffle} aria-label="换一批"><Shuffle size={14} /></button>
            )}
          </div>

          {passageMode && (
            <div className="bar mt8"><i style={{ width: `${((idx + 1) / total) * 100}%` }} /></div>
          )}

          {/* 纯英文句子，考研词高亮（点词看词卡） */}
          <div className="cloze-sent fade" key={idx}>
            {segs.map((s, i) => {
              if (!/^[A-Za-z]/.test(s.t)) return <span key={i}>{s.t}</span>;
              if (isKeyHit(s.w, s.t, lookup, freq)) {
                return (
                  <button key={i} className={`hl${added[s.w!.id] ? ' hl-added' : ''}`} onClick={() => openWord(s.w!)}>
                    {s.t}<FreqBadge n={freqOf(freq, s.t, lookup)} />
                  </button>
                );
              }
              // 非重点词（常见核心词 / 广义词典词 / 未收录）：普通文字，点击仍可查
              return <button key={i} className="tapword" onClick={() => (s.w ? openWord(s.w) : tapWord(s.t))}>{s.t}</button>;
            })}
          </div>

          {showTrans ? (
            <div className="fade">
              {sentence.cn ? (
                <div className="cloze-cn">{sentence.cn}</div>
              ) : (
                <div className="label center mt12" style={{ fontSize: 12, opacity: 0.7 }}>（此句无内置译文，可对照你的真题书）</div>
              )}
              {marked.length > 0 && (
                <div className="gloss mt8">
                  {marked.map((w) => (
                    <button key={w.id} className="gloss-item" onClick={() => openWord(w)}>
                      <span className="gloss-w">{w.word}{w.pos ? <span className="gloss-pos"> {w.pos}</span> : null}</span>
                      <span className="gloss-m">{shortMeaning(w.base_meaning, 18)}</span>
                    </button>
                  ))}
                </div>
              )}
              <div className="label center mt8" style={{ fontSize: 11, opacity: 0.7 }}>点词看词根/例句/助记 · 可加错词本</div>
            </div>
          ) : (
            <button className="btn primary block mt16" onClick={() => setShowTrans(true)}>
              <Languages size={17} /> 翻译 · 看词义
            </button>
          )}

          {/* 长难句拆解：仅当该句有预生成的 analysis 时出现（粘贴句没有） */}
          {sentence.analysis && (
            showAna ? (
              <div className="ana fade">
                <details className="ps-card" open>
                  <summary className="ps-head">原句 · 拆分</summary>
                  <AnaSentence en={sentence.en} lines={sentence.analysis.structure || []} />
                  <div className="ps-trunk"><b className="ps-sub">主干</b>{sentence.analysis.trunk}</div>
                </details>
                {sentence.analysis.structure && sentence.analysis.structure.length > 0 && (
                  <details className="ps-card">
                    <summary className="ps-head">结构拆分</summary>
                    <AnaTree lines={sentence.analysis.structure} />
                  </details>
                )}
                {sentence.cn && (
                  <details className="ps-card">
                    <summary className="ps-head">句意翻译</summary>
                    <div className="ps-cn">{sentence.cn}</div>
                  </details>
                )}
                {marked.length > 0 && (
                  <details className="ps-card">
                    <summary className="ps-head">词汇与短语 · {marked.length}</summary>
                    <div className="gloss">
                      {marked.map((w) => (
                        <button key={w.id} className="gloss-item" onClick={() => openWord(w)}>
                          <span className="gloss-w">{w.word}{w.pos ? <span className="gloss-pos"> {w.pos}</span> : null}</span>
                          <span className="gloss-m">{shortMeaning(w.base_meaning, 18)}</span>
                        </button>
                      ))}
                    </div>
                  </details>
                )}
                {(sentence.analysis.logic || (sentence.analysis.notes && sentence.analysis.notes.length > 0)) && (
                  <details className="ps-card">
                    <summary className="ps-head">结构分析详解 · 考点</summary>
                    {sentence.analysis.logic && <div className="ps-cn">{sentence.analysis.logic}</div>}
                    {sentence.analysis.notes && sentence.analysis.notes.length > 0 && (
                      <ul className="ana-notes" style={{ marginTop: sentence.analysis.logic ? 8 : 0 }}>{sentence.analysis.notes.map((n, i) => <li key={i}>{n}</li>)}</ul>
                    )}
                  </details>
                )}
                <button className="btn ghost block mt8" onClick={() => setShowAna(false)}>收起拆解</button>
              </div>
            ) : (
              <button className="btn ghost block mt8" onClick={() => setShowAna(true)}>
                🧩 长难句拆解
              </button>
            )
          )}

          <div className="row gap10 mt12">
            <button className="btn ghost grow" onClick={() => go(-1)} disabled={idx === 0}>
              <ArrowLeft size={17} /> 上一句
            </button>
            {passageMode && isLast ? (
              <button className="btn primary" style={{ flex: 1.3 }} onClick={() => onDone && onDone()}>
                完成本篇 <Check size={17} />
              </button>
            ) : (
              <button className="btn grow" onClick={() => go(1)} disabled={isLast}>
                下一句 <ArrowRight size={17} />
              </button>
            )}
          </div>
        </>
      )}

      <WordPopup
        entry={picked}
        rich={rich}
        added={picked ? !!added[picked.id] : false}
        onSpeak={onSpeak}
        onAddWrong={() => {
          if (!picked) return;
          onMarkWrong && onMarkWrong(picked.id);
          setAdded((a) => ({ ...a, [picked.id]: true }));
        }}
        onClose={closePop}
      />
    </>
  );
}
