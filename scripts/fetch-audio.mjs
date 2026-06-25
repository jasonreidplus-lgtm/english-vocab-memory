/* 批量下载核心词库(5500)真人发音 mp3，存到 public/audio/{us,uk}/{word}.mp3，随 app 发布、离线可用。
   有道 dictvoice：type=2 美音 / type=1 英音(Node 端无 CORS 限制)。有道对部分词返回 WAV(~120KB)、
   部分返回 mp3(~10KB)；WAV 用 ffmpeg 转成小 mp3 再存(保持精简)。
   可断点续跑(已存在且合法的文件跳过)、并发、失败重试；失败清单写 _audio_fails.txt。
   用法: node scripts/fetch-audio.mjs [us|uk] */
import { readFileSync, writeFileSync, mkdirSync, existsSync, statSync, unlinkSync } from 'node:fs';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const exec = promisify(execFile);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const only = process.argv[2];
const ACCENTS = [{ dir: 'us', type: 2 }, { dir: 'uk', type: 1 }].filter((a) => !only || a.dir === only);

const vocab = JSON.parse(readFileSync(path.join(ROOT, 'public', 'data', 'vocab.json'), 'utf8'));
const words = [...new Set(vocab.map((w) => String(w.word || '').trim().toLowerCase()).filter(Boolean))];

const OUT = path.join(ROOT, 'public', 'audio');
const CONC = 8;
const MIN_BYTES = 800;

const isMp3 = (b) => b.length >= 3 && ((b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0));
const isWav = (b) => b.length >= 4 && b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46; // RIFF

async function wavToMp3(buf, outFile) {
  const tmp = path.join(tmpdir(), `yd_${process.pid}_${Date.now()}_${Math.floor(Math.random() * 1e9)}.wav`);
  writeFileSync(tmp, buf);
  try {
    await exec('ffmpeg', ['-loglevel', 'error', '-y', '-i', tmp, '-ac', '1', '-b:a', '48k', outFile]);
  } finally {
    try { unlinkSync(tmp); } catch { /* noop */ }
  }
}

async function fetchOne(word, acc) {
  const file = path.join(OUT, acc.dir, `${word}.mp3`);
  if (existsSync(file) && statSync(file).size >= MIN_BYTES) return 'skip';
  const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${acc.type}`;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < MIN_BYTES) throw new Error('too small ' + buf.length);
      if (isMp3(buf)) {
        writeFileSync(file, buf);
        return 'ok';
      }
      if (isWav(buf)) {
        await wavToMp3(buf, file); // 转码为小 mp3
        if (existsSync(file) && statSync(file).size >= MIN_BYTES) return 'ok';
        throw new Error('transcode empty');
      }
      throw new Error('not audio ' + buf.length);
    } catch (e) {
      if (attempt === 3) return 'fail:' + e.message;
      await new Promise((res) => setTimeout(res, 400 * attempt));
    }
  }
}

async function run() {
  if (typeof fetch !== 'function') {
    console.error('当前 Node 没有全局 fetch，请用 Node 18+');
    process.exit(1);
  }
  for (const acc of ACCENTS) mkdirSync(path.join(OUT, acc.dir), { recursive: true });
  const tasks = [];
  for (const acc of ACCENTS) for (const w of words) tasks.push([w, acc]);
  console.log(`待处理 ${tasks.length} 个(${words.length} 词 × ${ACCENTS.length} 口音)，并发 ${CONC}`);

  let i = 0, ok = 0, skip = 0, fail = 0;
  const fails = [];
  async function worker() {
    while (i < tasks.length) {
      const [w, acc] = tasks[i++];
      const r = await fetchOne(w, acc);
      if (r === 'ok') ok++;
      else if (r === 'skip') skip++;
      else { fail++; fails.push(`${acc.dir}/${w} ${r}`); }
      const done = ok + skip + fail;
      if (done % 500 === 0 || done === tasks.length) console.log(`${done}/${tasks.length}  ok=${ok} skip=${skip} fail=${fail}`);
    }
  }
  await Promise.all(Array.from({ length: CONC }, () => worker()));
  console.log(`DONE total=${tasks.length} ok=${ok} skip=${skip} fail=${fail}`);
  if (fails.length) {
    writeFileSync(path.join(ROOT, '_audio_fails.txt'), fails.join('\n'));
    console.log(`失败 ${fails.length} 条已写入 _audio_fails.txt(可重跑续传)`);
  } else {
    try { unlinkSync(path.join(ROOT, '_audio_fails.txt')); } catch { /* noop */ }
  }
}
run();
