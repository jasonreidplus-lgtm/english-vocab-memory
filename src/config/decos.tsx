/* ============================================================
   画风背景装饰组件 —— 每个都是自包含的(自带样式)，
   通过 theme.Deco 通用渲染。新增画风时这里加一个可选组件即可，
   全局 CSS 与游戏逻辑都不用动。
   渲染在 .vg 容器内、内容层(z-index:2)之下。
   ============================================================ */
import React from 'react';

const fill: React.CSSProperties = { position: 'absolute', inset: 0, pointerEvents: 'none' };

// 水墨：宣纸渍 + 右侧断笔圆环(枯山水「圆相」)
export function InkDeco(): React.JSX.Element {
  return (
    <div style={fill} aria-hidden>
      <div
        style={{
          ...fill,
          opacity: 0.5,
          background:
            'radial-gradient(circle at 18% 12%, rgba(120,90,50,.07), transparent 40%),' +
            'radial-gradient(circle at 82% 78%, rgba(120,90,50,.06), transparent 42%)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: '-46px',
          top: '128px',
          width: '230px',
          height: '230px',
          border: '14px solid rgba(178,58,46,.10)',
          borderRadius: '50%',
          borderRightColor: 'transparent',
          transform: 'rotate(28deg)',
        }}
      />
    </div>
  );
}

// 像素：CRT 扫描线
export function PixelDeco(): React.JSX.Element {
  return (
    <div
      style={{
        ...fill,
        opacity: 0.2,
        background:
          'repeating-linear-gradient(0deg, transparent 0 3px, rgba(0,0,0,.5) 3px 4px)',
      }}
      aria-hidden
    />
  );
}

// 羊皮纸RPG：陈年纸渍 + 暗角 + 一枚朱红火漆印
export function ParchmentDeco(): React.JSX.Element {
  return (
    <div style={fill} aria-hidden>
      <div
        style={{
          ...fill,
          opacity: 0.8,
          background:
            'radial-gradient(circle at 18% 16%, rgba(120,72,20,.12), transparent 38%),' +
            'radial-gradient(circle at 86% 84%, rgba(120,72,20,.13), transparent 40%),' +
            'radial-gradient(circle at 62% 48%, rgba(150,100,40,.06), transparent 60%)',
        }}
      />
      <div style={{ ...fill, boxShadow: 'inset 0 0 90px rgba(80,50,15,.30)' }} />
      <div
        style={{
          position: 'absolute',
          right: '18px',
          bottom: '22px',
          width: '74px',
          height: '74px',
          borderRadius: '50%',
          background: 'radial-gradient(circle at 38% 34%, rgba(156,59,27,.34), rgba(120,40,18,.22))',
          border: '2px solid rgba(120,40,18,.30)',
          boxShadow: 'inset 0 0 14px rgba(80,20,10,.35)',
        }}
      />
    </div>
  );
}

// 霓虹：赛博网格 + 顶部光晕
export function NeonDeco(): React.JSX.Element {
  return (
    <div
      style={{
        ...fill,
        opacity: 0.5,
        background:
          'linear-gradient(rgba(34,211,238,.05) 1px, transparent 1px) 0 0/100% 34px,' +
          'linear-gradient(90deg, rgba(34,211,238,.05) 1px, transparent 1px) 0 0/34px 100%,' +
          'radial-gradient(circle at 50% 0%, rgba(34,211,238,.12), transparent 55%)',
      }}
      aria-hidden
    />
  );
}
