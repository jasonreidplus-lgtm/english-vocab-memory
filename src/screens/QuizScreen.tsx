import React, { useEffect, useMemo, useState } from 'react';
import { Check, X, ArrowRight, Volume2, Zap } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import { shortMeaning } from '../game/quiz';
import { buildLookup } from '../lib/annotate';
import { freqOf } from '../lib/freq';
import { useFreq } from '../lib/useFreq';
import FreqBadge from '../components/FreqBadge';
import type { Question, Word } from '../types';

export interface QuizScreenProps {
  questions: Question[];
  group?: number | null;
  heading?: string;
  pool: Word[];
  themeKey: string;
  onTheme: (k: string) => void;
  onBack: () => void;
  onComplete: (flags: boolean[]) => void;
  onSpeak?: (t: string) => void;
}

export default function QuizScreen({ questions, group, heading, pool, themeKey, onTheme, onBack, onComplete, onSpeak }: QuizScreenProps) {
  const title = heading || `第 ${group} 关`;
  const total = questions.length;
  const lookup = useMemo(() => buildLookup(pool), [pool]);
  const freq = useFreq();
  const [qi, setQi] = useState(0);
  const [flags, setFlags] = useState<boolean[]>(() => Array(total).fill(false));
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState<string | null>(null);

  const q = questions[qi];
  const correctCount = flags.filter(Boolean).length;
  const lastQuestion = qi + 1 >= total;

  const record = (ok: boolean) => {
    setFlags((f) => {
      const n = f.slice();
      n[qi] = ok;
      return n;
    });
    setAnswered(true);
  };

  const answerChoice = (opt: string) => {
    if (answered) return;
    setPicked(opt);
    record(opt === q.answer);
  };

  const next = () => {
    if (lastQuestion) {
      onComplete(flags);
      return;
    }
    setQi(qi + 1);
    setAnswered(false);
    setPicked(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (answered) {
          e.preventDefault();
          next();
        }
        return;
      }
      if (!answered && /^[1-4]$/.test(e.key)) {
        const opt = q.options[Number(e.key) - 1];
        if (opt != null) {
          e.preventDefault();
          answerChoice(opt);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, qi]); // eslint-disable-line react-hooks/exhaustive-deps

  let optionDisplay: (o: string) => string | undefined = (o) => o;
  if (q.type === 'choice') {
    const shorts = q.options.map((o) => shortMeaning(o));
    if (new Set(shorts).size === shorts.length) {
      const map = new Map(q.options.map((o, i) => [o, shorts[i]]));
      optionDisplay = (o) => map.get(o);
    }
  }

  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="row between mt16">
        <span className="label">{title} · 闯关 {qi + 1}/{total}</span>
        <span className="badge">
          <Zap size={14} color="var(--accent)" /> {correctCount * 10}
        </span>
      </div>
      <div className="bar mt12">
        <i style={{ width: `${(qi / total) * 100}%` }} />
      </div>

      <div className="fade" key={qi} style={{ marginTop: 14 }}>
        <div className="label" style={{ marginBottom: 8 }}>
          {q.type === 'choice' ? '选出正确释义' : '选出正确单词'}
        </div>
        <div
          className="face"
          style={{
            position: 'relative',
            minHeight: 0,
            padding: '24px 20px',
            marginBottom: 16,
            boxShadow: 'var(--shadow), var(--card-glow)',
          }}
        >
          {q.type === 'choice' ? (
            <>
              <div className="word" style={{ fontSize: 'calc(var(--word-size) * 0.78)' }}>{q.w.word}<FreqBadge n={freqOf(freq, q.w.word, lookup)} /></div>
              <div className="ph">{q.w.phonetic}</div>
              <button className="pill" style={{ marginTop: 12 }} onClick={() => onSpeak && onSpeak(q.w.word)} aria-label="朗读">
                <Volume2 size={16} />
              </button>
            </>
          ) : (
            <>
              <div className="cn">{q.w.base_meaning}</div>
              {q.w.pos && <div className="label" style={{ marginTop: 8 }}>{q.w.pos}</div>}
            </>
          )}
        </div>

        {q.options.map((o, i) => {
          let cls = q.type === 'cn2en' ? 'opt opt-en' : 'opt';
          if (answered) {
            if (o === q.answer) cls += ' correct';
            else if (o === picked) cls += ' wrong';
            else cls += ' dim';
          }
          return (
            <button key={o} className={cls} disabled={answered} onClick={() => answerChoice(o)}>
              <span className="opt-left">
                <span className="opt-key" aria-hidden>{i + 1}</span>
                <span>{optionDisplay(o)}{q.type === 'cn2en' && <FreqBadge n={freqOf(freq, o, lookup)} />}</span>
              </span>
              {answered && o === q.answer && <Check size={19} />}
              {answered && o === picked && o !== q.answer && <X size={19} />}
            </button>
          );
        })}

        {answered && (
          <button className="btn primary block fade mt12" onClick={next}>
            {lastQuestion ? '查看成绩' : '下一题'} <ArrowRight size={17} />
          </button>
        )}
      </div>
    </>
  );
}
