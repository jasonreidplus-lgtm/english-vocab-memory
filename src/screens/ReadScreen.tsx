import React, { useMemo, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import WordPopup from '../components/WordPopup';
import { annotate, buildLookup } from '../lib/annotate';
import { resolveTap, isDictLoading, loadDict } from '../lib/dict';
import { useDict } from '../lib/useDict';
import { freqOf, isKeyHit } from '../lib/freq';
import { useFreq } from '../lib/useFreq';
import FreqBadge from '../components/FreqBadge';
import type { Word } from '../types';

interface ReadScreenProps {
  pool: Word[];
  themeKey: string;
  onTheme: (k: string) => void;
  onBack: () => void;
  onSpeak: (word: string) => void;
  onMarkWrong: (id: Word['id']) => void;
  hydrateWord: (w: Word) => Promise<Word>;
}

// 自写的示例句（非真题原文，避免版权问题）；真正的真题由你自己粘贴
const SAMPLE =
  'The unprecedented surge in remote work has compelled many companies to reconsider how they evaluate productivity. Critics argue that the prevailing emphasis on visible activity is misleading, and that a more nuanced approach would acknowledge the diverse circumstances of individual employees.';

export default function ReadScreen({ pool, themeKey, onTheme, onBack, onSpeak, onMarkWrong, hydrateWord }: ReadScreenProps) {
  const [text, setText] = useState('');
  const [picked, setPicked] = useState<Word | null>(null); // 轻量词条
  const [rich, setRich] = useState<Word | null>(null); // 懒加载补齐后的词条
  const [added, setAdded] = useState<Record<Word['id'], boolean>>({}); // id -> 已加入错词本
  const curId = useRef<Word['id'] | null>(null); // 防止快速切词时旧的 hydrate 覆盖

  const lookup = useMemo(() => buildLookup(pool), [pool]);
  useDict(); // 预加载广义词典：点任意词都能查（但不参与高亮，避免整段全亮）
  const freq = useFreq();
  // 高亮只认考研核心词库(lookup)；广义词典词不高亮，但点击仍走 resolveTap 可查
  const segs = useMemo(() => annotate(text, lookup), [text, lookup]);
  const hitCount = useMemo(() => new Set(segs.filter((s) => isKeyHit(s.w, s.t, lookup, freq)).map((s) => (s.w as Word).word)).size, [segs, lookup, freq]);

  const openWord = async (entry: Word) => {
    curId.current = entry.id;
    setPicked(entry);
    setRich(null);
    if (!hydrateWord) return;
    const h = await hydrateWord(entry);
    if (curId.current === entry.id) setRich(h);
  };
  const close = () => {
    curId.current = null;
    setPicked(null);
    setRich(null);
  };
  const tapWord = async (raw: string) => {
    let entry = resolveTap(raw, lookup);
    if (entry._missing && isDictLoading()) {
      openWord({ ...entry, base_meaning: '词典加载中…' });
      await loadDict();
      entry = resolveTap(raw, lookup); // 词典就绪后重判
    }
    openWord(entry);
  };

  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="section-title">真题精读 · 粘贴标注</div>

      <textarea
        className="read-input"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="把任意一段真题阅读原文粘到这里 —— 考研词会自动高亮，点词看释义、加错词本。文本只在本机处理，不上传。"
        rows={5}
      />

      <div className="row gap8 mt8" style={{ alignItems: 'center' }}>
        <button className="btn ghost" style={{ minHeight: 40, fontSize: 13 }} onClick={() => setText(SAMPLE)}>
          示例
        </button>
        {text && (
          <button className="btn ghost" style={{ minHeight: 40, fontSize: 13 }} onClick={() => setText('')}>
            <Eraser size={14} /> 清空
          </button>
        )}
        <span className="label grow" style={{ textAlign: 'right' }}>
          {text ? `标出 ${hitCount} 重点词 · 点任意词可查` : '示例句也是自写的，换成你的真题更香'}
        </span>
      </div>

      {text ? (
        <div className="read-passage fade">
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
      ) : (
        <div className="label center mt16" style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.8 }}>
          在阅读原文里背词，比孤立背高效得多。<br />
          高亮 = 命中你的考研词库；点一下即弹释义/词根/例句/助记。
        </div>
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
        onClose={close}
      />
    </>
  );
}
