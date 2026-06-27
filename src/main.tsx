import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

// 注册 Service Worker（仅 Web 生产环境）。Capacitor 安卓包资源已整包内置、本就离线，
// 无需 SW，跳过以免 webview 缓存冲突。('Capacitor' in window 由原生桥注入)
if ('serviceWorker' in navigator && import.meta.env.PROD && !('Capacitor' in window)) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
