import { Capacitor, registerPlugin } from '@capacitor/core';

interface NativePrintOptions {
  documentName: string;
}

interface NativePrintPlugin {
  print(options: NativePrintOptions): Promise<void>;
}

const NativePrint = registerPlugin<NativePrintPlugin>('NativePrint');

export function isNativeAndroid(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function printDocument(documentName: string): Promise<void> {
  if (isNativeAndroid()) {
    await NativePrint.print({ documentName });
    return;
  }

  if (typeof window.print !== 'function') {
    throw new Error('当前环境不支持打印');
  }
  window.print();
}
