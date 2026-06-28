import React, { useEffect, useMemo, useState } from 'react';
import { Check, X, ArrowRight, Volume2, Zap } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import { shortMeaning } from '../game/quiz';
import { buildLookup } from '../lib/annotate';
import { freqOf } from '../lib/freq';
import { useFreq } from '../lib/useFreq';
import FreqBadge from '../components/FreqBadge';
import type { Question, QuizOption, Word } from '../types';

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
  userNotes?: Record<string, string>;
}

export default function QuizScreen({ questions, group, heading, pool, themeKey, onTheme, onBack, onComplete, onSpeak, userNotes }: QuizScreenProps) {
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

  const answerChoice = (key: string) => {
    if (answered) return;
    setPicked(key);
    record(key === q.answer);
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
          answerChoice(opt.key);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, qi]); // eslint-disable-line react-hooks/exhaustive-deps

  // 答题前「选义题」的简短释义显示(若截断后仍互不相同则用短版，否则用全文)
  let choiceLabel: (o: QuizOption) => string = (o) => o.cn;
  if (q.type === 'choice') {
    const shorts = q.options.map((o) => shortMeaning(o.cn));
    if (new Set(shorts).size === shorts.length) {
      const map = new Map(q.options.map((o, i) => [o.key, shorts[i]]));
      choiceLabel = (o) => map.get(o.key) || o.cn;
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
            if (o.key === q.answer) cls += ' correct';
            else if (o.key === picked) cls += ' wrong';
            else cls += ' dim';
          }
          return (
            <button key={o.key} className={cls} disabled={answered} onClick={() => answerChoice(o.key)}>
              <span className="opt-left">
                <span className="opt-key" aria-hidden>{i + 1}</span>
                {answered ? (
                  // 答完：每个选项都给「英文 + 中文」对照(#6)
                  <span className="opt-bi">
                    <b className="opt-bi-en">{o.en}</b>
                    <span className="opt-bi-cn">{o.cn}</span>
                  </span>
                ) : q.type === 'choice' ? (
                  <span>{choiceLabel(o)}</span>
                ) : (
                  <span>{o.en}<FreqBadge n={freqOf(freq, o.en, lookup)} /></span>
                )}
              </span>
              {answered && o.key === q.answer && <Check size={19} />}
              {answered && o.key === picked && o.key !== q.answer && <X size={19} />}
            </button>
          );
        })}

        {/* 答完显示该词记忆方法(#13a)：词根拆解 / 助记 / 我的记忆法(#13b) */}
        {answered && (q.w.roots || q.w.mnemonic || userNotes?.[q.w.id]) && (
          <div className="quiz-mem fade">
            {q.w.roots && (
              <div className="qm-row"><span className="qm-ic">🧩</span><span>{q.w.roots}</span></div>
            )}
            {q.w.mnemonic && (
              <div className="qm-row"><span className="qm-ic">💡</span><span>{q.w.mnemonic}</span></div>
            )}
            {userNotes?.[q.w.id] && (
              <div className="qm-row"><span className="qm-ic">✍️</span><span>{userNotes[q.w.id]}</span></div>
            )}
          </div>
        )}

        {answered && (
          <button className="btn primary block fade mt12" onClick={next}>
            {lastQuestion ? '查看成绩' : '下一题'} <ArrowRight size={17} />
          </button>
        )}
      </div>
    </>
  );
}
