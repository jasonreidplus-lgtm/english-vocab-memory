import React from 'react';
import { Volume2, BookmarkPlus, Check, X } from 'lucide-react';
import { useModalA11y } from '../lib/useModalA11y.js';

// 点词弹层（真题精读 / 句子精读 / 查词共用）。entry=轻量词条，rich=懒加载补齐后的词条。
export default function WordPopup({ entry, rich, added, onSpeak, onAddWrong, onClose }) {
  if (!entry) return null;
  return (
    <WordPopupModal
      entry={entry}
      rich={rich}
      added={added}
      onSpeak={onSpeak}
      onAddWrong={onAddWrong}
      onClose={onClose}
    />
  );
}

function WordPopupModal({ entry, rich, added, onSpeak, onAddWrong, onClose }) {
  const ref = useModalA11y(onClose);
  const card = rich || entry;
  return (
    <div className="modal-backdrop fade" onClick={onClose}>
      <div
        className="modal word-pop"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={`单词 ${card.word}`}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between">
          <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="word" style={{ fontSize: 30 }}>{card.word}</span>
            {card.pos && <span className="pos">{card.pos}</span>}
          </div>
          <button className="pill" onClick={onClose} aria-label="关闭" style={{ padding: '6px 8px' }}>
            <X size={18} />
          </button>
        </div>
        {card.phonetic && <div className="ph" style={{ marginTop: 4 }}>{card.phonetic}</div>}
        <div className="cn" style={{ marginTop: 10, fontSize: 20, textAlign: 'left' }}>{card.base_meaning}</div>

        {rich && rich.roots && <div className="pop-sec">🧩 {rich.roots}</div>}
        {rich && rich.examples && rich.examples[0] && (
          <div className="pop-sec">
            <div className="en">{rich.examples[0].en}</div>
            <div className="cnex">{rich.examples[0].cn}</div>
          </div>
        )}
        {rich && rich.confusions && <div className="pop-sec">🔍 {rich.confusions}</div>}
        {rich && rich.mnemonic && <div className="pop-sec">💡 {rich.mnemonic}</div>}

        <div className="row gap10 mt12">
          <button className="btn ghost" onClick={() => onSpeak && onSpeak(card.word)} aria-label="朗读">
            <Volume2 size={18} />
          </button>
          {!entry._missing && (
            <button className="btn grow" disabled={!!added} onClick={onAddWrong}>
              {added ? (
                <><Check size={16} /> 已加入错词本</>
              ) : (
                <><BookmarkPlus size={16} /> 加入错词本</>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
