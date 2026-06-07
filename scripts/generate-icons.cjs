/* 从零生成应用图标 PNG（印章/朱印风，呼应水墨主题），无需任何图像库。
   运行：node scripts/generate-icons.cjs  → 写入 public/icon-*.png
   一个内置极简 PNG 编码器(RGBA + zlib + 手写 CRC32)。 */
const fs = require('fs');
const zlib = require('zlib');

const crcTable = (() => {
  const t = new Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();
function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = crcTable[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

const BG = [178, 58, 46]; // 朱红 accent
const BG2 = [138, 40, 32]; // 暗红(渐变底)
const CREAM = [250, 246, 236];
const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const cov = (d) => Math.max(0, Math.min(1, 0.5 - d)); // 1px 抗锯齿覆盖率(d=到边界的有符号距离, 内为负)

function makePNG(size) {
  const W = size,
    H = size;
  const raw = Buffer.alloc(H * (1 + W * 4));
  const cx = W / 2,
    cy = H / 2;
  const R = W * 0.3, // 朱印外圈(奶白)
    Rin = W * 0.218, // 内填(朱红)
    Rdot = W * 0.082; // 中心点(奶白)
  for (let y = 0; y < H; y++) {
    const rowStart = y * (1 + W * 4);
    raw[rowStart] = 0; // filter: none
    for (let x = 0; x < W; x++) {
      // 背景：轻微对角渐变
      const g = (x + y) / (W + H);
      let col = mix(BG, BG2, g * 0.55);
      const d = Math.hypot(x - cx, y - cy);
      col = mix(col, CREAM, cov(d - R));
      col = mix(col, mix(BG, BG2, 0.2), cov(d - Rin));
      col = mix(col, CREAM, cov(d - Rdot));
      const o = rowStart + 1 + x * 4;
      raw[o] = Math.round(col[0]);
      raw[o + 1] = Math.round(col[1]);
      raw[o + 2] = Math.round(col[2]);
      raw[o + 3] = 255;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(W, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // color type RGBA
  const idat = zlib.deflateSync(raw, { level: 9 });
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

for (const s of [512, 192, 180, 32]) {
  fs.writeFileSync(`public/icon-${s}.png`, makePNG(s));
}
console.log('icons written: 512/192/180/32');
