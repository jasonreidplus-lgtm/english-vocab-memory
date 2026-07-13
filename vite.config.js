import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// base: './' 让构建产物用相对路径引用资源，
// 这样无论部署到 GitHub Pages 子路径、还是手机本地直接打开 index.html 都能正常加载。
export default defineConfig({
  plugins: [react()],
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    // Service Worker 读取该清单，精确预缓存带哈希的 PDF 动态分包。
    manifest: 'asset-manifest.json',
  },
});
