/* Service Worker —— 让 app 离线可用、二次打开秒开。
   策略：
   - 导航请求(打开页面)：network-first，断网回退缓存(再回退首页壳)。
   - 其余同源 GET(JS/CSS/词库/字体)：stale-while-revalidate(先给缓存，后台更新)。
   词库虽大，但首访后即入缓存，之后从磁盘读取，断网照背。 */
const CACHE = 'wordquest-v121'; // bump：直接生成/保存 PDF，不再经过打印服务
const PDF_STATIC_ASSETS = [
  './fonts/pdf/WordQuestSansSC-Regular.ttf',
  './fonts/pdf/WordQuestSans-Regular.ttf',
  './fonts/pdf/WordQuestSans-Bold.ttf',
];

function collectManifestFiles(manifest, key, files, visited) {
  if (!key || visited.has(key)) return;
  visited.add(key);
  const entry = manifest[key];
  if (!entry) return;
  if (entry.file) files.add(`./${entry.file}`);
  for (const dependency of [...(entry.imports || []), ...(entry.dynamicImports || [])]) {
    collectManifestFiles(manifest, dependency, files, visited);
  }
}

async function precachePdfExporter() {
  const manifestUrl = new URL('./asset-manifest.json', self.registration.scope);
  const response = await fetch(manifestUrl, { cache: 'no-cache' });
  if (!response.ok) throw new Error(`PDF asset manifest ${response.status}`);
  const manifest = await response.json();
  const entryKey = Object.keys(manifest).find((key) => key.endsWith('src/lib/pdfDocument.ts'));
  if (!entryKey) throw new Error('PDF exporter missing from asset manifest');

  const files = new Set(PDF_STATIC_ASSETS);
  collectManifestFiles(manifest, entryKey, files, new Set());
  const cache = await caches.open(CACHE);
  await cache.addAll([manifestUrl, ...[...files].map((path) => new URL(path, self.registration.scope))]);
}

self.addEventListener('install', (e) => {
  e.waitUntil(precachePdfExporter().then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  // 跨域单词发音(有道 dictvoice)不走 SW：opaque 响应会撑爆缓存配额，离线由 TTS 兜底
  if (req.url.indexOf('dict.youdao.com') !== -1) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      (async () => {
        try {
          const fresh = await fetch(req);
          // 不缓存被重定向的响应(如 Cloudflare Access 登录页)，避免污染离线壳
          if (fresh && fresh.ok && !fresh.redirected) {
            const cache = await caches.open(CACHE);
            cache.put(req, fresh.clone());
          }
          return fresh;
        } catch {
          return (await caches.match(req)) || (await caches.match('./')) || Response.error();
        }
      })()
    );
    return;
  }

  e.respondWith(
    (async () => {
      const cache = await caches.open(CACHE);
      const cached = await cache.match(req);
      const network = fetch(req)
        .then((res) => {
          if (res && (res.ok || res.type === 'opaque') && !res.redirected) cache.put(req, res.clone());
          return res;
        })
        .catch(() => cached);
      return cached || network;
    })()
  );
});
