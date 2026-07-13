import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativePrintOptions {
  documentName: string;
}

interface NativePrintPlugin {
  print(options: NativePrintOptions): Promise<void>;
}

const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint');

export type PdfSavePlatform = 'android-native' | 'ios-web' | 'mobile-web' | 'desktop-web';

/** 清理系统打印任务名；扩展名交给各平台的 PDF 保存目标处理，避免 .pdf.pdf。 */
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

export function pdfSaveInstructions(platform: PdfSavePlatform = getPdfSavePlatform()): string {
  switch (platform) {
    case 'android-native':
      return 'Android：在系统打印页把打印机设为“保存为 PDF”，点保存图标，再选择文件夹和文件名。';
    case 'ios-web':
      return 'iPhone / iPad：打开 PDF 打印预览后点“共享”→“存储到文件”，再选择 iCloud Drive 或本机位置。';
    case 'mobile-web':
      return '手机 / 平板浏览器：在系统打印页选择“保存为 PDF”，再通过系统文件或下载面板选择名称和位置。';
    default:
      return '电脑：在系统打印窗口选择“另存为 PDF / Save as PDF”或“Microsoft Print to PDF”，点保存后选择文件夹和文件名。';
  }
}

export async function printDocument(documentName: string): Promise<void> {
  const safeName = sanitizePdfDocumentName(documentName);
  if (isNativeAndroid()) {
    await NativePrint.print({ documentName: safeName });
    return;
  }

  if (typeof window.print !== 'function') {
    throw new Error('当前环境不支持打印');
  }
  // 桌面“另存为 PDF”通常使用 document.title 作为建议文件名。
  const previousTitle = document.title;
  document.title = safeName;
  try {
    window.print();
  } finally {
    document.title = previousTitle;
  }
}
