/* 进度备份：把 localStorage 里的全部进度导出成一个 JSON 文件 / 从文件导回。
   进度只存在本机浏览器(STORAGE_KEY)，清缓存或换设备会全没——这是唯一的兜底。 */
import { STORAGE_KEY } from '../state/progress';

const pad = (n: number) => String(n).padStart(2, '0');

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

/** 导入并覆盖。校验大致像进度对象才接受。成功返回 true(调用方应随后刷新页面)。 */
export async function importProgress(file: File): Promise<boolean> {
  let data: unknown;
  try {
    data = JSON.parse(await file.text());
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
