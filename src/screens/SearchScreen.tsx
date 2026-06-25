import React, { useMemo, useRef, useState } from 'react';
import { Search, X } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import WordPopup from '../components/WordPopup';
import { shortMeaning } from '../game/quiz';
import { dictEntry } from '../lib/dict';
import { useDict } from '../lib/useDict';
import type { Word } from '../types';

interface SearchScreenProps {
  pool: Word[];
  themeKey: string;
  onTheme: (k: string) => void;
  onBack?: () => void;
  onSpeak?: (word: string) => void;
  onMarkWrong?: (id: Word['id']) => void;
  hydrateWord?: (entry: Word) => Promise<Word> | Word;
}

/* 全局查词：考研核心词(释义丰富) + 广义词典(59k 词)即时检索，点结果看词卡。 */
export default function SearchScreen({ pool, themeKey, onTheme, onBack, onSpeak, onMarkWrong, hydrateWord }: SearchScreenProps) {
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState<Word | null>(null);
  const [rich, setRich] = useState<Word | null>(null);
  const [added, setAdded] = useState<Record<string, boolean>>({});
  const curId = useRef<Word['id'] | null>(null);

  const dict = useDict();
  const results = useMemo<Word[]>(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const cn = q.trim();
    const seen = new Set<string>();
    const out: Word[] = [];
    const push = (e: Word | null) => {
      const k = e && e.word && e.word.toLowerCase();
      if (k && !seen.has(k)) { seen.add(k); out.push(e as Word); }
    };
    // 考研核心词优先(释义更丰富)
    const cs: Word[] = [], ci: Word[] = [], cm: Word[] = [];
    for (const w of pool) {
      if (!w || !w.word) continue;
      const lw = w.word.toLowerCase();
      if (lw.startsWith(s)) cs.push(w);
      else if (lw.includes(s)) ci.push(w);
      else if (w.base_meaning && w.base_meaning.includes(cn)) cm.push(w);
    }
    [...cs, ...ci, ...cm].forEach(push);
    // 广义词典补充
    if (dict && out.length < 50) {
      const ds = [], di = [];
      for (const word in dict) {
        if (seen.has(word)) continue;
        if (word.startsWith(s)) ds.push(word);
        else if (di.length < 80 && word.includes(s)) di.push(word);
        if (ds.length >= 80) break;
      }
      [...ds, ...di].forEach((word) => push(dictEntry(word)));
    }
    return out.slice(0, 50);
  }, [q, pool, dict]);

  const openWord = async (entry: Word) => {
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
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setQ(e.target.value)}
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
        <div className="label center" style={{ paddingTop: 44 }}>输入即查 · 考研核心 {pool.length} 词 + 广义词典</div>
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
