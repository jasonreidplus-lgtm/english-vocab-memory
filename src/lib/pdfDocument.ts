import type { Word } from '../types';

const FONT_BASE = `${import.meta.env?.BASE_URL || './'}fonts/pdf/`;
const FONT_FILES = [
  'WordQuestSansSC-Regular.ttf',
  'WordQuestSans-Regular.ttf',
  'WordQuestSans-Bold.ttf',
] as const;

const A4_WIDTH = 595.28;
const A4_HEIGHT = 841.89;
const PAGE_LEFT = 28;
const PAGE_RIGHT = 28;
const CONTENT_TOP = 98;
const CONTENT_BOTTOM = 812;

export type PdfFontVfs = Record<string, string>;
type PdfFontBuffers = Record<(typeof FONT_FILES)[number], Uint8Array>;

export interface VocabularyPdfOptions {
  title: string;
  words: Word[];
  perPage: number;
  onProgress?: (progress: number, label: string) => void;
  signal?: AbortSignal;
}

/** 这些字符低于中日韩区，但 Noto Sans Latin 不含，必须回退到 SC 字体。 */
export const PDF_SC_FALLBACK_CODEPOINTS = [
  0x2160, 0x2191, 0x2460, 0x2461, 0x2462, 0x2502, 0x2510,
  0x251a, 0x2529, 0x252d, 0x252e, 0x2542, 0x25a0,
] as const;
const PDF_SC_FALLBACK = new Set<number>(PDF_SC_FALLBACK_CODEPOINTS);

interface PdfKitDocument {
  on(event: 'data', listener: (chunk: Uint8Array) => void): this;
  on(event: 'end', listener: () => void): this;
  on(event: 'error', listener: (error: Error) => void): this;
  registerFont(name: string, source: Uint8Array): this;
  addPage(options: Record<string, unknown>): this;
  font(name: string): this;
  fontSize(size: number): this;
  fillColor(color: string): this;
  strokeColor(color: string): this;
  lineWidth(width: number): this;
  text(text: string, x: number, y: number, options?: Record<string, unknown>): this;
  widthOfString(text: string): number;
  moveTo(x: number, y: number): this;
  lineTo(x: number, y: number): this;
  stroke(): this;
  end(): void;
}

type PdfKitConstructor = new (options: Record<string, unknown>) => PdfKitDocument;

let pdfKitPromise: Promise<PdfKitConstructor> | null = null;
let fontBuffersPromise: Promise<PdfFontBuffers> | null = null;
let generationQueue: Promise<void> = Promise.resolve();

function loadPdfKit(): Promise<PdfKitConstructor> {
  if (!pdfKitPromise) {
    // 预构建的 standalone 版本自带浏览器所需 stream/zlib 兼容层，WebView 也可离线运行。
    pdfKitPromise = import('pdfkit/js/pdfkit.standalone.js').then((module) => (
      (module.default || module) as unknown as PdfKitConstructor
    )).catch((error) => {
      pdfKitPromise = null;
      throw error;
    });
  }
  return pdfKitPromise;
}

async function loadFontBuffers(): Promise<PdfFontBuffers> {
  if (!fontBuffersPromise) {
    fontBuffersPromise = (async () => {
      const entries = await Promise.all(FONT_FILES.map(async (fileName) => {
        const url = new URL(`${FONT_BASE}${fileName}`, document.baseURI).href;
        const response = await fetch(url, { cache: 'force-cache' });
        if (!response.ok) throw new Error(`PDF 字体加载失败（${response.status}）`);
        return [fileName, new Uint8Array(await response.arrayBuffer())] as const;
      }));
      return Object.fromEntries(entries) as PdfFontBuffers;
    })().catch((error) => {
      fontBuffersPromise = null;
      throw error;
    });
  }
  return fontBuffersPromise;
}

function suppliedVfsToBuffers(vfs: PdfFontVfs): PdfFontBuffers {
  return Object.fromEntries(FONT_FILES.map((fileName) => {
    const binary = atob(vfs[fileName] || '');
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
    return [fileName, bytes];
  })) as PdfFontBuffers;
}

/** 去掉 PDF 字体不应接收的控制符、格式符、代理项和私用区字符。 */
export function sanitizePdfText(value: unknown): string {
  return String(value ?? '')
    .replace(/[\p{Cc}\p{Cf}\p{Cs}\p{Co}]/gu, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export function pdfPageCount(wordCount: number, perPage: number): number {
  if (!Number.isFinite(wordCount) || wordCount <= 0) return 0;
  const size = Math.max(1, Math.floor(perPage || 1));
  return Math.ceil(wordCount / size);
}

export function pdfColumnsFor(perPage: number): number {
  if (perPage <= 20) return 2;
  if (perPage <= 30) return 3;
  if (perPage <= 50) return 4;
  return 5;
}

export function pdfFontNameForCharacter(char: string): 'WordQuestSans' | 'WordQuestSansSC' {
  const codePoint = char.codePointAt(0) ?? 0;
  return codePoint < 0x2e80 && !PDF_SC_FALLBACK.has(codePoint) ? 'WordQuestSans' : 'WordQuestSansSC';
}

function layoutFor(perPage: number) {
  if (perPage <= 20) return { word: 11.2, ordinal: 9.0, phonetic: 7.2, meaning: 8.3, columnGap: 20 };
  if (perPage <= 30) return { word: 10.1, ordinal: 7.9, phonetic: 6.7, meaning: 7.6, columnGap: 14 };
  if (perPage <= 50) return { word: 9.0, ordinal: 6.8, phonetic: 6.2, meaning: 6.9, columnGap: 10 };
  return { word: 7.8, ordinal: 5.6, phonetic: 5.5, meaning: 6.0, columnGap: 7 };
}

function abortError(): Error {
  try {
    return new DOMException('PDF 生成已取消', 'AbortError');
  } catch {
    const error = new Error('PDF 生成已取消');
    error.name = 'AbortError';
    return error;
  }
}

function assertNotAborted(signal?: AbortSignal): void {
  if (signal?.aborted) throw abortError();
}

function fitText(doc: PdfKitDocument, value: string, width: number): string {
  if (width <= 0 || !value) return '';
  if (doc.widthOfString(value) <= width) return value;
  const suffix = '…';
  let low = 0;
  let high = value.length;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (doc.widthOfString(`${value.slice(0, middle)}${suffix}`) <= width) low = middle;
    else high = middle - 1;
  }
  return low ? `${value.slice(0, low)}${suffix}` : '';
}

function drawHeader(doc: PdfKitDocument, title: string, pageIndex: number, pageCount: number, wordCount: number, perPage: number): void {
  doc.font('WordQuestSansSC').fontSize(18).fillColor('#111111')
    .text(title, PAGE_LEFT, 34, { width: 420, height: 24, ellipsis: true, lineBreak: false });
  doc.font('WordQuestSans').fontSize(8).fillColor('#6b746e')
    .text(`${pageIndex + 1} / ${pageCount}`, 470, 40, { width: 97, align: 'right', lineBreak: false });
  doc.moveTo(PAGE_LEFT, 62).lineTo(A4_WIDTH - PAGE_RIGHT, 62)
    .lineWidth(1.3).strokeColor('#1f2923').stroke();
  doc.font('WordQuestSansSC').fontSize(7.4).fillColor('#67716a')
    .text(`考研背单词 · 共 ${wordCount} 词 · 每页 ${perPage} 词 · 直接生成 PDF`, PAGE_LEFT, 73, { lineBreak: false });
}

function drawEntry(
  doc: PdfKitDocument,
  word: Word,
  ordinal: number,
  x: number,
  y: number,
  width: number,
  rowHeight: number,
  perPage: number,
): void {
  const layout = layoutFor(perPage);
  const ordinalText = `${ordinal}. `;
  doc.font('WordQuestSans').fontSize(layout.ordinal).fillColor('#738078')
    .text(ordinalText, x, y, { lineBreak: false });
  let cursor = x + doc.widthOfString(ordinalText);

  doc.font('WordQuestSansBold').fontSize(layout.word).fillColor('#111111');
  const spelling = fitText(doc, sanitizePdfText(word.word), Math.max(0, width - (cursor - x)));
  doc.text(spelling, cursor, y, { lineBreak: false });
  cursor += doc.widthOfString(spelling);

  if (word.phonetic && cursor < x + width - 4) {
    doc.font('WordQuestSans').fontSize(layout.phonetic).fillColor('#66706a');
    const phonetic = fitText(doc, `  ${sanitizePdfText(word.phonetic)}`, x + width - cursor);
    if (phonetic) doc.text(phonetic, cursor, y, { lineBreak: false });
  }

  const meaning = [sanitizePdfText(word.pos), sanitizePdfText(word.base_meaning)].filter(Boolean).join(' ');
  doc.font('WordQuestSansSC').fontSize(layout.meaning).fillColor('#303632')
    .text(meaning, x, y + 11, {
      width,
      height: Math.max(layout.meaning + 1, rowHeight - 12),
      ellipsis: true,
      lineGap: 0,
    });
}

function concatChunks(chunks: Uint8Array[], totalBytes: number): Uint8Array {
  const output = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

async function renderVocabularyPdf(options: VocabularyPdfOptions, fonts: PdfFontBuffers): Promise<Uint8Array> {
  const PDFDocument = await loadPdfKit();
  assertNotAborted(options.signal);
  const doc = new PDFDocument({
    autoFirstPage: false,
    bufferPages: false,
    compress: true,
    info: {
      Title: sanitizePdfText(options.title) || '考研词关',
      Author: '考研词关',
      Subject: '考研单词 PDF',
      Creator: '考研词关 v1.2.1',
      Producer: 'PDFKit',
    },
  });
  doc.registerFont('WordQuestSansSC', fonts['WordQuestSansSC-Regular.ttf']);
  doc.registerFont('WordQuestSans', fonts['WordQuestSans-Regular.ttf']);
  doc.registerFont('WordQuestSansBold', fonts['WordQuestSans-Bold.ttf']);

  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const completion = new Promise<Uint8Array>((resolve, reject) => {
    doc.on('data', (chunk) => {
      const bytes = chunk instanceof Uint8Array ? chunk : new Uint8Array(chunk);
      chunks.push(bytes);
      totalBytes += bytes.byteLength;
    });
    doc.on('end', () => resolve(concatChunks(chunks, totalBytes)));
    doc.on('error', reject);
  });

  const title = sanitizePdfText(options.title) || '考研词关';
  const perPage = Math.max(1, Math.floor(options.perPage || 30));
  const pageCount = pdfPageCount(options.words.length, perPage);
  const columns = pdfColumnsFor(perPage);
  const layout = layoutFor(perPage);
  const columnWidth = (A4_WIDTH - PAGE_LEFT - PAGE_RIGHT - layout.columnGap * (columns - 1)) / columns;

  try {
    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
      assertNotAborted(options.signal);
      doc.addPage({ size: 'A4', margins: { top: 34, right: PAGE_RIGHT, bottom: 30, left: PAGE_LEFT } });
      drawHeader(doc, title, pageIndex, pageCount, options.words.length, perPage);
      const pageWords = options.words.slice(pageIndex * perPage, (pageIndex + 1) * perPage);
      const rows = Math.ceil(pageWords.length / columns);
      const rowHeight = (CONTENT_BOTTOM - CONTENT_TOP) / rows;

      for (let column = 0; column < columns; column++) {
        for (let row = 0; row < rows; row++) {
          const localIndex = column * rows + row;
          if (localIndex >= pageWords.length) continue;
          drawEntry(
            doc,
            pageWords[localIndex],
            pageIndex * perPage + localIndex + 1,
            PAGE_LEFT + column * (columnWidth + layout.columnGap),
            CONTENT_TOP + row * rowHeight,
            columnWidth,
            rowHeight,
            perPage,
          );
        }
      }

      if ((pageIndex + 1) % 4 === 0 || pageIndex === pageCount - 1) {
        options.onProgress?.(
          0.28 + ((pageIndex + 1) / pageCount) * 0.64,
          `正在生成 PDF（${pageIndex + 1}/${pageCount} 页）…`,
        );
        await new Promise<void>((resolve) => setTimeout(resolve, 0));
      }
    }
    assertNotAborted(options.signal);
  } catch (error) {
    // 中途离开导出页时只收尾已经写出的页面，释放字体与流对象，不继续生成剩余页。
    doc.end();
    await completion.catch(() => undefined);
    throw error;
  }

  doc.end();
  return completion;
}

async function generateVocabularyPdfBytesNow(options: VocabularyPdfOptions, suppliedVfs?: PdfFontVfs): Promise<Uint8Array> {
  if (!options.words.length) throw new Error('没有可导出的单词');
  assertNotAborted(options.signal);
  options.onProgress?.(0.08, '正在加载 PDF 引擎…');
  const [, fonts] = await Promise.all([
    loadPdfKit(),
    suppliedVfs ? Promise.resolve(suppliedVfsToBuffers(suppliedVfs)) : loadFontBuffers(),
  ]);
  assertNotAborted(options.signal);
  options.onProgress?.(0.24, '正在排版单词…');
  const bytes = await renderVocabularyPdf(options, fonts);
  if (bytes.byteLength < 5) throw new Error('PDF 生成失败：文件为空');
  options.onProgress?.(1, 'PDF 已生成');
  return bytes;
}

export function generateVocabularyPdfBytes(options: VocabularyPdfOptions, suppliedVfs?: PdfFontVfs): Promise<Uint8Array> {
  const task = generationQueue.then(() => generateVocabularyPdfBytesNow(options, suppliedVfs));
  generationQueue = task.then(() => undefined, () => undefined);
  return task;
}

export async function generateVocabularyPdfBlob(options: VocabularyPdfOptions, suppliedVfs?: PdfFontVfs): Promise<Blob> {
  const bytes = await generateVocabularyPdfBytes(options, suppliedVfs);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return new Blob([copy.buffer], { type: 'application/pdf' });
}

/** 首屏空闲时调用，让离线用户在进入导出页前已缓存引擎和字体。 */
export async function warmPdfExporter(): Promise<void> {
  await Promise.all([loadPdfKit(), loadFontBuffers()]);
}
