/* PDF 导出视图：先在本机直接生成真实 PDF，再按平台保存或下载。
   不调用浏览器或系统打印服务；电脑、手机、平板共用同一份矢量 PDF 排版。 */
import React, { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, FileDown } from 'lucide-react';
import { generateVocabularyPdfBlob } from '../lib/pdfDocument';
import { makePdfFileName, pdfSaveInstructions, savePdfBlob } from '../lib/pdfSave';
import type { Word } from '../types';

interface PrintViewProps {
  title: string;
  words: Word[];
  onClose: () => void;
}

const PER_PAGE_OPTIONS = [20, 30, 50, 100];

export default function PrintView({ title, words, onClose }: PrintViewProps) {
  const [perPage, setPerPage] = useState(30);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('正在准备 PDF…');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const pageCount = Math.ceil(words.length / perPage);
  const previewWords = useMemo(() => words.slice(0, perPage), [words, perPage]);
  const saveHelp = useMemo(() => pdfSaveInstructions(), []);
  const fileName = useMemo(() => makePdfFileName(title), [title]);

  useEffect(() => {
    let active = true;
    let createdUrl = '';
    const controller = new AbortController();
    setPdfBlob(null);
    setPdfUrl('');
    setProgress(0);
    setStatus('正在准备 PDF…');
    setError('');

    if (!words.length) {
      setStatus('没有可导出的单词');
      return () => undefined;
    }

    generateVocabularyPdfBlob({
      title,
      words,
      perPage,
      signal: controller.signal,
      onProgress: (value, label) => {
        if (!active) return;
        setProgress(value);
        setStatus(label);
      },
    }).then((blob) => {
      if (!active) return;
      createdUrl = URL.createObjectURL(blob);
      setPdfBlob(blob);
      setPdfUrl(createdUrl);
      setProgress(1);
      setStatus(`PDF 已生成 · ${(blob.size / 1024).toFixed(0)} KB`);
    }).catch((reason) => {
      if (!active) return;
      const detail = reason instanceof Error ? reason.message : String(reason || '');
      setError(detail || 'PDF 生成失败，请重试');
      setStatus('PDF 生成失败');
    });

    return () => {
      active = false;
      controller.abort();
      if (createdUrl) URL.revokeObjectURL(createdUrl);
    };
  }, [title, words, perPage]);

  const handleSave = async () => {
    if (!pdfBlob || saving) return;
    setSaving(true);
    setError('');
    try {
      const result = await savePdfBlob(pdfBlob, title, pdfUrl, (value, label) => {
        setProgress(value);
        setStatus(label);
      });
      setProgress(1);
      setStatus(result.message);
    } catch (reason) {
      const detail = reason instanceof Error ? reason.message : String(reason || '');
      setError(detail || 'PDF 保存失败，请点下方链接直接下载');
      setStatus('PDF 保存失败');
    } finally {
      setSaving(false);
    }
  };

  const generating = !pdfBlob && !error && words.length > 0;

  return (
    <div className="print-root">
      <div className="print-toolbar">
        <button className="pill" onClick={onClose} aria-label="返回">
          <ArrowLeft size={16} /> 返回
        </button>
        <span className="label">{title} · {words.length} 词 · {pageCount} 页</span>
        <span className="print-pp">
          每页
          <select value={perPage} disabled={saving || generating} onChange={(event) => setPerPage(Number(event.target.value))}>
            {PER_PAGE_OPTIONS.map((value) => <option key={value} value={value}>{value}</option>)}
          </select>
          词
        </span>
        <button
          className="pill print-go"
          onClick={handleSave}
          disabled={!pdfBlob || saving || !words.length}
          aria-busy={generating || saving}
          aria-label="保存 PDF 文件"
        >
          <FileDown size={16} /> {generating ? '正在生成 PDF…' : saving ? '正在保存 PDF…' : '保存 PDF'}
        </button>
      </div>

      <div className="pdf-save-help" role="note">
        <b>直接 PDF：</b>{saveHelp}
        <div className="pdf-progress" aria-hidden="true"><i style={{ width: `${Math.round(progress * 100)}%` }} /></div>
        <div className="pdf-status" role="status" aria-live="polite">{status}</div>
        {pdfUrl && (
          <a className="pdf-direct-link" href={pdfUrl} download={fileName}>
            微信没有自动下载？点这里直接下载 PDF
          </a>
        )}
      </div>

      {error && (
        <div role="alert" className="pv-empty pdf-error">
          {error}
          {pdfUrl && <>；也可点上方“直接下载 PDF”</>}
        </div>
      )}

      {!!words.length && (
        <div className="print-page">
          <div className="pv-head">
            <h1 className="pv-title">{title}</h1>
            <span className="pv-pageno">1 / {pageCount}</span>
          </div>
          <div className="pv-meta">
            考研背单词 · 共 {words.length} 词 · 每页 {perPage} 词 · 已在本机直接生成 PDF
          </div>
          <ol className="pv-list">
            {previewWords.map((word, index) => (
              <li key={`${word.id}-${index}`} className="pv-item">
                <span className="pv-word">{word.word}</span>
                {word.phonetic && <span className="pv-ph">{word.phonetic}</span>}
                <span className="pv-mean">
                  {word.pos && <em className="pv-pos">{word.pos}</em>} {word.base_meaning}
                </span>
              </li>
            ))}
          </ol>
          {pageCount > 1 && <div className="pdf-preview-note">页面仅预览第 1 页；保存的 PDF 包含全部 {pageCount} 页。</div>}
        </div>
      )}
      {!words.length && <div className="print-page"><div className="pv-empty">没有符合条件的单词。</div></div>}
    </div>
  );
}
