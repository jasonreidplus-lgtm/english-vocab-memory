import React, { useEffect, useMemo, useState } from 'react';
import { Puzzle, RotateCw, Home, Check } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import { shuffle, sample } from '../lib/shuffle';
import type { Word } from '../types';

const PAIRS = 5;

type Side = 'en' | 'cn';
interface Pick {
  side: Side;
  id: Word['id'];
}

interface MatchScreenProps {
  pool: Word[];
  themeKey: string;
  onTheme: (k: string) => void;
  onBack?: () => void;
  onReward: (n: number) => void;
  onStudied: (n: number) => void;
}

export default function MatchScreen({ pool, themeKey, onTheme, onBack, onReward, onStudied }: MatchScreenProps) {
  const [round, setRound] = useState(0);
  const words = useMemo(() => sample(pool, Math.min(PAIRS, pool.length)), [pool, round]);
  const left = useMemo(() => shuffle(words), [words]); // 英文列
  const right = useMemo(() => shuffle(words), [words]); // 释义列

  const [sel, setSel] = useState<Pick | null>(null); // { side, id }
  const [matched, setMatched] = useState<Set<Word['id']>>(() => new Set());
  const [wrong, setWrong] = useState<Pick | null>(null); // { side, id }
  const [rewarded, setRewarded] = useState(false);

  const done = words.length > 0 && matched.size === words.length;

  // 每轮重置
  useEffect(() => {
    setSel(null);
    setMatched(new Set());
    setWrong(null);
    setRewarded(false);
  }, [words]);

  useEffect(() => {
    if (done && !rewarded) {
      setRewarded(true);
      onReward && onReward(words.length * 4);
      onStudied && onStudied(words.length);
    }
  }, [done, rewarded, words.length, onReward]);

  const tap = (side: Side, id: Word['id']) => {
    if (matched.has(id) || done) return;
    if (!sel) {
      setSel({ side, id });
      return;
    }
    if (sel.side === side) {
      setSel({ side, id }); // 同列改选
      return;
    }
    // 异列：比对是否同一个词
    if (sel.id === id) {
      const nm = new Set(matched);
      nm.add(id);
      setMatched(nm);
      setSel(null);
    } else {
      setWrong({ side, id });
      setSel(null);
      setTimeout(() => setWrong(null), 380);
    }
  };

  const cls = (side: Side, id: Word['id']) => {
    let c = 'match-item';
    if (side === 'en') c += ' en';
    if (matched.has(id)) c += ' matched';
    else if (sel && sel.side === side && sel.id === id) c += ' sel';
    else if (wrong && wrong.side === side && wrong.id === id) c += ' wrong';
    return c;
  };

  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="row between mt16">
        <span className="label">
          <Puzzle size={14} style={{ verticalAlign: -2, marginRight: 4 }} />
          词根连连看 · 连对 {matched.size}/{words.length}
        </span>
      </div>
      <div className="bar mt12">
        <i style={{ width: `${words.length ? (matched.size / words.length) * 100 : 0}%` }} />
      </div>

      {done ? (
        <div className="center fade" style={{ paddingTop: 40 }}>
          <Check size={50} color="var(--good)" />
          <div className="result-title" style={{ marginTop: 8 }}>全部连对！</div>
          <div className="label mt12" style={{ fontSize: 15 }}>+{words.length * 4} XP</div>
          <div className="row gap10" style={{ marginTop: 22 }}>
            <button className="btn primary grow" onClick={() => setRound((r) => r + 1)}>
              <RotateCw size={16} /> 再来一组
            </button>
            <button className="btn ghost grow" onClick={onBack}>
              <Home size={15} /> 返回
            </button>
          </div>
        </div>
      ) : (
        <>
          <div className="label center" style={{ marginTop: 14, fontSize: 12, opacity: 0.8 }}>
            点一个单词，再点它的释义
          </div>
          <div className="match-wrap">
            <div className="match-col">
              {left.map((w) => (
                <button key={w.id} className={cls('en', w.id)} onClick={() => tap('en', w.id)}>
                  {w.word}
                </button>
              ))}
            </div>
            <div className="match-col">
              {right.map((w) => (
                <button key={w.id} className={cls('cn', w.id)} onClick={() => tap('cn', w.id)}>
                  {w.base_meaning}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </>
  );
}
