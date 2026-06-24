import React, { useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import HeaderBar from '../components/HeaderBar.jsx';
import WordPopup from '../components/WordPopup.jsx';
import { shortMeaning } from '../game/quiz.js';

/* 全局查词：在全部就绪词里按单词/中文释义即时检索，点结果看词卡(懒加载富字段)。 */
export default function SearchScreen({ pool, themeKey, onTheme, onBack, onSpeak, onMarkWrong, hydrateWord }) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const [rich, setRich] = useState(null);
  const [added, setAdded] = useState({});
  const curId = useRef(null);

  const results = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const cn = q.trim();
    const starts = [];
    const incl = [];
    const meaning = [];
    for (const w of pool) {
      if (!w || !w.word) continue;
      const lw = w.word.toLowerCase();
      if (lw.startsWith(s)) starts.push(w);
      else if (lw.includes(s)) incl.push(w);
      else if (w.base_meaning && w.base_meaning.includes(cn)) meaning.push(w);
    }
    return [...starts, ...incl, ...meaning].slice(0, 50);
  }, [q, pool]);

  const openWord = async (entry) => {
    curId.current = entry.id;
    setPicked(entry);
    setRich(null);
    if (hydrateWord) {
      const h = await hydrateWord(entry);
      if (curId.current === entry.id) setRich(h);
    }
  };
  const closePop = () => {
    curId.current = null;
    setPicked(null);
    setRich(null);
  };

  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="section-title">查词</div>
      <div className="search-box">
        <Search size={16} className="muted" />
        <input
          className="search-input"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="输入单词或中文释义"
          autoFocus
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        {q && (
          <button className="pill" onClick={() => setQ('')} aria-label="清空" style={{ padding: '4px 6px' }}>
            <X size={15} />
          </button>
        )}
      </div>

      {!q.trim() ? (
        <div className="label center" style={{ paddingTop: 44 }}>输入即查 · 共 {pool.length} 词可查</div>
      ) : results.length === 0 ? (
        <div className="label center" style={{ paddingTop: 44 }}>没有匹配「{q.trim()}」的词</div>
      ) : (
        <div className="stack gap8 mt12">
          {results.map((w) => (
            <button key={w.id} className="gloss-item" onClick={() => openWord(w)}>
              <span className="gloss-w">
                {w.word}
                {w.pos ? <span className="gloss-pos"> {w.pos}</span> : null}
              </span>
              <span className="gloss-m">{shortMeaning(w.base_meaning, 22)}</span>
            </button>
          ))}
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
        onClose={closePop}
      />
    </>
  );
}
