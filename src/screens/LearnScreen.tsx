import React, { useEffect, useMemo, useState } from 'react';
import { RotateCw, ArrowLeft, ArrowRight, Zap, ChevronRight, Volume2, Check, HelpCircle } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';

// 从词条提取“可分层展开”的信息块(空的自动跳过)
function sectionsOf(w) {
  const list = [];
  if (w.roots) list.push({ key: 'roots', icon: '🧩', title: '词根拆解', body: <span>{w.roots}</span> });
  if (Array.isArray(w.examples) && w.examples.length) {
    list.push({
      key: 'examples',
      icon: '📝',
      title: '例句',
      body: (
        <div className="stack gap8">
          {w.examples.slice(0, 2).map((ex, i) => (
            <div key={i}>
              <div className="en">{ex.en}</div>
              <div className="cnex">{ex.cn}</div>
            </div>
          ))}
        </div>
      ),
    });
  }
  if (w.confusions) list.push({ key: 'confusions', icon: '🔍', title: '辨析', body: <span>{w.confusions}</span> });
  if (w.mnemonic) list.push({ key: 'mnemonic', icon: '💡', title: '助记', body: <span>{w.mnemonic}</span> });
  if (w.exam_tip) list.push({ key: 'exam_tip', icon: '🎯', title: '考点', body: <span>{w.exam_tip}</span> });
  return list;
}

function Layer({ sec, open, onToggle }) {
  return (
    <div className="layer">
      <button className="layer__head" onClick={onToggle} aria-expanded={open}>
        <span className="lh-left">
          <span>{sec.icon}</span>
          {sec.title}
        </span>
        <ChevronRight size={16} className={`chev ${open ? 'open' : ''}`} />
      </button>
      {open && <div className="layer__body">{sec.body}</div>}
    </div>
  );
}

export default function LearnScreen({ words, group, title, mode = 'learn', themeKey, onTheme, onBack, onStart, onSpeak, onMarkWrong }) {
  const browse = mode === 'browse';
  const heading = title || `第 ${group} 关`;
  const [li, setLi] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [open, setOpen] = useState({});
  const [marked, setMarked] = useState({}); // 本次「不认识」标记 { [id]: true }
  const markedCount = Object.keys(marked).length;

  const total = words.length;
  const word = words[li];
  const sections = useMemo(() => sectionsOf(word), [word]);

  // 切到新词：翻回正面、收起所有分层
  useEffect(() => {
    setFlipped(false);
    setOpen({});
  }, [li]);

  const go = (dir) => setLi((v) => Math.min(total - 1, Math.max(0, v + dir)));

  return (
    <div className="learn">
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="row between mt16">
        <span className="label">
          {heading} · {browse ? '浏览' : '学习'} {li + 1}/{total}
        </span>
        <div className="bar grow" style={{ marginLeft: 12 }}>
          <i style={{ width: `${((li + 1) / total) * 100}%` }} />
        </div>
      </div>

      <div className="stage">
        <div className={`card3d ${flipped ? 'flip' : ''}`}>
          {/* 正面 */}
          <div className="face" onClick={() => setFlipped(true)}>
            <div className="word">{word.word}</div>
            <div className="ph">{word.phonetic}</div>
            {word.pos && <div className="pos">{word.pos}</div>}
            <div className="hint">
              <RotateCw size={13} /> 点击翻面看释义
            </div>
          </div>

          {/* 背面 */}
          <div className="face back">
            <button
              className="back-head"
              onClick={() => setFlipped(false)}
              aria-label="翻回正面"
            >
              <div className="cn">{word.base_meaning}</div>
              {word.pos && (
                <div className="label" style={{ marginTop: 4 }}>
                  {word.pos}
                </div>
              )}
              <div className="hint">
                <RotateCw size={12} /> 点此翻回 · 点下方逐层展开
              </div>
            </button>

            <div className="layers">
              {sections.map((sec) => (
                <Layer
                  key={sec.key}
                  sec={sec}
                  open={!!open[sec.key]}
                  onToggle={() => setOpen((o) => ({ ...o, [sec.key]: !o[sec.key] }))}
                />
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 发音 + 翻面快捷 */}
      <div className="row gap10">
        <button className="btn ghost" onClick={() => onSpeak && onSpeak(word.word)} aria-label="朗读">
          <Volume2 size={18} />
        </button>
        <button className="btn ghost grow" onClick={() => setFlipped((f) => !f)}>
          <RotateCw size={16} /> 翻面
        </button>
      </div>

      {/* 学习自评：不认识 → 加入间隔复习；认识 → 跳过 */}
      {!browse && onMarkWrong && (
        <>
          <div className="row gap10 mt12">
            <button
              className="btn ghost grow"
              style={{ color: 'var(--bad)' }}
              onClick={() => {
                if (!marked[word.id]) onMarkWrong(word.id);
                setMarked((m) => ({ ...m, [word.id]: true }));
                if (li < total - 1) go(1);
              }}
            >
              <HelpCircle size={16} /> 不认识
            </button>
            <button className="btn ghost grow" style={{ color: 'var(--good)' }} onClick={() => li < total - 1 && go(1)}>
              <Check size={16} /> 认识
            </button>
          </div>
          {markedCount > 0 && (
            <div className="label center" style={{ marginTop: 6, fontSize: 12 }}>
              本次已加入复习 {markedCount} 词
            </div>
          )}
        </>
      )}

      {/* 上一个 / 下一个 / 开始闯关 */}
      <div className="row gap10 mt12">
        <button className="btn ghost grow" onClick={() => go(-1)} disabled={li === 0}>
          <ArrowLeft size={17} /> 上一个
        </button>
        {li < total - 1 ? (
          <button className="btn grow" onClick={() => go(1)}>
            下一个 <ArrowRight size={17} />
          </button>
        ) : browse ? (
          <button className="btn primary" style={{ flex: 1.4 }} onClick={onStart}>
            完成 <Check size={17} />
          </button>
        ) : (
          <button className="btn primary" style={{ flex: 1.4 }} onClick={onStart}>
            开始闯关 <Zap size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
