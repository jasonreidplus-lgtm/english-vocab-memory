/* 进度备份：把 localStorage 里的全部进度导出成一个 JSON 文件 / 从文件导回；
   另提供「跨设备备份码」(gzip+base64，浏览器原生 CompressionStream，无依赖)：
   一台设备「复制」→ 发给另一台「粘贴导入」，免文件传输(#7)。
   进度只存在本机浏览器(STORAGE_KEY)，清缓存或换设备会全没——这是唯一的兜底。 */
import { STORAGE_KEY } from '../state/progress';

const pad = (n: number) => String(n).padStart(2, '0');
const CODE_MARK = 'WQ1:'; // 压缩备份码前缀(便于识别格式)

export function exportProgress(): void {
  const raw = localStorage.getItem(STORAGE_KEY) || '{}';
  const blob = new Blob([raw], { type: 'application/json' });
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

/** 校验大致像进度对象才接受，然后覆盖写入。成功返回 true。 */
function applyJsonText(text: string): boolean {
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    return false;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data)) return false;
  const obj = data as Record<string, unknown>;
  if (!('v' in obj || 'levels' in obj || 'themeKey' in obj || 'wrong' in obj)) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
    return true;
  } catch {
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
  const stream = new Blob([b64ToBytes(b64)]).stream().pipeThrough(ds);
  const ab = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(ab);
}

/** 生成可复制的备份码：默认压缩；环境不支持则退回明文 JSON。 */
export async function exportProgressCode(): Promise<string> {
  const raw = localStorage.getItem(STORAGE_KEY) || '{}';
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
  if (json.startsWith(CODE_MARK)) {
    try {
      json = await gunzipFromB64(json.slice(CODE_MARK.length));
    } catch {
      return false;
    }
  }
  return applyJsonText(json);
}
