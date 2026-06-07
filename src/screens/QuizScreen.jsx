import React, { useEffect, useRef, useState } from 'react';
import { Check, X, ArrowRight, Volume2, Zap, Lightbulb } from 'lucide-react';
import HeaderBar from '../components/HeaderBar.jsx';
import { checkSpelling, shortMeaning } from '../game/quiz.js';

export default function QuizScreen({ questions, group, heading, themeKey, onTheme, onBack, onComplete, onSpeak }) {
  const title = heading || `第 ${group} 关`;
  const total = questions.length;
  const [qi, setQi] = useState(0);
  const [flags, setFlags] = useState(() => Array(total).fill(false));
  const [answered, setAnswered] = useState(false);
  const [picked, setPicked] = useState(null); // choice: 选项文本 / spell: 提交的拼写
  const [input, setInput] = useState('');
  const [shake, setShake] = useState(false);
  const [hint, setHint] = useState(0); // 拼写题已揭示的字母数
  const inputRef = useRef(null);

  const q = questions[qi];
  const isOptions = q.type === 'choice' || q.type === 'cn2en'; // 选择类(英选中/中选英)
  const correctCount = flags.filter(Boolean).length;
  const lastQuestion = qi + 1 >= total;

  // 进入拼写题自动聚焦，唤起手机键盘
  useEffect(() => {
    if (q.type === 'spell' && !answered && inputRef.current) inputRef.current.focus();
  }, [qi, q.type, answered]);

  const record = (ok) => {
    setFlags((f) => {
      const n = f.slice();
      n[qi] = ok;
      return n;
    });
    setAnswered(true);
  };

  const answerChoice = (opt) => {
    if (answered) return;
    setPicked(opt);
    record(opt === q.answer);
  };

  const submitSpell = () => {
    if (answered || !input.trim()) return;
    const ok = checkSpelling(input, q.answer);
    setPicked(input);
    record(ok);
    if (!ok) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
    }
  };

  const next = () => {
    if (lastQuestion) {
      onComplete(flags);
      return;
    }
    setQi(qi + 1);
    setAnswered(false);
    setPicked(null);
    setInput('');
    setShake(false);
    setHint(0);
  };

  // 桌面键盘：选择题按 1-4 选，答完后 Enter 进入下一题
  useEffect(() => {
    const onKey = (e) => {
      const tag = (e.target.tagName || '').toLowerCase();
      if (e.key === 'Enter') {
        if (answered) {
          e.preventDefault();
          next();
        }
        return;
      }
      if (isOptions && !answered && tag !== 'input' && /^[1-4]$/.test(e.key)) {
        const opt = q.options[Number(e.key) - 1];
        if (opt != null) {
          e.preventDefault();
          answerChoice(opt);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, isOptions, qi]); // eslint-disable-line react-hooks/exhaustive-deps

  // 选项显示：长释义只显首义；若缩短后出现重复则退回完整文本，避免歧义
  let optionDisplay = (o) => o;
  if (q.type === 'choice') {
    const shorts = q.options.map((o) => shortMeaning(o));
    if (new Set(shorts).size === shorts.length) {
      const map = new Map(q.options.map((o, i) => [o, shorts[i]]));
      optionDisplay = (o) => map.get(o);
    }
  }

  // 拼写题提示串：已揭示字母 + 占位点
  const hintStr = q.answer
    .split('')
    .map((ch, i) => (i < hint ? ch : ch === ' ' ? ' ' : '·'))
    .join('');

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
        {/* ===== 选择题(英选中 / 中选英) ===== */}
        {isOptions ? (
          <>
            <div className="label" style={{ marginBottom: 8 }}>
              {q.type === 'choice' ? '选出正确释义' : '选出正确单词'}
            </div>
            <div className="face" style={{ position: 'relative', minHeight: 0, padding: '24px 20px', marginBottom: 16, boxShadow: 'var(--shadow), var(--card-glow)' }}>
              {q.type === 'choice' ? (
                <>
                  <div className="word" style={{ fontSize: 'calc(var(--word-size) * 0.78)' }}>{q.w.word}</div>
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
                    <span>{optionDisplay(o)}</span>
                  </span>
                  {answered && o === q.answer && <Check size={19} />}
                  {answered && o === picked && o !== q.answer && <X size={19} />}
                </button>
              );
            })}
          </>
        ) : (
          /* ===== 拼写题 ===== */
          <>
            <div className="label" style={{ marginBottom: 8 }}>根据释义 + 音标，拼出单词</div>
            <div className="face" style={{ position: 'relative', minHeight: 0, padding: '22px 20px', marginBottom: 16 }}>
              <div className="cn">{q.w.base_meaning}</div>
              <div className="ph" style={{ marginTop: 8 }}>{q.w.phonetic}</div>
              {q.w.pos && <div className="label" style={{ marginTop: 8 }}>{q.w.pos}</div>}
            </div>

            <div className="spell-slots" aria-hidden>
              {q.answer.split('').map((ch, i) => (
                <span key={i} className="slot" style={{ width: ch === ' ' ? 8 : 14, opacity: ch === ' ' ? 0 : 0.5 }} />
              ))}
            </div>

            {hint > 0 && !answered && <div className="spell-hint" aria-hidden>{hintStr}</div>}

            <input
              ref={inputRef}
              className={`spell-input ${shake ? 'shake' : ''} ${answered ? (flags[qi] ? 'correct' : 'wrong') : ''}`}
              value={answered ? picked : input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') (answered ? next() : submitSpell()); }}
              disabled={answered}
              placeholder="输入单词…"
              autoCapitalize="off"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              inputMode="text"
            />

            {answered ? (
              <div className="row gap8 mt12" style={{ justifyContent: 'center' }}>
                {!flags[qi] && <span className="spell-reveal">正确答案：{q.answer}</span>}
                <button className="pill" onClick={() => onSpeak && onSpeak(q.answer)} aria-label="朗读">
                  <Volume2 size={16} /> 听
                </button>
              </div>
            ) : (
              <div className="row gap8 mt12">
                <button
                  className="btn ghost"
                  onClick={() => setHint((h) => Math.min(q.answer.length - 1, h + 1))}
                  disabled={hint >= q.answer.length - 1}
                  aria-label="提示"
                >
                  <Lightbulb size={16} /> 提示
                </button>
                <button className="btn primary grow" onClick={submitSpell} disabled={!input.trim()}>
                  提交 <Check size={17} />
                </button>
              </div>
            )}
          </>
        )}

        {/* ===== 下一题 ===== */}
        {answered && (
          <button className="btn primary block fade mt12" onClick={next}>
            {lastQuestion ? '查看成绩' : '下一题'} <ArrowRight size={17} />
          </button>
        )}
      </div>
    </>
  );
}
