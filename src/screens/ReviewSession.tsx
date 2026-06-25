import React, { useEffect, useMemo, useState } from 'react';
import { Volume2 } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import { GRADES, previewDays, intervalLabel, Rating } from '../lib/fsrs';
import type { Word, SerializedCard } from '../types';
import type { Grade } from 'ts-fsrs';

export interface ReviewItem {
  word: Word;
  card?: SerializedCard;
}

interface ReviewSessionProps {
  items: ReviewItem[];
  themeKey: string;
  onTheme: (k: string) => void;
  onBack: () => void;
  onGrade: (id: number | string, grade: Grade) => void;
  onFinish: (reviewed: number) => void;
  onSpeak?: (t: string) => void;
}

const GRADE_META: Record<Grade, { label: string; cls: string }> = {
  [Rating.Again]: { label: '忘了', cls: 'rev-again' },
  [Rating.Hard]: { label: '模糊', cls: 'rev-hard' },
  [Rating.Good]: { label: '记得', cls: 'rev-good' },
  [Rating.Easy]: { label: '秒答', cls: 'rev-easy' },
};

export default function ReviewSession({ items, themeKey, onTheme, onBack, onGrade, onFinish, onSpeak }: ReviewSessionProps) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const total = items.length;
  const item: ReviewItem | undefined = items[idx];
  const done = idx >= total && total > 0;

  // 当前词的四档下次间隔(天)，按钮上预览
  const previews = useMemo(() => (item ? previewDays(item.card, new Date()) : null), [item]);

  const grade = (g: Grade) => {
    if (!item) return;
    onGrade(item.word.id, g);
    setRevealed(false);
    setIdx((i) => i + 1);
  };

  // 键盘：空格/回车翻面；翻面后 1-4 评分
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (done || !item) return;
      if (!revealed && (e.key === ' ' || e.key === 'Enter')) {
        e.preventDefault();
        setRevealed(true);
        return;
      }
      if (revealed && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) as Grade);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [revealed, done, item]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!total) {
    return (
      <>
        <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />
        <div className="center label" style={{ paddingTop: 100 }}>暂无待复习的词 🎉</div>
      </>
    );
  }

  if (done) {
    return (
      <>
        <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />
        <div className="center fade" style={{ paddingTop: 60 }}>
          <div style={{ fontSize: 56 }}>🎉</div>
          <h2 style={{ margin: '10px 0 4px' }}>复习完成</h2>
          <p className="label">本轮自评复习 {total} 词，已按 FSRS 重新排期</p>
          <button className="rev-finish" onClick={() => onFinish(total)}>完成</button>
        </div>
      </>
    );
  }

  const w = item!.word;
  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} extra={<span className="label">{idx + 1} / {total}</span>} />
      <div className="rev">
        <div className="rev-bar"><div className="rev-bar__fill" style={{ width: `${(idx / total) * 100}%` }} /></div>

        <div className="rev-card">
          <div className="rev-word">{w.word}</div>
          {w.phonetic && <div className="rev-ph">{w.phonetic}</div>}
          <button className="rev-speak" onClick={() => onSpeak?.(w.word)} aria-label="朗读">
            <Volume2 size={20} />
          </button>

          {revealed ? (
            <div className="rev-back fade">
              {w.pos && <span className="rev-pos">{w.pos}</span>}
              <div className="rev-mean">{w.base_meaning}</div>
              {w.examples && w.examples[0] && (
                <div className="rev-eg">
                  {w.examples[0].en}
                  {w.examples[0].cn && <><br /><span className="label">{w.examples[0].cn}</span></>}
                </div>
              )}
            </div>
          ) : (
            <button className="rev-reveal" onClick={() => setRevealed(true)}>显示释义</button>
          )}
        </div>

        {revealed && previews && (
          <div className="rev-grades">
            {GRADES.map((g) => (
              <button key={g} className={`rev-grade ${GRADE_META[g].cls}`} onClick={() => grade(g)}>
                <span className="rev-grade__label">{GRADE_META[g].label}</span>
                <span className="rev-grade__iv">{intervalLabel(previews[g])}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
