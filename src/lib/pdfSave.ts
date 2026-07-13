import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativePdfSavePlugin {
  begin(options: { fileName: string; totalBytes: number }): Promise<{ transferId: string; chunkBytes: number }>;
  appendChunk(options: { transferId: string; offset: number; base64: string }): Promise<{ receivedBytes: number }>;
  save(options: { transferId: string; fileName: string; totalBytes: number }): Promise<{ status: 'saved' | 'cancelled'; fileName?: string; bytes?: number }>;
  abort(options: { transferId: string }): Promise<void>;
}

const NativePdfSave = registerPlugin<NativePdfSavePlugin>('NativePdfSave');

export type PdfSavePlatform = 'android-native' | 'ios-web' | 'mobile-web' | 'desktop-web';
export type PdfWebSaveMethod = 'file-picker' | 'share' | 'download';
export type PdfSaveStatus = 'saved' | 'shared' | 'downloaded' | 'cancelled';

export interface PdfSaveResult {
  status: PdfSaveStatus;
  message: string;
}

interface SavePickerHandle {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void>; abort?(): Promise<void> }>;
}

interface SavePickerWindow extends Window {
  showSaveFilePicker?: (options: {
    suggestedName: string;
    types: Array<{ description: string; accept: Record<string, string[]> }>;
  }) => Promise<SavePickerHandle>;
}

/** 清理跨平台非法字符；返回不带扩展名的安全标题。 */
export function sanitizePdfDocumentName(value: string): string {
  const withoutExtension = String(value || '').trim().replace(/\.pdf$/i, '');
  let name = withoutExtension
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/-+/g, '-')
    .replace(/[.\s-]+$/g, '')
    .trim()
    .slice(0, 80)
    .replace(/[.\s-]+$/g, '');
  if (!name) name = '考研词关';
  if (/^(?:con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(name)) name = `_${name}`;
  return name;
}

export function makePdfFileName(value: string): string {
  return `${sanitizePdfDocumentName(value)}.pdf`;
}

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export function getPdfSavePlatform(
  userAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent,
  maxTouchPoints = typeof navigator === 'undefined' ? 0 : navigator.maxTouchPoints,
): PdfSavePlatform {
  if (isNativeAndroid()) return 'android-native';
  const ua = String(userAgent || '');
  if (/iPad|iPhone|iPod/i.test(ua) || (/Macintosh/i.test(ua) && maxTouchPoints > 1)) return 'ios-web';
  if (/Android|Mobile|Tablet/i.test(ua)) return 'mobile-web';
  return 'desktop-web';
}

export function choosePdfWebMethod(
  platform: Exclude<PdfSavePlatform, 'android-native'>,
  capabilities: { filePicker: boolean; shareFiles: boolean },
): PdfWebSaveMethod {
  if (platform === 'desktop-web' && capabilities.filePicker) return 'file-picker';
  if ((platform === 'ios-web' || platform === 'mobile-web') && capabilities.shareFiles) return 'share';
  return 'download';
}

export function pdfSaveInstructions(platform: PdfSavePlatform = getPdfSavePlatform()): string {
  switch (platform) {
    case 'android-native':
      return 'Android：应用会直接生成 PDF，再打开“保存到”界面供你选择文件夹和文件名。';
    case 'ios-web':
      return 'iPhone / iPad：应用会直接生成 PDF；点保存后可在共享面板选“存储到文件”，或用下方下载链接。';
    case 'mobile-web':
      return '手机 / 平板：应用会直接生成 PDF；可存到系统文件、下载目录或其他支持 PDF 的应用。';
    default:
      return '电脑：应用会直接生成 PDF；支持时可选择保存位置，否则会下载到浏览器的下载目录。';
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, Math.min(i + 0x8000, bytes.length)));
  }
  return btoa(binary);
}

async function saveAndroidPdf(blob: Blob, fileName: string, onProgress?: (value: number, label: string) => void): Promise<PdfSaveResult> {
  const started = await NativePdfSave.begin({ fileName, totalBytes: blob.size });
  const chunkBytes = Math.max(64 * 1024, Math.min(started.chunkBytes || 256 * 1024, 512 * 1024));
  try {
    for (let offset = 0; offset < blob.size; offset += chunkBytes) {
      const part = new Uint8Array(await blob.slice(offset, Math.min(offset + chunkBytes, blob.size)).arrayBuffer());
      await NativePdfSave.appendChunk({ transferId: started.transferId, offset, base64: bytesToBase64(part) });
      onProgress?.(Math.min(0.92, (offset + part.length) / blob.size * 0.9), '正在准备 PDF 保存…');
    }
    onProgress?.(0.96, '请选择 PDF 保存位置…');
    const result = await NativePdfSave.save({ transferId: started.transferId, fileName, totalBytes: blob.size });
    if (result.status === 'cancelled') return { status: 'cancelled', message: '已取消保存，PDF 仍可重新保存。' };
    return { status: 'saved', message: `PDF 已保存：${result.fileName || fileName}` };
  } catch (error) {
    await NativePdfSave.abort({ transferId: started.transferId }).catch(() => undefined);
    throw error;
  }
}

function canSharePdf(file: File): boolean {
  try {
    return typeof navigator.share === 'function' && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

function triggerPdfDownload(blobUrl: string, fileName: string): void {
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = fileName;
  anchor.rel = 'noopener';
  anchor.style.display = 'none';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

function isAbortError(error: unknown): boolean {
  return !!error && typeof error === 'object' && 'name' in error && error.name === 'AbortError';
}

/** 保存已经生成好的真实 PDF；任何失败都不会退回系统打印。 */
export async function savePdfBlob(
  blob: Blob,
  title: string,
  blobUrl?: string,
  onProgress?: (value: number, label: string) => void,
): Promise<PdfSaveResult> {
  if (!blob.size) throw new Error('PDF 文件为空，请重新生成');
  const fileName = makePdfFileName(title);
  if (isNativeAndroid()) return saveAndroidPdf(blob, fileName, onProgress);

  const platform = getPdfSavePlatform();
  const webPlatform = platform === 'android-native' ? 'mobile-web' : platform;
  const file = new File([blob], fileName, { type: 'application/pdf', lastModified: Date.now() });
  const pickerWindow = window as SavePickerWindow;
  const method = choosePdfWebMethod(webPlatform, {
    filePicker: typeof pickerWindow.showSaveFilePicker === 'function',
    shareFiles: canSharePdf(file),
  });

  if (method === 'file-picker' && pickerWindow.showSaveFilePicker) {
    try {
      const handle = await pickerWindow.showSaveFilePicker({
        suggestedName: fileName,
        types: [{ description: 'PDF 文档', accept: { 'application/pdf': ['.pdf'] } }],
      });
      const writable = await handle.createWritable();
      try {
        await writable.write(blob);
        await writable.close();
      } catch (error) {
        await writable.abort?.().catch(() => undefined);
        throw error;
      }
      return { status: 'saved', message: `PDF 已保存：${fileName}` };
    } catch (error) {
      if (isAbortError(error)) return { status: 'cancelled', message: '已取消保存，PDF 仍可重新保存。' };
      // 微信等内置浏览器可能暴露接口却拒绝调用，继续使用真实下载链接。
    }
  }

  if (method === 'share') {
    try {
      await navigator.share({ files: [file], title: sanitizePdfDocumentName(title) });
      return { status: 'shared', message: 'PDF 已交给系统，可选择“存储到文件”或其他位置。' };
    } catch (error) {
      if (isAbortError(error)) return { status: 'cancelled', message: '已取消保存，PDF 仍可重新保存。' };
      // 分享不可用时继续触发直接下载。
    }
  }

  let temporaryUrl = '';
  const downloadUrl = blobUrl || (temporaryUrl = URL.createObjectURL(blob));
  triggerPdfDownload(downloadUrl, fileName);
  if (temporaryUrl) window.setTimeout(() => URL.revokeObjectURL(temporaryUrl), 60_000);
  return { status: 'downloaded', message: 'PDF 已提交下载；若微信没有响应，请点下方“直接下载 PDF”。' };
}
