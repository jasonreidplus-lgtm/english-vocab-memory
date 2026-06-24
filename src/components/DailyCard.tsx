import React from 'react';
import { Flame } from 'lucide-react';
import { DAILY_GOAL } from '../state/progress';

const GOAL_OPTIONS = [10, 20, 30, 50];
const R = 26;
const C = 2 * Math.PI * R;

export default function DailyCard({ daily, onSetGoal }) {
  const count = daily?.count || 0;
  const goal = daily?.goal || DAILY_GOAL;
  const streak = daily?.streak || 0;
  const progress = Math.min(1, goal > 0 ? count / goal : 0);
  const reached = count >= goal;

  return (
    <div className="daily-card">
      <svg width="62" height="62" viewBox="0 0 64 64" style={{ flexShrink: 0 }}>
        <circle cx="32" cy="32" r={R} fill="none" stroke="var(--accent-soft)" strokeWidth="7" />
        <circle
          cx="32"
          cy="32"
          r={R}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={C}
          strokeDashoffset={C * (1 - progress)}
          transform="rotate(-90 32 32)"
          style={{ transition: 'stroke-dashoffset .5s cubic-bezier(.4,1.4,.5,1)' }}
        />
        <text
          x="32"
          y={reached ? 40 : 38}
          textAnchor="middle"
          fontSize={reached ? 24 : 17}
          fill="var(--accent)"
          fontFamily="var(--display)"
        >
          {reached ? '✓' : count}
        </text>
      </svg>

      <div className="daily-text">
        <div className="dt-title">
          每日目标{reached && <span style={{ color: 'var(--accent)' }}> · 已达成</span>}
        </div>
        <div className="dt-sub">
          今日 {count}/{goal} 词 · <Flame size={12} style={{ verticalAlign: -1 }} color="var(--accent)" /> 连续打卡 {streak} 天
        </div>
        <div className="goal-pills">
          {GOAL_OPTIONS.map((g) => (
            <button
              key={g}
              className={`goal-pill ${g === goal ? 'on' : ''}`}
              onClick={() => onSetGoal(g)}
            >
              {g}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
