import React, { useMemo } from 'react';
import { Trophy, Flame, Target, BookCheck, Zap, CalendarDays, Brain } from 'lucide-react';
import HeaderBar from '../components/HeaderBar.jsx';
import { accuracy, dayKey } from '../state/progress.js';

const WEEKS = 17; // 热力图回看周数
const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日'];

// 生成最近 WEEKS*7 天的格子(末尾=今天)，并算出首格星期(用于补前导空格对齐周列)
function buildGrid(history) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = WEEKS * 7;
  const cells = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    cells.push({ key, count: history[key] || 0 });
  }
  const first = new Date(today);
  first.setDate(today.getDate() - (days - 1));
  // 让“周一”作为每列第一行：(getDay() 周日=0) → 周一=0
  const lead = (first.getDay() + 6) % 7;
  return { cells, lead };
}

function levelOf(count, goal) {
  if (!count) return 0;
  const r = count / (goal || 20);
  if (r < 0.34) return 1;
  if (r < 0.67) return 2;
  if (r < 1) return 3;
  return 4;
}
const cellStyle = (lvl) =>
  lvl === 0
    ? { background: 'var(--accent-soft)' }
    : { background: 'var(--accent)', opacity: 0.3 + lvl * 0.17 };

function Tile({ icon, num, label }) {
  return (
    <div className="stat-tile">
      <span className="stat-icon">{icon}</span>
      <span className="stat-num">{num}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

export default function StatsScreen({ progress, summary, themeKey, onTheme, onBack }) {
  const history = progress.history || {};
  const goal = (progress.daily && progress.daily.goal) || 20;
  const { cells, lead } = useMemo(() => buildGrid(history), [history]);

  const studyDays = useMemo(() => Object.values(history).filter((n) => n > 0).length, [history]);
  const totalWords = useMemo(() => Object.values(history).reduce((a, b) => a + (b || 0), 0), [history]);
  const streak = (progress.daily && progress.daily.streak) || 0;

  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />

      <div className="section-title">学习统计</div>

      <div className="stat-grid">
        <Tile icon={<BookCheck size={18} color="var(--accent)" />} num={summary.learnedWords} label="已学单词" />
        <Tile icon={<Target size={18} color="var(--accent)" />} num={`${accuracy(progress)}%`} label="答题正确率" />
        <Tile icon={<Brain size={18} color="var(--accent)" />} num={summary.wrongCount} label="复习中" />
        <Tile icon={<Zap size={18} color="var(--accent)" />} num={progress.xp} label="累计 XP" />
        <Tile icon={<Flame size={18} color="var(--accent)" />} num={streak} label="连续打卡(天)" />
        <Tile icon={<Trophy size={18} color="var(--accent)" />} num={progress.bestCombo || 0} label="最佳连胜" />
      </div>

      <div className="section-title">
        <CalendarDays size={15} /> 打卡热力图
      </div>
      <div className="heatmap">
        <div className="hm-body">
          <div className="hm-weekcol">
            {WEEKDAY_LABELS.map((w, i) => (
              <span key={i}>{w}</span>
            ))}
          </div>
          <div className="hm-grid">
            {Array.from({ length: lead }).map((_, i) => (
              <div key={`lead-${i}`} className="hm-cell hm-blank" />
            ))}
            {cells.map((c) => (
              <div
                key={c.key}
                className="hm-cell"
                style={cellStyle(levelOf(c.count, goal))}
                title={`${c.key}：${c.count} 词`}
              />
            ))}
          </div>
        </div>
        <div className="hm-foot">
          <span>近 {WEEKS} 周 · 学习 {studyDays} 天 · 累计练习 {totalWords} 词次</span>
          <span className="hm-legend">
            少
            {[0, 1, 2, 3, 4].map((l) => (
              <i key={l} style={cellStyle(l)} />
            ))}
            多
          </span>
        </div>
      </div>

      {studyDays === 0 && (
        <div className="label center" style={{ marginTop: 14, fontSize: 12, opacity: 0.8 }}>
          开始学习后，这里会逐渐亮起来 ✨
        </div>
      )}
    </>
  );
}
