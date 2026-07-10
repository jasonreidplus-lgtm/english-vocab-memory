/* 打印 / 导出 PDF 视图：全屏覆盖，渲染所选单词列表。
   Android 由原生 PrintManager 唤起系统打印，Web/PWA 回退 window.print()。
   中文走系统字体零乱码；每条 break-inside:avoid 防跨页截断。
   每页固定词数(默认 30)，每满一页插分页符(#1)。 */
import React, { useEffect, useMemo, useState } from 'react';
import { Printer, ArrowLeft } from 'lucide-react';
import { isNativeAndroid, printDocument } from '../lib/nativePrint';
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
  const [printing, setPrinting] = useState(false);
  const [printError, setPrintError] = useState('');
  const pages = useMemo(() => chunk(words, perPage), [words, perPage]);

  useEffect(() => {
    if (isNativeAndroid()) return; // Android WebView 不能用 JS 自动触发打印
    const t = setTimeout(() => window.print(), 450); // Web/PWA 保留原有自动打印
    return () => clearTimeout(t);
  }, []);

  const handlePrint = async () => {
    if (printing) return;
    setPrintError('');
    setPrinting(true);
    try {
      await printDocument(title);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error || '');
      setPrintError(detail || '无法打开打印服务，请稍后重试');
    } finally {
      setPrinting(false);
    }
  };

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
        <button className="pill print-go" onClick={handlePrint} disabled={printing} aria-busy={printing}>
          <Printer size={16} /> {printing ? '正在打开…' : '打印 / 存 PDF'}
        </button>
      </div>

      {printError && (
        <div role="alert" className="pv-empty" style={{ color: '#b42318', padding: '10px 24px' }}>
          打印失败：{printError}
        </div>
      )}

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
