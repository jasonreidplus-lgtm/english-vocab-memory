import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Languages, ArrowLeft, ArrowRight, Shuffle, Pencil, Library, Check } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import WordPopup from '../components/WordPopup';
import { annotate, buildLookup } from '../lib/annotate';
import { resolveTap, isDictLoading, loadDict } from '../lib/dict';
import { useDict } from '../lib/useDict';
import { freqOf } from '../lib/freq';
import { useFreq } from '../lib/useFreq';
import FreqBadge from '../components/FreqBadge';
import { shortMeaning } from '../game/quiz';
import { shuffle } from '../lib/shuffle';
import { fetchBuiltin } from '../lib/passages';
import { splitEnSentences } from '../lib/text';
import type { Word, Sentence, Passage, DictData } from '../types';

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
  const [picked, setPicked] = useState<Word | null>(null);
  const [rich, setRich] = useState<Word | null>(null);
  const [added, setAdded] = useState<Record<Word['id'], boolean>>({});
  const curId = useRef<Word['id'] | null>(null);

  const lookup = useMemo(() => buildLookup(pool), [pool]);
  const dict = useDict();
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

  const segs = useMemo(() => (sentence ? annotate(sentence.en, lookup, dict as DictData | undefined) : []), [sentence, lookup, dict]);
  // 句中出现的不同考研词（用于点「翻译」后的词义清单）
  const marked = useMemo(() => {
    const seen = new Set<Word['id']>();
    const out: Word[] = [];
    for (const s of segs) if (s.w && !seen.has(s.w.id)) { seen.add(s.w.id); out.push(s.w); }
    return out;
  }, [segs]);

  useEffect(() => { setShowTrans(false); }, [idx, src, pasteText, bank, title]);
  useEffect(() => { setIdx(0); }, [src, title]);

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
            {segs.map((s, i) =>
              !/^[A-Za-z]/.test(s.t) ? (
                <span key={i}>{s.t}</span>
              ) : s.w ? (
                <button key={i} className={`hl${added[s.w.id] ? ' hl-added' : ''}`} onClick={() => openWord(s.w!)}>
                  {s.t}<FreqBadge n={freqOf(freq, s.t, lookup)} />
                </button>
              ) : (
                <button key={i} className="tapword" onClick={() => tapWord(s.t)}>{s.t}</button>
              )
            )}
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
