/* 完整备份：把学习进度 + 用户导入文章/已读状态导出成 JSON 文件 / 从文件导回；
   另提供「跨设备备份码」(gzip+base64，浏览器原生 CompressionStream，无依赖)：
   一台设备「复制」→ 发给另一台「粘贴导入」，免文件传输(#7)。
   数据只存在本机浏览器，清缓存或换设备会全没——这是唯一的兜底。 */
import { STORAGE_KEY } from '../state/progress';
import { PASSAGES_STORAGE_KEY } from './passages';

const pad = (n: number) => String(n).padStart(2, '0');
const CODE_MARK = 'WQ2:'; // 完整备份码（学习进度 + 阅读库）
const LEGACY_CODE_MARK = 'WQ1:'; // 兼容旧版仅进度备份码
const BACKUP_FORMAT = 'wordquest-backup';

type JsonRecord = Record<string, unknown>;
const isRecord = (v: unknown): v is JsonRecord => !!v && typeof v === 'object' && !Array.isArray(v);

function parseStored(key: string): unknown {
  try {
    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

function makeBackupText(pretty = false): string {
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: 2,
      progress: parseStored(STORAGE_KEY),
      passages: parseStored(PASSAGES_STORAGE_KEY),
    },
    null,
    pretty ? 2 : 0
  );
}

export function exportProgress(): void {
  const blob = new Blob([makeBackupText(true)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const d = new Date();
  a.href = url;
  a.download = `考研词关-备份-${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function isProgressObject(data: unknown, allowEmpty = false): data is JsonRecord {
  if (!isRecord(data)) return false;
  const obj = data as JsonRecord;
  const hasMarker = ['v', 'levels', 'themeKey', 'cards', 'wrong'].some((k) => k in obj);
  if (!hasMarker && !(allowEmpty && Object.keys(obj).length === 0)) return false;
  if ('v' in obj && typeof obj.v !== 'number') return false;
  if ('themeKey' in obj && typeof obj.themeKey !== 'string') return false;
  if ('levels' in obj && (!isRecord(obj.levels) || !Object.values(obj.levels).every(isRecord))) return false;
  for (const key of ['cards', 'wrong']) {
    if (!(key in obj)) continue;
    const entries = obj[key];
    if (!isRecord(entries) || !Object.values(entries).every((e) => isRecord(e) && (e.miss === undefined || typeof e.miss === 'number') && (e.card === undefined || isRecord(e.card)))) return false;
  }
  for (const key of ['history', 'newHistory', 'reviewHistory', 'timeHistory']) {
    if (key in obj && (!isRecord(obj[key]) || !Object.values(obj[key]).every((v) => typeof v === 'number'))) return false;
  }
  if ('savedWordHistory' in obj && (!isRecord(obj.savedWordHistory) || !Object.values(obj.savedWordHistory).every((ids) => Array.isArray(ids) && ids.every((id) => typeof id === 'string' || typeof id === 'number')))) return false;
  if ('userNotes' in obj && (!isRecord(obj.userNotes) || !Object.values(obj.userNotes).every((v) => typeof v === 'string'))) return false;
  if ('daily' in obj && obj.daily !== null && (!isRecord(obj.daily) || typeof obj.daily.date !== 'string' || typeof obj.daily.count !== 'number' || typeof obj.daily.streak !== 'number' || typeof obj.daily.goal !== 'number')) return false;
  if ('revlog' in obj && (!Array.isArray(obj.revlog) || !obj.revlog.every(isRecord))) return false;
  if ('stats' in obj && (!isRecord(obj.stats) || typeof obj.stats.answered !== 'number' || typeof obj.stats.correct !== 'number')) return false;
  return true;
}

function isPassagesObject(data: unknown): data is JsonRecord {
  if (!isRecord(data)) return false;
  if ('imported' in data) {
    if (!Array.isArray(data.imported)) return false;
    if (!data.imported.every((p) => isRecord(p) && typeof p.id === 'string' && typeof p.title === 'string' && typeof p.en === 'string' && (p.cn === undefined || typeof p.cn === 'string'))) return false;
  }
  if ('studied' in data && (!isRecord(data.studied) || !Object.values(data.studied).every((v) => typeof v === 'boolean'))) return false;
  return true;
}

/** 严格校验备份结构再覆盖写入；兼容旧版仅进度 JSON。 */
function applyJsonText(text: string): boolean {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return false;
  }
  if (!isRecord(data)) return false;
  const envelope = data.format === BACKUP_FORMAT;
  const progress = envelope ? data.progress : data;
  const passages = envelope ? data.passages : undefined;
  if (!isProgressObject(progress, envelope)) return false;
  if (envelope && !isPassagesObject(passages)) return false;
  const oldProgress = localStorage.getItem(STORAGE_KEY);
  const oldPassages = localStorage.getItem(PASSAGES_STORAGE_KEY);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
    if (envelope) localStorage.setItem(PASSAGES_STORAGE_KEY, JSON.stringify(passages));
    return true;
  } catch {
    try {
      if (oldProgress == null) localStorage.removeItem(STORAGE_KEY); else localStorage.setItem(STORAGE_KEY, oldProgress);
      if (oldPassages == null) localStorage.removeItem(PASSAGES_STORAGE_KEY); else localStorage.setItem(PASSAGES_STORAGE_KEY, oldPassages);
    } catch {
      /* 回滚也失败时只能保留浏览器现状 */
    }
    return false;
  }
}

/** 导入并覆盖(文件)。成功返回 true(调用方应随后刷新页面)。 */
export async function importProgress(file: File): Promise<boolean> {
  return applyJsonText(await file.text());
}

// —— 跨设备备份码：gzip + base64 ——
const hasCompression = typeof (globalThis as { CompressionStream?: unknown }).CompressionStream !== 'undefined';

function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  const CH = 0x8000; // 分块避免 String.fromCharCode 参数过多栈溢出
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}
function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function gzipToB64(text: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const cs = new (globalThis as any).CompressionStream('gzip');
  const stream = new Blob([new TextEncoder().encode(text)]).stream().pipeThrough(cs);
  const ab = await new Response(stream).arrayBuffer();
  return bytesToB64(new Uint8Array(ab));
}
async function gunzipFromB64(b64: string): Promise<string> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ds = new (globalThis as any).DecompressionStream('gzip');
  const bytes = b64ToBytes(b64);
  // TS 6 会把 Uint8Array 的底层缓冲区视为 ArrayBufferLike；复制成明确的 ArrayBuffer 供 Blob 使用。
  const data = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const stream = new Blob([data]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(ab);
}

/** 生成可复制的备份码：默认压缩；环境不支持则退回明文 JSON。 */
export async function exportProgressCode(): Promise<string> {
  const raw = makeBackupText();
  if (hasCompression) {
    try {
      return CODE_MARK + (await gzipToB64(raw));
    } catch {
      /* 回退明文 */
    }
  }
  return raw;
}

/** 从备份码导入覆盖：识别压缩前缀则先解压，否则按明文 JSON 处理。 */
export async function importProgressCode(text: string): Promise<boolean> {
  let json = text.trim();
  if (!json) return false;
  if (json.startsWith(CODE_MARK) || json.startsWith(LEGACY_CODE_MARK)) {
    try {
      const marker = json.startsWith(CODE_MARK) ? CODE_MARK : LEGACY_CODE_MARK;
      json = await gunzipFromB64(json.slice(marker.length));
    } catch {
      return false;
    }
  }
  return applyJsonText(json);
}
