/* ============================================================
   画风主题配置 —— 这是整个 app 唯一的“视觉差异来源”。
   架构铁律 1：新增一种画风 = 在下面的数组里加一个对象
   (vars 覆盖 + 可选 Deco 背景装饰 + 可选 fontHref)，
   其它任何代码都不用改。游戏逻辑里严禁出现 theme === 'xxx' 的分支。

   一个 theme 对象：
   {
     key:   唯一标识(也用于持久化记住用户选择)
     label: 切换器上显示的名字
     vars:  一组 CSS 变量，覆盖 index.css 里 .vg{} 的默认值
     Deco?: 可选的背景装饰组件(自包含样式)
     fontHref?: 可选，该画风需要的额外 Google Fonts 链接(动态注入)
   }
   ============================================================ */
import { InkDeco, PixelDeco, NeonDeco, ParchmentDeco } from './decos.jsx';

export const THEMES = [
  {
    key: 'ink',
    label: '水墨',
    Deco: InkDeco,
    vars: {
      '--bg1': '#efe7d6', '--bg2': '#e4d8bf',
      '--surface': '#faf6ec', '--surface2': '#f2ebda',
      '--ink': '#241f1a', '--muted': '#867a68',
      '--accent': '#b23a2e', '--accent-soft': 'rgba(178,58,46,0.12)',
      '--good': '#5a7150', '--good-soft': 'rgba(90,113,80,0.14)',
      '--bad': '#b23a2e', '--bad-soft': 'rgba(178,58,46,0.12)',
      '--radius': '16px', '--btn-radius': '12px',
      '--display': "'Noto Serif SC', serif", '--body': "'Noto Serif SC', serif",
      '--shadow': '0 12px 34px rgba(70,46,22,0.13)',
      '--line': '1px solid rgba(70,46,22,0.14)',
      '--line-strong': '1.5px solid rgba(70,46,22,0.22)',
      '--word-size': '46px',
    },
  },
  {
    key: 'pixel',
    label: '像素',
    Deco: PixelDeco,
    vars: {
      '--bg1': '#16161f', '--bg2': '#0e0e16',
      '--surface': '#2a2a42', '--surface2': '#34345a',
      '--ink': '#f4f3e6', '--muted': '#9a9ac2',
      '--accent': '#ffcd75', '--accent-soft': 'rgba(255,205,117,0.16)',
      '--good': '#a7f070', '--good-soft': 'rgba(167,240,112,0.16)',
      '--bad': '#ef7d57', '--bad-soft': 'rgba(239,125,87,0.16)',
      '--radius': '0px', '--btn-radius': '0px',
      '--pill-radius': '0px', '--badge-radius': '0px',
      '--display': "'VT323', monospace", '--body': "'Noto Sans SC', sans-serif",
      '--shadow': '5px 5px 0 #000', '--shadow-active': '2px 2px 0 #000',
      '--line': '3px solid #000', '--line-strong': '3px solid #000',
      '--word-size': '58px',
      '--cn-font': "'Noto Sans SC', sans-serif",
      '--bar-height': '12px', '--bar-radius': '0px', '--bar-border': '2px solid #000',
    },
  },
  {
    key: 'neon',
    label: '霓虹',
    Deco: NeonDeco,
    vars: {
      '--bg1': '#0a0a14', '--bg2': '#06060d',
      '--surface': 'rgba(18,20,40,0.66)', '--surface2': 'rgba(28,30,58,0.7)',
      '--ink': '#e7f7ff', '--muted': '#6f80a6',
      '--accent': '#22d3ee', '--accent-soft': 'rgba(34,211,238,0.14)',
      '--good': '#3dffa3', '--good-soft': 'rgba(61,255,163,0.14)',
      '--bad': '#ff3d6e', '--bad-soft': 'rgba(255,61,110,0.14)',
      '--radius': '6px', '--btn-radius': '6px',
      '--display': "'Orbitron', sans-serif",
      '--body': "'Rajdhani', 'Noto Sans SC', sans-serif",
      '--shadow': '0 0 24px rgba(34,211,238,0.28)',
      '--line': '1px solid rgba(34,211,238,0.45)',
      '--line-strong': '1.5px solid rgba(34,211,238,0.65)',
      '--word-size': '42px',
      '--cn-font': "'Rajdhani', 'Noto Sans SC', sans-serif",
      '--title-shadow': '0 0 10px var(--accent)',
      '--card-glow': '0 0 14px var(--accent)',
    },
  },

  // —— P2 新增画风：只在此处加对象(+可选 Deco / fontHref)，别处一行不改 ——
  {
    key: 'parchment',
    label: '羊皮',
    Deco: ParchmentDeco,
    fontHref: 'https://fonts.googleapis.com/css2?family=Cinzel:wght@600;700&display=swap',
    vars: {
      '--bg1': '#efe2c4', '--bg2': '#e3d2a8',
      '--surface': '#f7eed4', '--surface2': '#efe3c2',
      '--ink': '#3a2c14', '--muted': '#8a7448',
      '--accent': '#9c3b1b', '--accent-soft': 'rgba(156,59,27,0.14)',
      '--good': '#5b6e2f', '--good-soft': 'rgba(91,110,47,0.16)',
      '--bad': '#9c3b1b', '--bad-soft': 'rgba(156,59,27,0.14)',
      '--radius': '10px', '--btn-radius': '8px',
      '--display': "'Cinzel', 'Noto Serif SC', serif", '--body': "'Noto Serif SC', serif",
      '--shadow': '0 10px 26px rgba(80,50,15,0.22)',
      '--line': '1px solid rgba(80,50,15,0.22)',
      '--line-strong': '1.5px solid rgba(80,50,15,0.34)',
      '--word-size': '44px',
      '--title-shadow': '0 1px 0 rgba(255,255,255,0.45)',
    },
  },
  {
    key: 'inkwhite',
    label: '墨白',
    // 极简墨白：无背景装饰(Deco 可选)，靠留白与细线
    vars: {
      '--bg1': '#fbfbf9', '--bg2': '#f1f1ee',
      '--surface': '#ffffff', '--surface2': '#f6f6f4',
      '--ink': '#16161a', '--muted': '#9b9b9b',
      '--accent': '#16161a', '--accent-soft': 'rgba(20,20,26,0.06)',
      '--good': '#2e7d57', '--good-soft': 'rgba(46,125,87,0.10)',
      '--bad': '#c0392b', '--bad-soft': 'rgba(192,57,43,0.09)',
      '--radius': '10px', '--btn-radius': '8px',
      '--display': "'Noto Sans SC', sans-serif", '--body': "'Noto Sans SC', sans-serif",
      '--shadow': '0 1px 2px rgba(0,0,0,0.05)',
      '--shadow-active': 'none',
      '--line': '1px solid rgba(0,0,0,0.10)',
      '--line-strong': '1px solid rgba(0,0,0,0.16)',
      '--word-size': '42px',
    },
  },
];

export const DEFAULT_THEME = THEMES[0].key;

export function getTheme(key) {
  return THEMES.find((t) => t.key === key) || THEMES[0];
}
