import React, { useEffect, useRef, useState } from 'react';
import { Zap, Flame, Trophy, Play, CornerDownLeft, Settings } from 'lucide-react';
import HeaderBar from '../components/HeaderBar.jsx';
import DailyCard from '../components/DailyCard.jsx';

// 关卡网格里用轻量文字星标(★/☆)而非 SVG —— 550 关 × 多颗星时性能差距巨大
function starText(n) {
  return '★★★☆☆☆'.slice(3 - n, 6 - n);
}

function Cell({ lv, onPick, highlight }) {
  const { group, state, stars, readyCount, enterable } = lv;
  return (
    <button
      id={`level-${group}`}
      className={`cell is-${state}${highlight ? ' just-unlocked' : ''}`}
      disabled={!enterable}
      onClick={() => enterable && onPick(group)}
      aria-label={`第 ${group} 关`}
    >
      <span className="corner">
        {state === 'done' && '✓'}
        {state === 'locked' && '🔒'}
      </span>
      <span className="cell-no">{group}</span>
      <span className="cell-sub">
        {state === 'done' && <span className="cell-stars">{starText(stars)}</span>}
        {state === 'unlocked' && `${readyCount} 词`}
        {state === 'locked' && '未解锁'}
        {state === 'pending' && '待生成'}
      </span>
    </button>
  );
}

/* 「闯关」标签页：每日目标 + 继续学习 + 进度 + 关卡网格。 */
export default function LevelSelect({
  levelStates,
  progress,
  summary,
  themeKey,
  onTheme,
  onPick,
  onSetGoal,
  onOpenSettings,
  justUnlocked,
}) {
  const [jumpVal, setJumpVal] = useState('');

  // 当前进度前沿：第一个已解锁但未通关的关(没有就是最后一个已通关)
  const frontier =
    levelStates.find((l) => l.state === 'unlocked') ||
    [...levelStates].reverse().find((l) => l.state === 'done') ||
    null;

  const scrollToLevel = (n, flash) => {
    const el = document.getElementById(`level-${n}`);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    if (flash) {
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 1100);
    }
  };

  // 进入关卡页时，自动滚到当前前沿（“接着上次”）
  const didScroll = useRef(false);
  useEffect(() => {
    if (didScroll.current || !frontier || frontier.group <= 6) return;
    didScroll.current = true;
    const t = setTimeout(() => scrollToLevel(frontier.group, false), 60);
    return () => clearTimeout(t);
  }, [frontier]);

  const doJump = () => {
    const n = parseInt(jumpVal, 10);
    if (!n) return;
    const lv = levelStates.find((l) => l.group === n);
    if (!lv) return;
    setJumpVal('');
    if (lv.enterable) onPick(n);
    else scrollToLevel(n, true);
  };

  return (
    <>
      <HeaderBar themeKey={themeKey} onTheme={onTheme} extra={
        onOpenSettings && (
          <button className="pill" onClick={onOpenSettings} aria-label="设置" style={{ padding: '6px 8px' }}>
            <Settings size={16} />
          </button>
        )
      } />

      {/* 每日目标 / 连续打卡 */}
      <DailyCard daily={progress.daily} onSetGoal={onSetGoal} />

      {/* 继续学习：直达当前前沿关 */}
      {frontier && (
        <button className="btn primary block continue-btn mt12" onClick={() => onPick(frontier.group)}>
          <Play size={17} />
          {frontier.state === 'done' ? `重温 第 ${frontier.group} 关` : `继续学习 · 第 ${frontier.group} 关`}
        </button>
      )}

      {/* 统计条：XP / 连胜 / 通关进度 */}
      <div className="row gap8 mt12" style={{ flexWrap: 'wrap' }}>
        <span className="badge">
          <Zap size={15} color="var(--accent)" /> {progress.xp} XP
        </span>
        <span className="badge">
          <Flame size={15} color="var(--accent)" /> 连胜 {progress.combo}
        </span>
        <span className="badge">
          <Trophy size={14} color="var(--accent)" /> {summary.clearedCount}/{summary.readyCount}
        </span>
      </div>

      <div className="section-title">
        选择关卡
        <span className="jump-box" style={{ marginLeft: 'auto' }}>
          <input
            className="jump-input"
            type="number"
            min={1}
            max={summary.totalGroups}
            inputMode="numeric"
            placeholder="第几关"
            value={jumpVal}
            onChange={(e) => setJumpVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doJump()}
            aria-label="跳到第几关"
          />
          <button className="jump-go" onClick={doJump} aria-label="跳转">
            <CornerDownLeft size={15} />
          </button>
        </span>
      </div>

      <div className="grid">
        {levelStates.map((lv) => (
          <Cell key={lv.group} lv={lv} onPick={onPick} highlight={lv.group === justUnlocked} />
        ))}
      </div>

      <div className="label center" style={{ marginTop: 18, fontSize: 12, opacity: 0.8 }}>
        共 {summary.totalGroups} 关 · 每关 10 词 · 先翻卡学习，再闯关结算三星
      </div>
    </>
  );
}
