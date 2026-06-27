import type { CapacitorConfig } from '@capacitor/cli';

/* Capacitor 配置：把 Vite 产物(dist/，含网页+词库+真人发音)整包打进安卓 APK，装上即完全离线。
   webDir 必须是 vite build 的输出目录；appId 为安卓包名。 */
const config: CapacitorConfig = {
  appId: 'com.wordquest.kaoyan',
  appName: '考研词关',
  webDir: 'dist',
};

export default config;
