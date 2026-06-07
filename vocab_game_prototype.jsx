import React, { useState, useMemo } from 'react';
import { RotateCw, Check, X, Star, Zap, Trophy, ArrowRight, ArrowLeft } from 'lucide-react';

// —— 示例数据(真实考研高频词)。正式项目里这部分来自 vocab.json ——
const WORDS = [
  { w: 'abandon',     ph: '/əˈbændən/',     pos: 'v.',   cn: '放弃，抛弃',     root: 'a-(朝向) + band(控制) → 不再控制 → 放弃' },
  { w: 'abstract',    ph: '/ˈæbstrækt/',    pos: 'adj.', cn: '抽象的',         root: 'abs-(离开) + tract(拉) → 抽离出来 → 抽象' },
  { w: 'abundant',    ph: '/əˈbʌndənt/',    pos: 'adj.', cn: '丰富的，大量的', root: 'ab-(强调) + und(波浪涌) → 如浪涌来 → 丰富' },
  { w: 'accelerate',  ph: '/əkˈseləreɪt/',  pos: 'v.',   cn: '加速',           root: 'ac- + celer(快速) → 使变快 → 加速' },
  { w: 'accommodate', ph: '/əˈkɒmədeɪt/',   pos: 'v.',   cn: '容纳，适应',     root: 'ac- + com(共同) + mod(尺寸) → 使合适 → 容纳' },
  { w: 'accumulate',  ph: '/əˈkjuːmjəleɪt/', pos: 'v.',  cn: '积累',           root: 'ac- + cumul(堆) → 堆起来 → 积累' },
  { w: 'acquire',     ph: '/əˈkwaɪə/',      pos: 'v.',   cn: '获得，取得',     root: 'ac- + quir(寻求) → 求而得之 → 获得' },
  { w: 'adequate',    ph: '/ˈædɪkwət/',     pos: 'adj.', cn: '足够的，适当的', root: 'ad-(朝) + equ(相等) → 相称 → 足够' },
];

// —— 画风主题:每种画风只是一组变量 + 字体 + 背景纹理。游戏逻辑共用一套 ——
const THEMES = {
  ink: {
    label: '水墨', deco: 'ink',
    vars: {
      '--bg1': '#efe7d6', '--bg2': '#e4d8bf',
      '--surface': '#faf6ec', '--surface2': '#f2 ebda',
      '--ink': '#241f1a', '--muted': '#867a68',
      '--accent': '#b23a2e', '--accent-soft': 'rgba(178,58,46,0.12)',
      '--good': '#5a7150', '--good-soft': 'rgba(90,113,80,0.14)',
      '--bad': '#b23a2e', '--bad-soft': 'rgba(178,58,46,0.12)',
      '--radius': '16px', '--btn-radius': '12px',
      '--display': "'Noto Serif SC', serif", '--body': "'Noto Serif SC', serif",
      '--shadow': '0 12px 34px rgba(70,46,22,0.13)',
      '--line': '1px solid rgba(70,46,22,0.14)', '--line-strong': '1.5px solid rgba(70,46,22,0.22)',
    },
  },
  pixel: {
    label: '像素', deco: 'pixel',
    vars: {
      '--bg1': '#16161f', '--bg2': '#0e0e16',
      '--surface': '#2a2a42', '--surface2': '#34345a',
      '--ink': '#f4f3e6', '--muted': '#9a9ac2',
      '--accent': '#ffcd75', '--accent-soft': 'rgba(255,205,117,0.16)',
      '--good': '#a7f070', '--good-soft': 'rgba(167,240,112,0.16)',
      '--bad': '#ef7d57', '--bad-soft': 'rgba(239,125,87,0.16)',
      '--radius': '0px', '--btn-radius': '0px',
      '--display': "'VT323', monospace", '--body': "'Noto Sans SC', sans-serif",
      '--shadow': '5px 5px 0 #000',
      '--line': '3px solid #000', '--line-strong': '3px solid #000',
    },
  },
  neon: {
    label: '霓虹', deco: 'neon',
    vars: {
      '--bg1': '#0a0a14', '--bg2': '#06060d',
      '--surface': 'rgba(18,20,40,0.66)', '--surface2': 'rgba(28,30,58,0.7)',
      '--ink': '#e7f7ff', '--muted': '#6f80a6',
      '--accent': '#22d3ee', '--accent-soft': 'rgba(34,211,238,0.14)',
      '--good': '#3dffa3', '--good-soft': 'rgba(61,255,163,0.14)',
      '--bad': '#ff3d6e', '--bad-soft': 'rgba(255,61,110,0.14)',
      '--radius': '6px', '--btn-radius': '6px',
      '--display': "'Orbitron', sans-serif", '--body': "'Rajdhani', 'Noto Sans SC', sans-serif",
      '--shadow': '0 0 24px rgba(34,211,238,0.28)',
      '--line': '1px solid rgba(34,211,238,0.45)', '--line-strong': '1.5px solid rgba(34,211,238,0.65)',
    },
  },
};

function pickOptions(idx) {
  const correct = WORDS[idx].cn;
  const pool = WORDS.filter((_, i) => i !== idx).map((x) => x.cn);
  // stable pseudo-shuffle based on idx
  const seeded = [...pool].sort((a, b) => ((a.length * 7 + idx) % 5) - ((b.length * 7 + idx) % 5));
  const distract = seeded.slice(0, 3);
  const opts = [correct, ...distract].sort((a, b) => ((a.charCodeAt(0) + idx) % 4) - ((b.charCodeAt(0) + idx) % 4));
  return opts;
}

export default function VocabGame() {
  const [themeKey, setThemeKey] = useState('ink');
  const [phase, setPhase] = useState('learn'); // learn | quiz | result
  const [li, setLi] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [qi, setQi] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState(null);

  const theme = THEMES[themeKey];
  const total = WORDS.length;
  const opts = useMemo(() => pickOptions(qi), [qi]);

  const progress =
    phase === 'learn' ? (li + 1) / total : phase === 'quiz' ? (qi) / total : 1;

  const reset = (keepTheme = true) => {
    setPhase('learn'); setLi(0); setFlipped(false); setQi(0); setScore(0); setPicked(null);
  };
  const goLearn = (dir) => {
    setFlipped(false);
    setLi((v) => Math.min(total - 1, Math.max(0, v + dir)));
  };
  const answer = (opt) => {
    if (picked) return;
    setPicked(opt);
    if (opt === WORDS[qi].cn) setScore((s) => s + 1);
  };
  const nextQ = () => {
    if (qi + 1 >= total) setPhase('result');
    else { setQi((q) => q + 1); setPicked(null); }
  };
  const stars = score >= 8 ? 3 : score >= 6 ? 2 : score >= 4 ? 1 : 0;

  const word = WORDS[li];

  return (
    <div className={`vg vg-${theme.deco}`} style={theme.vars}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Noto+Serif+SC:wght@400;600;700&family=Noto+Sans+SC:wght@400;500;700&family=VT323&family=Orbitron:wght@500;700;900&family=Rajdhani:wght@500;600;700&display=swap');

        .vg { box-sizing: border-box; max-width: 430px; margin: 0 auto; min-height: 560px;
          border-radius: 22px; padding: 18px 16px 20px; position: relative; overflow: hidden;
          font-family: var(--body); color: var(--ink);
          background: linear-gradient(160deg, var(--bg1), var(--bg2));
          transition: background .5s ease, color .4s ease; }
        .vg * { box-sizing: border-box; }

        /* —— 画风专属背景纹理 —— */
        .vg-ink::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.5;
          background: radial-gradient(circle at 18% 12%, rgba(120,90,50,.07), transparent 40%),
                      radial-gradient(circle at 82% 78%, rgba(120,90,50,.06), transparent 42%); }
        .vg-ink .enso { position:absolute; right:-46px; top:120px; width:230px; height:230px;
          border:14px solid rgba(178,58,46,.10); border-radius:50%;
          border-right-color: transparent; transform: rotate(28deg); pointer-events:none; }

        .vg-pixel::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.20;
          background: repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.5) 3px 4px); }
        .vg-pixel .blink { animation: vgblink 1s steps(2) infinite; }
        @keyframes vgblink { 50% { opacity: 0 } }

        .vg-neon::before { content:''; position:absolute; inset:0; pointer-events:none; opacity:.5;
          background: linear-gradient(rgba(34,211,238,.05) 1px, transparent 1px) 0 0/100% 34px,
                      linear-gradient(90deg, rgba(34,211,238,.05) 1px, transparent 1px) 0 0/34px 100%,
                      radial-gradient(circle at 50% 0%, rgba(34,211,238,.12), transparent 55%); }
        .vg-neon .neon-title { text-shadow: 0 0 10px var(--accent); letter-spacing: .12em; }
        .vg-neon .glow { box-shadow: 0 0 14px var(--accent-soft), inset 0 0 12px rgba(34,211,238,.06); }
        .vg-neon .flick { animation: vgflick 4s infinite; }
        @keyframes vgflick { 0%,96%,100%{opacity:1} 97%{opacity:.6} 98%{opacity:1} 99%{opacity:.7} }

        .row { display:flex; align-items:center; }
        .pill { cursor:pointer; border:none; font-family:var(--display); font-size:13px;
          padding:6px 12px; border-radius:999px; background:transparent; color:var(--muted);
          transition:.2s; letter-spacing:.04em; }
        .vg-pixel .pill { border-radius:0; font-size:17px; }
        .pill.on { background:var(--accent); color:var(--bg2); box-shadow:var(--shadow); }
        .vg-pixel .pill.on { color:#16161f; }

        .bar { height:7px; border-radius:999px; background:var(--accent-soft); overflow:hidden; }
        .vg-pixel .bar { border-radius:0; border:2px solid #000; height:12px; }
        .bar > i { display:block; height:100%; background:var(--accent); border-radius:999px;
          transition:width .4s cubic-bezier(.4,1.4,.5,1); }
        .vg-pixel .bar > i { border-radius:0; }
        .vg-neon .bar > i { box-shadow:0 0 10px var(--accent); }

        .badge { font-family:var(--display); font-size:14px; padding:4px 11px; border-radius:999px;
          background:var(--surface); border:var(--line); display:flex; align-items:center; gap:5px; }
        .vg-pixel .badge { border-radius:0; font-size:18px; box-shadow:var(--shadow); }

        /* 卡片翻转 */
        .stage { perspective:1400px; margin:18px 0 16px; }
        .card3d { position:relative; height:268px; transform-style:preserve-3d;
          transition:transform .6s cubic-bezier(.4,.8,.3,1.1); cursor:pointer; }
        .card3d.flip { transform:rotateY(180deg); }
        .face { position:absolute; inset:0; backface-visibility:hidden; -webkit-backface-visibility:hidden;
          border-radius:var(--radius); background:var(--surface); border:var(--line-strong);
          box-shadow:var(--shadow); padding:26px 22px; display:flex; flex-direction:column;
          justify-content:center; align-items:center; text-align:center; }
        .back { transform:rotateY(180deg); }

        .word { font-family:var(--display); font-weight:700; line-height:1; }
        .vg-ink .word { font-size:46px; } .vg-pixel .word { font-size:58px; }
        .vg-neon .word { font-size:42px; }
        .ph { font-family:var(--display); color:var(--muted); margin-top:14px; font-size:18px; }
        .pos { margin-top:16px; font-size:13px; color:var(--accent); border:var(--line);
          padding:3px 12px; border-radius:999px; font-family:var(--display); }
        .vg-pixel .pos { border-radius:0; font-size:16px; }
        .hint { position:absolute; bottom:14px; font-size:12px; color:var(--muted); display:flex;
          gap:5px; align-items:center; font-family:var(--body); }

        .cn { font-family:var(--display); font-size:30px; font-weight:600; }
        .vg-pixel .cn, .vg-neon .cn { font-family:var(--body); font-weight:700; }
        .rootbox { margin-top:18px; font-size:14px; line-height:1.7; color:var(--muted);
          background:var(--accent-soft); border-radius:12px; padding:12px 14px; }
        .vg-pixel .rootbox { border-radius:0; border:2px solid var(--accent); }

        .btn { cursor:pointer; font-family:var(--display); border:var(--line-strong);
          background:var(--surface); color:var(--ink); padding:13px 16px; border-radius:var(--btn-radius);
          font-size:16px; transition:transform .12s, background .2s, box-shadow .2s; box-shadow:var(--shadow);
          display:flex; align-items:center; justify-content:center; gap:7px; }
        .vg-pixel .btn { font-size:19px; }
        .btn:active { transform:translate(2px,2px); }
        .vg-pixel .btn:active { box-shadow:1px 1px 0 #000; }
        .btn.primary { background:var(--accent); color:var(--bg2); }
        .vg-pixel .btn.primary { color:#16161f; }
        .btn.ghost { background:transparent; box-shadow:none; }

        .opt { width:100%; text-align:left; cursor:pointer; font-family:var(--body); font-weight:600;
          font-size:17px; padding:15px 16px; margin-bottom:11px; border-radius:var(--btn-radius);
          background:var(--surface); border:var(--line-strong); color:var(--ink);
          transition:.18s; box-shadow:var(--shadow); display:flex; justify-content:space-between; align-items:center; }
        .opt:active { transform:translateY(1px); }
        .opt.correct { background:var(--good-soft); border-color:var(--good); color:var(--good); }
        .opt.wrong   { background:var(--bad-soft);  border-color:var(--bad);  color:var(--bad); }
        .opt.dim { opacity:.45; }

        .fade { animation:vgfade .45s ease both; }
        @keyframes vgfade { from{opacity:0; transform:translateY(10px)} to{opacity:1; transform:none} }
        .pop { animation:vgpop .5s cubic-bezier(.3,1.6,.5,1) both; }
        @keyframes vgpop { from{transform:scale(0); opacity:0} to{transform:scale(1); opacity:1} }
      `}</style>

      {theme.deco === 'ink' && <div className="enso" />}

      {/* 顶部:标题 + 画风切换 */}
      <div className="row" style={{ justifyContent: 'space-between', position: 'relative', zIndex: 2 }}>
        <div className={theme.deco === 'neon' ? 'neon-title' : ''}
          style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 19, letterSpacing: '.02em' }}>
          考研词关 <span style={{ color: 'var(--accent)' }}>·</span> WordQuest
        </div>
        <div className="row" style={{ gap: 4, background: 'var(--surface)', padding: 4, borderRadius: 999, border: 'var(--line)' }}>
          {Object.entries(THEMES).map(([k, t]) => (
            <button key={k} className={`pill ${k === themeKey ? 'on' : ''}`} onClick={() => setThemeKey(k)}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 关卡进度 */}
      <div className="row" style={{ gap: 12, marginTop: 16, position: 'relative', zIndex: 2 }}>
        <div style={{ fontFamily: 'var(--display)', fontSize: 14, color: 'var(--muted)', whiteSpace: 'nowrap' }}>
          第 1 关 / 550
        </div>
        <div className="bar" style={{ flex: 1 }}><i style={{ width: `${progress * 100}%` }} /></div>
        <div className="badge"><Zap size={15} color="var(--accent)" /> {score * 10}</div>
      </div>

      {/* —— 学习阶段 —— */}
      {phase === 'learn' && (
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 13, color: 'var(--muted)', marginTop: 16, marginBottom: 2 }}>
            学习 · {li + 1} / {total}
          </div>
          <div className="stage">
            <div className={`card3d ${flipped ? 'flip' : ''}`} onClick={() => setFlipped((f) => !f)}>
              <div className="face">
                <div className="word">{word.w}</div>
                <div className="ph">{word.ph}</div>
                <div className="pos">{word.pos}</div>
                <div className="hint"><RotateCw size={13} /> 点击翻面看释义</div>
              </div>
              <div className="face back">
                <div className="cn">{word.cn}</div>
                <div className="rootbox">🔧 {word.root}</div>
                <div className="hint"><RotateCw size={13} /> 再次点击翻回</div>
              </div>
            </div>
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => goLearn(-1)} disabled={li === 0}>
              <ArrowLeft size={17} /> 上一个
            </button>
            {li < total - 1 ? (
              <button className="btn" style={{ flex: 1 }} onClick={() => goLearn(1)}>
                下一个 <ArrowRight size={17} />
              </button>
            ) : (
              <button className="btn primary" style={{ flex: 1.4 }} onClick={() => { setPhase('quiz'); setQi(0); setScore(0); setPicked(null); }}>
                开始闯关 <Zap size={17} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* —— 闯关阶段 —— */}
      {phase === 'quiz' && (
        <div className="fade" key={qi} style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ fontFamily: 'var(--display)', fontSize: 13, color: 'var(--muted)', marginTop: 16, marginBottom: 10 }}>
            闯关 · 选出正确释义 · {qi + 1} / {total}
          </div>
          <div className="face glow" style={{ position: 'relative', height: 'auto', padding: '26px 20px', marginBottom: 18, display: 'block', textAlign: 'center' }}>
            <div className="word" style={{ fontSize: 36 }}>{WORDS[qi].w}</div>
            <div className="ph" style={{ marginTop: 10, fontSize: 16 }}>{WORDS[qi].ph}</div>
          </div>
          {opts.map((o) => {
            let cls = 'opt';
            if (picked) {
              if (o === WORDS[qi].cn) cls += ' correct';
              else if (o === picked) cls += ' wrong';
              else cls += ' dim';
            }
            return (
              <button key={o} className={cls} onClick={() => answer(o)}>
                {o}
                {picked && o === WORDS[qi].cn && <Check size={19} />}
                {picked && o === picked && o !== WORDS[qi].cn && <X size={19} />}
              </button>
            );
          })}
          {picked && (
            <button className="btn primary fade" style={{ width: '100%', marginTop: 6 }} onClick={nextQ}>
              {qi + 1 >= total ? '查看成绩' : '下一题'} <ArrowRight size={17} />
            </button>
          )}
        </div>
      )}

      {/* —— 通关结算 —— */}
      {phase === 'result' && (
        <div className="fade" style={{ position: 'relative', zIndex: 2, textAlign: 'center', paddingTop: 24 }}>
          <Trophy size={56} color="var(--accent)" className={theme.deco === 'neon' ? 'flick' : ''} style={{ marginBottom: 8 }} />
          <div style={{ fontFamily: 'var(--display)', fontSize: 26, fontWeight: 700, marginBottom: 6 }}>本关完成！</div>
          <div className="row" style={{ justifyContent: 'center', gap: 8, margin: '14px 0' }}>
            {[0, 1, 2].map((i) => (
              <Star key={i} size={42} className="pop" style={{ animationDelay: `${i * 0.12}s` }}
                fill={i < stars ? 'var(--accent)' : 'transparent'} color="var(--accent)" />
            ))}
          </div>
          <div style={{ fontFamily: 'var(--display)', fontSize: 17, color: 'var(--muted)', marginBottom: 4 }}>
            正确 {score} / {total} · 获得 {score * 10} XP
          </div>
          <div style={{ fontSize: 13, color: 'var(--muted)', marginBottom: 22 }}>
            👆 试试切换上方画风，重新体验同一关
          </div>
          <div className="row" style={{ gap: 10 }}>
            <button className="btn ghost" style={{ flex: 1 }} onClick={() => reset()}>
              <RotateCw size={16} /> 再来一次
            </button>
            <button className="btn primary" style={{ flex: 1.3 }} onClick={() => reset()}>
              下一关 <ArrowRight size={17} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
