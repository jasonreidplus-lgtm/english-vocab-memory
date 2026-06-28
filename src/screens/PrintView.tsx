/* 打印 / 导出 PDF 视图：全屏覆盖，渲染所选单词列表；挂载后自动唤起打印对话框，
   用户在框里「另存为 PDF」。中文走系统字体零乱码；每条 break-inside:avoid 防跨页截断。
   每页固定词数(默认 30)，每满一页插分页符(#1)。 */
import React, { useEffect, useMemo, useState } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import type { Word } from '../types';

interface PrintViewProps {
  title: string;
  words: Word[];
  onClose: () => void;
}

const PER_PAGE_OPTIONS = [20, 30, 50, 100];

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

export default function PrintView({ title, words, onClose }: PrintViewProps) {
  const [perPage, setPerPage] = useState(30);
  const pages = useMemo(() => chunk(words, perPage), [words, perPage]);

  useEffect(() => {
    const t = setTimeout(() => window.print(), 450); // 等渲染完再唤起打印
    return () => clearTimeout(t);
  }, []);

  return (
    <div className="print-root">
      <div className="print-toolbar">
        <button className="pill" onClick={onClose} aria-label="返回">
          <ArrowLeft size={16} /> 返回
        </button>
        <span className="label">{title} · {words.length} 词 · {pages.length} 页</span>
        <span className="print-pp">
          每页
          <select value={perPage} onChange={(e) => setPerPage(Number(e.target.value))}>
            {PER_PAGE_OPTIONS.map((n) => (
              <option key={n} value={n}>{n}</option>
            ))}
          </select>
          词
        </span>
        <button className="pill print-go" onClick={() => window.print()}>
          <Printer size={16} /> 打印 / 存 PDF
        </button>
      </div>

      {pages.map((pageWords, pi) => (
        <div className="print-page" key={pi}>
          <div className="pv-head">
            <h1 className="pv-title">{title}</h1>
            <span className="pv-pageno">{pi + 1} / {pages.length}</span>
          </div>
          {pi === 0 && (
            <div className="pv-meta">
              考研背单词 · 共 {words.length} 词 · 每页 {perPage} 词 · 打印对话框里选「另存为 PDF」
            </div>
          )}
          <ol className="pv-list" start={pi * perPage + 1}>
            {pageWords.map((w, i) => (
              <li key={`${w.id}-${i}`} className="pv-item">
                <span className="pv-word">{w.word}</span>
                {w.phonetic && <span className="pv-ph">{w.phonetic}</span>}
                <span className="pv-mean">
                  {w.pos && <em className="pv-pos">{w.pos}</em>} {w.base_meaning}
                </span>
              </li>
            ))}
          </ol>
        </div>
      ))}
      {!words.length && (
        <div className="print-page">
          <div className="pv-empty">没有符合条件的单词。</div>
        </div>
      )}
    </div>
  );
}
