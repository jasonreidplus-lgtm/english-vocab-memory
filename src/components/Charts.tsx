/* 手绘 SVG 图表组件库：零第三方依赖、吃主题 CSS 变量、交互式(hover/tap tooltip)。
   全部用 viewBox + width:100% 自适应；触屏点击 = 桌面 hover。 */
import React, { useState } from 'react';

// —— 环形图(掌握分布)：点击分段可回调筛选 ——
export interface DonutSeg {
  key: string;
  label: string;
  value: number;
  color: string;
}
export function Donut({
  segments,
  centerNum,
  centerSub,
  onSelect,
  selectedKey,
  size = 168,
  thickness = 22,
}: {
  segments: DonutSeg[];
  centerNum: React.ReactNode;
  centerSub?: string;
  onSelect?: (key: string | null) => void;
  selectedKey?: string | null;
  size?: number;
  thickness?: number;
}) {
  const total = segments.reduce((a, s) => a + s.value, 0) || 1;
  const r = (size - thickness) / 2;
  const c = size / 2;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  return (
    <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} className="chart-donut">
      <circle cx={c} cy={c} r={r} fill="none" stroke="var(--line)" strokeWidth={thickness} opacity={0.25} />
      {segments.map((s) => {
        if (s.value <= 0) return null;
        const len = (s.value / total) * circ;
        const dash = -offset;
        offset += len;
        const dim = selectedKey != null && selectedKey !== s.key;
        return (
          <circle
            key={s.key}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${circ - len}`}
            strokeDashoffset={dash}
            transform={`rotate(-90 ${c} ${c})`}
            style={{ cursor: onSelect ? 'pointer' : 'default', opacity: dim ? 0.35 : 1, transition: 'opacity .2s' }}
            onClick={() => onSelect?.(selectedKey === s.key ? null : s.key)}
          />
        );
      })}
      <text x={c} y={c - 1} textAnchor="middle" className="donut-num">{centerNum}</text>
      {centerSub && <text x={c} y={c + 17} textAnchor="middle" className="donut-sub">{centerSub}</text>}
    </svg>
  );
}

// —— 燃尽 / 配速：需求线(虚) + 当前速率预测线(实，达标绿/落后红) + 今天点 + 考试竖线 ——
export function BurndownChart({
  learned,
  total,
  daysToExam,
  actualPerDay,
  onTrack,
  height = 180,
}: {
  learned: number;
  total: number;
  daysToExam: number;
  actualPerDay: number;
  onTrack: boolean;
  height?: number;
}) {
  const W = 320;
  const H = height;
  const padL = 10;
  const padR = 12;
  const padT = 16;
  const padB = 22;
  const span = Math.max(1, daysToExam);
  const x = (d: number) => padL + (d / span) * (W - padL - padR);
  const y = (v: number) => padT + (1 - (total ? v / total : 0)) * (H - padT - padB);
  const projEnd = Math.min(total, learned + actualPerDay * span);
  const projColor = onTrack ? 'var(--good)' : 'var(--bad)';
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" role="img" aria-label="燃尽图">
      <line x1={padL} y1={y(total)} x2={W - padR} y2={y(total)} stroke="var(--line)" strokeDasharray="3 3" />
      <text x={padL} y={y(total) - 4} className="chart-xlabel">目标 {total}</text>
      <line x1={x(0)} y1={y(learned)} x2={x(span)} y2={y(total)} stroke="var(--muted)" strokeDasharray="5 4" strokeWidth={2} />
      <line x1={x(0)} y1={y(learned)} x2={x(span)} y2={y(projEnd)} stroke={projColor} strokeWidth={2.5} />
      <line x1={x(span)} y1={padT} x2={x(span)} y2={H - padB} stroke="var(--line-strong)" />
      <circle cx={x(0)} cy={y(learned)} r={4} fill="var(--accent)" />
      <text x={x(0) + 3} y={H - 6} className="chart-xlabel">今天</text>
      <text x={x(span)} y={H - 6} textAnchor="end" className="chart-xlabel">考试</text>
    </svg>
  );
}

// —— 柱状图(未来到期 / stability 直方 / 活动)：hover/tap 显数值 ——
export interface Bar { label: string; value: number; }
export function BarChart({
  bars,
  color = 'var(--accent)',
  unit = '',
  height = 150,
  maxTicks = 6,
}: {
  bars: Bar[];
  color?: string;
  unit?: string;
  height?: number;
  maxTicks?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 320;
  const H = height;
  const padT = 18;
  const padB = 22;
  const n = Math.max(1, bars.length);
  const gap = n > 40 ? 1 : 2;
  const bw = (W - (n - 1) * gap) / n;
  const max = Math.max(1, ...bars.map((b) => b.value));
  const step = Math.ceil(n / maxTicks);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" onMouseLeave={() => setActive(null)} role="img" aria-label="柱状图">
      {bars.map((b, i) => {
        const h = (b.value / max) * (H - padT - padB);
        const xx = i * (bw + gap);
        const yy = H - padB - h;
        return (
          <g key={i} onClick={() => setActive(active === i ? null : i)} onMouseEnter={() => setActive(i)} style={{ cursor: 'pointer' }}>
            <rect x={xx} y={padT} width={bw} height={H - padT - padB} fill="transparent" />
            <rect x={xx} y={yy} width={bw} height={Math.max(0, h)} rx={1.5} fill={color} opacity={active === null || active === i ? 1 : 0.45} />
          </g>
        );
      })}
      {bars.map((b, i) =>
        i % step === 0 ? (
          <text key={`x${i}`} x={i * (bw + gap) + bw / 2} y={H - 6} textAnchor="middle" className="chart-xlabel">{b.label}</text>
        ) : null
      )}
      {active != null && bars[active] && (
        <text x={Math.min(W - 20, Math.max(20, active * (bw + gap) + bw / 2))} y={12} textAnchor="middle" className="chart-tip">
          {bars[active].label}: {bars[active].value}{unit}
        </text>
      )}
    </svg>
  );
}

// —— 趋势线(真实保持率/周)：目标线 + 数据点 tap 显详情 ——
export interface TrendDatum { label: string; value: number | null; extra?: string; }
export function TrendChart({
  points,
  target,
  height = 160,
  maxTicks = 5,
}: {
  points: TrendDatum[];
  target?: number;
  height?: number;
  maxTicks?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const W = 320;
  const H = height;
  const padL = 10;
  const padR = 12;
  const padT = 16;
  const padB = 20;
  const n = points.length;
  const x = (i: number) => padL + (n <= 1 ? 0.5 : i / (n - 1)) * (W - padL - padR);
  const y = (v: number) => padT + (1 - Math.max(0, Math.min(1, v))) * (H - padT - padB);
  const valid = points.map((p, i) => ({ i, v: p.value })).filter((o): o is { i: number; v: number } => o.v != null);
  const path = valid.map((o, k) => `${k === 0 ? 'M' : 'L'}${x(o.i)},${y(o.v)}`).join(' ');
  const step = Math.max(1, Math.ceil(n / maxTicks));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="chart" onMouseLeave={() => setActive(null)} role="img" aria-label="趋势线">
      {target != null && (
        <>
          <line x1={padL} y1={y(target)} x2={W - padR} y2={y(target)} stroke="var(--good)" strokeDasharray="3 3" opacity={0.6} />
          <text x={W - padR} y={y(target) - 3} textAnchor="end" className="chart-xlabel">目标 {Math.round(target * 100)}%</text>
        </>
      )}
      {path && <path d={path} fill="none" stroke="var(--accent)" strokeWidth={2.5} />}
      {valid.map((o) => (
        <circle
          key={o.i}
          cx={x(o.i)}
          cy={y(o.v)}
          r={active === o.i ? 5 : 3.5}
          fill="var(--accent)"
          stroke="var(--surface)"
          strokeWidth={1.5}
          style={{ cursor: 'pointer' }}
          onClick={() => setActive(active === o.i ? null : o.i)}
          onMouseEnter={() => setActive(o.i)}
        />
      ))}
      {active != null && points[active]?.value != null && (
        <text x={Math.min(W - 24, Math.max(24, x(active)))} y={y(points[active].value as number) - 9} textAnchor="middle" className="chart-tip">
          {Math.round((points[active].value as number) * 100)}%{points[active].extra ? ` · ${points[active].extra}` : ''}
        </text>
      )}
      {points.map((p, i) =>
        i % step === 0 ? (
          <text key={`x${i}`} x={x(i)} y={H - 5} textAnchor="middle" className="chart-xlabel">{p.label}</text>
        ) : null
      )}
    </svg>
  );
}

// —— 保持率半圆仪表：目标刻度 + 达标配色 ——
export function Gauge({ value, target = 0.9, size = 160 }: { value: number; target?: number; size?: number }) {
  const W = size;
  const H = size * 0.62;
  const c = W / 2;
  const cy = H - 4;
  const r = W / 2 - 12;
  const ang = (t: number) => Math.PI * (1 - Math.max(0, Math.min(1, t)));
  const pt = (t: number, rr = r): [number, number] => [c + rr * Math.cos(ang(t)), cy - rr * Math.sin(ang(t))];
  const arc = (t0: number, t1: number) => {
    const [x0, y0] = pt(t0);
    const [x1, y1] = pt(t1);
    const large = t1 - t0 > 0.5 ? 1 : 0;
    return `M${x0},${y0} A${r},${r} 0 ${large} 1 ${x1},${y1}`;
  };
  const v = Math.max(0, Math.min(1, value));
  const col = value >= target ? 'var(--good)' : value >= target - 0.1 ? '#e0892b' : 'var(--bad)';
  const [tx, ty] = pt(target, r + 7);
  const [bx, by] = pt(target, r - 7);
  return (
    <svg viewBox={`0 0 ${W} ${H + 16}`} width={W} height={H + 16} className="chart-gauge" role="img" aria-label="保持率仪表">
      <path d={arc(0, 1)} fill="none" stroke="var(--line)" strokeWidth={10} opacity={0.4} strokeLinecap="round" />
      {v > 0 && <path d={arc(0, v)} fill="none" stroke={col} strokeWidth={10} strokeLinecap="round" />}
      <line x1={bx} y1={by} x2={tx} y2={ty} stroke="var(--ink)" strokeWidth={2} />
      <text x={c} y={cy - 4} textAnchor="middle" className="donut-num">{Math.round(value * 100)}%</text>
    </svg>
  );
}
