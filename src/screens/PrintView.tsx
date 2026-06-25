/* 打印 / 导出 PDF 视图：全屏覆盖，渲染所选单词列表；挂载后自动唤起打印对话框，
   用户在框里「另存为 PDF」。中文走系统字体零乱码；每条 break-inside:avoid 防跨页截断。 */
import React, { useEffect } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import type { Word } from '../types';

interface PrintViewProps {
  title: string;
  words: Word[];
  onClose: () => void;
}

export default function PrintView({ title, words, onClose }: PrintViewProps) {
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
        <span className="label">{title} · {words.length} 词</span>
        <button className="pill print-go" onClick={() => window.print()}>
          <Printer size={16} /> 打印 / 存 PDF
        </button>
      </div>

      <div className="print-page">
        <h1 className="pv-title">{title}</h1>
        <div className="pv-meta">考研背单词 · 共 {words.length} 词 · 打印对话框里选「另存为 PDF」</div>
        <ol className="pv-list">
          {words.map((w, i) => (
            <li key={`${w.id}-${i}`} className="pv-item">
              <span className="pv-word">{w.word}</span>
              {w.phonetic && <span className="pv-ph">/{w.phonetic}/</span>}
              <span className="pv-mean">
                {w.pos && <em className="pv-pos">{w.pos}</em>} {w.base_meaning}
              </span>
            </li>
          ))}
        </ol>
        {!words.length && <div className="pv-empty">没有符合条件的单词。</div>}
      </div>
    </div>
  );
}
