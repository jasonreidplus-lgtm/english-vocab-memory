import React, { useEffect, useMemo, useState } from 'react';
import { RotateCw, ArrowLeft, ArrowRight, Zap, ChevronRight, Volume2, Check, HelpCircle } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import type { Word } from '../types';

interface Section {
  key: string;
  icon: string;
  title: string;
  body: React.ReactNode;
}

// 从词条提取“可分层展开”的信息块(空的自动跳过)
function sectionsOf(w: Word): Section[] {
  const list: Section[] = [];
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

interface LayerProps {
  sec: Section;
  open: boolean;
  onToggle: () => void;
}

function Layer({ sec, open, onToggle }: LayerProps) {
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

// 用户自定义记忆法(#13b)：查看 / 添加 / 编辑，存进 progress.userNotes
function MyNote({ value, onSave }: { value: string; onSave: (t: string) => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(value);
  useEffect(() => { setText(value); setEditing(false); }, [value]);
  return (
    <div className="layer mynote">
      <div className="layer__head" style={{ cursor: 'default' }}>
        <span className="lh-left"><span>✍️</span>我的记忆法</span>
        {!editing && (
          <button className="mynote-btn" onClick={() => setEditing(true)}>{value ? '编辑' : '添加'}</button>
        )}
      </div>
      {editing ? (
        <div className="layer__body">
          <textarea
            className="mynote-area"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="写个帮你记住它的联想/拆解/例句…"
            rows={3}
            autoFocus
          />
          <div className="row gap8" style={{ marginTop: 8 }}>
            <button className="btn ghost grow" onClick={() => { setText(value); setEditing(false); }}>取消</button>
            <button className="btn primary grow" onClick={() => { onSave(text); setEditing(false); }}>保存</button>
          </div>
        </div>
      ) : (
        value && <div className="layer__body">{value}</div>
      )}
    </div>
  );
}

export interface LearnScreenProps {
  words: Word[];
  group?: number | null;
  title?: string;
  mode?: 'learn' | 'browse';
  themeKey: string;
  onTheme: (k: string) => void;
  onBack: () => void;
  onStart: () => void;
  onSpeak?: (t: string) => void;
  onMarkWrong?: (id: number | string) => void;
  userNotes?: Record<string, string>;
  onSetUserNote?: (id: number | string, text: string) => void;
}

export default function LearnScreen({ words, group, title, mode = 'learn', themeKey, onTheme, onBack, onStart, onSpeak, onMarkWrong, userNotes, onSetUserNote }: LearnScreenProps) {
  const browse = mode === 'browse';
  const heading = title || `第 ${group} 关`;
  const [li, setLi] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const [marked, setMarked] = useState<Record<string, boolean>>({}); // 本次「不认识」标记 { [id]: true }
  const markedCount = Object.keys(marked).length;

  const total = words.length;
  const word = words[li];
  const sections = useMemo(() => sectionsOf(word), [word]);

  // 切到新词：翻回正面、收起所有分层、自动发音(受「音效朗读」开关控制)
  useEffect(() => {
    setFlipped(false);
    setOpen({});
    if (word) onSpeak?.(word.word);
  }, [li]); // eslint-disable-line react-hooks/exhaustive-deps

  const go = (dir: number) => setLi((v) => Math.min(total - 1, Math.max(0, v + dir)));

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
              {onSetUserNote && word && (
                <MyNote key={word.id} value={userNotes?.[word.id] || ''} onSave={(t) => onSetUserNote(word.id, t)} />
              )}
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

      {/* 学习自评：不认识 → 加入间隔复习并前进；认识 → 前进；末词 → 直接开始闯关。
          这两个键同时承担「下一个」的前进功能，故下方导航不再放独立「下一个」(#8) */}
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
                else onStart();
              }}
            >
              <HelpCircle size={16} /> 不认识
            </button>
            <button
              className="btn ghost grow"
              style={{ color: 'var(--good)' }}
              onClick={() => (li < total - 1 ? go(1) : onStart())}
            >
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

      {/* 导航：始终保留「上一个」。学习模式前进交给上面的 认识/不认识，这里直接给「开始闯关」；
          浏览模式没有自评键，保留「下一个/完成」 */}
      <div className="row gap10 mt12">
        <button className="btn ghost grow" onClick={() => go(-1)} disabled={li === 0}>
          <ArrowLeft size={17} /> 上一个
        </button>
        {browse ? (
          li < total - 1 ? (
            <button className="btn grow" onClick={() => go(1)}>
              下一个 <ArrowRight size={17} />
            </button>
          ) : (
            <button className="btn primary" style={{ flex: 1.4 }} onClick={onStart}>
              完成 <Check size={17} />
            </button>
          )
        ) : (
          <button className="btn primary" style={{ flex: 1.4 }} onClick={onStart}>
            开始闯关 <Zap size={17} />
          </button>
        )}
      </div>
    </div>
  );
}
