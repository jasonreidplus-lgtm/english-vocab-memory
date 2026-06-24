import React, { useMemo, useState } from 'react';
import { Plus, Trash2, Check, ChevronRight, X, BookMarked } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import ConfirmDialog from '../components/ConfirmDialog';
import { buildLookup, annotate } from '../lib/annotate';
import { parseBulk } from '../lib/passages';
import { useModalA11y } from '../lib/useModalA11y';

function ImportModal({ onClose, onSave, onBulk }) {
  const [mode, setMode] = useState('one'); // one | bulk
  const [title, setTitle] = useState('');
  const [en, setEn] = useState('');
  const [cn, setCn] = useState('');
  const [bulk, setBulk] = useState('');
  const bulkCount = useMemo(() => parseBulk(bulk).length, [bulk]);
  const canSaveOne = en.replace(/[^a-z]/gi, '').length >= 15;
  const ref = useModalA11y(onClose);

  return (
    <div className="modal-backdrop fade" onClick={onClose}>
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="导入真题"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ marginBottom: 8 }}>
          <div className="result-title" style={{ fontSize: 20 }}>导入真题</div>
          <button className="pill" onClick={onClose} aria-label="关闭" style={{ padding: '6px 8px' }}><X size={18} /></button>
        </div>

        <span className="seg" style={{ display: 'inline-flex', marginBottom: 10 }}>
          <button className={mode === 'one' ? 'on' : ''} onClick={() => setMode('one')}>单篇</button>
          <button className={mode === 'bulk' ? 'on' : ''} onClick={() => setMode('bulk')}>批量（推荐）</button>
        </span>

        {mode === 'one' ? (
          <>
            <input
              className="jump-input"
              style={{ width: '100%', height: 40, textAlign: 'left', padding: '0 12px', marginBottom: 8 }}
              placeholder="标题（如 2023 英语一 Text 1）"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <textarea
              className="read-input"
              rows={5}
              placeholder="粘贴英文原文（必填）。会自动切句、标出考研词。"
              value={en}
              onChange={(e) => setEn(e.target.value)}
              style={{ marginBottom: 8 }}
            />
            <textarea
              className="read-input"
              rows={3}
              placeholder="粘贴整段中文译文（可选）。中英句数一致时会逐句对照。"
              value={cn}
              onChange={(e) => setCn(e.target.value)}
            />
            <button className="btn primary block mt12" disabled={!canSaveOne} onClick={() => onSave(title, en, cn)}>
              <Check size={16} /> 保存为一关
            </button>
          </>
        ) : (
          <>
            <textarea
              className="read-input"
              rows={9}
              placeholder={'一次粘多篇。每篇前加一行标题（# 开头），例如：\n\n# 2020 Text 1\nFrance, which prides itself...（整篇英文）\n\n# 2020 Text 2\nBiologists estimate that...（整篇英文）'}
              value={bulk}
              onChange={(e) => setBulk(e.target.value)}
            />
            <button className="btn primary block mt12" disabled={bulkCount === 0} onClick={() => onBulk(bulk)}>
              <Check size={16} /> 导入 {bulkCount} 关
            </button>
            <div className="label center mt8" style={{ fontSize: 11, opacity: 0.7, lineHeight: 1.7 }}>
              用 <b>#&nbsp;标题</b> 行分隔每篇（文章内部空行会保留，段落不拆开）。
            </div>
          </>
        )}

        <div className="label center mt8" style={{ fontSize: 11, opacity: 0.7 }}>
          只存你本机浏览器 · 不上传 · 用你自己合法持有的真题材料
        </div>
      </div>
    </div>
  );
}

export default function PassageScreen({ passages, pool, themeKey, onTheme, onBack, onOpen, onImport, onBulkImport, onDelete }) {
  const [importing, setImporting] = useState(false);
  const [delTarget, setDelTarget] = useState(null);
  const lookup = useMemo(() => buildLookup(pool), [pool]);

  const stats = useMemo(() => {
    const m = {};
    for (const p of passages) {
      const text = p.sents.map((s) => s.en).join(' ');
      const hits = new Set(annotate(text, lookup).filter((s) => s.w).map((s) => s.w.word)).size;
      m[p.id] = { sentences: p.sents.length, words: hits };
    }
    return m;
  }, [passages, lookup]);

  const doneCount = passages.filter((p) => p.studied).length;

  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="section-title">
        真题阅读 · 闯关
        <span className="label" style={{ marginLeft: 'auto', fontSize: 12 }}>
          已通 {doneCount}/{passages.length}
        </span>
      </div>

      <button className="btn primary block mt8" onClick={() => setImporting(true)}>
        <Plus size={17} /> 导入一篇真题
      </button>

      <div className="stack gap8 mt12">
        {passages.map((p) => {
          const st = stats[p.id] || { sentences: p.sents.length, words: 0 };
          return (
            <div key={p.id} className={`passage-card${p.studied ? ' is-done' : ''}`}>
              <button className="passage-main" onClick={() => onOpen(p)}>
                <span className="re-icon">
                  {p.studied ? <Check size={20} color="var(--accent)" /> : <BookMarked size={20} color="var(--accent)" />}
                </span>
                <span className="re-text">
                  <span className="re-title">{p.title}</span>
                  <span className="re-sub">{st.sentences} 句 · {st.words} 考研词{p.studied ? ' · 已通关' : ''}</span>
                </span>
                <ChevronRight size={18} className="muted" />
              </button>
              {!p.demo && (
                <button className="passage-del" aria-label="删除" onClick={() => setDelTarget(p)}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          );
        })}
      </div>

      <div className="label center" style={{ marginTop: 18, fontSize: 12, opacity: 0.8, lineHeight: 1.8 }}>
        每篇 = 一关：逐句把考研词挖空，自测 → 揭晓单词+翻译 → 过完通关。<br />
        把近十年 40 篇真题导进来，就是 40 关语境闯关。
      </div>

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onSave={(t, e, c) => {
            onImport(t, e, c);
            setImporting(false);
          }}
          onBulk={(text) => {
            onBulkImport(text);
            setImporting(false);
          }}
        />
      )}

      {delTarget && (
        <ConfirmDialog
          danger
          title="删除这篇真题？"
          message={`「${delTarget.title}」将从本机移除（内置真题不受影响）。`}
          confirmText="删除"
          cancelText="取消"
          onConfirm={() => {
            onDelete(delTarget.id);
            setDelTarget(null);
          }}
          onCancel={() => setDelTarget(null)}
        />
      )}
    </>
  );
}
