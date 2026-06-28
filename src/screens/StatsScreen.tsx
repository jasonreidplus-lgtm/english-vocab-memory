import React, { useMemo, useState } from 'react';
import { Trophy, Flame, Target, BookCheck, Zap, CalendarDays, Brain, Settings, TrendingUp, CalendarClock, Layers, Gauge as GaugeIcon, FileDown, AlertTriangle, BarChart3, Clock, Medal } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import { accuracy, dayKey } from '../state/progress';
import { useStats } from '../lib/useStats';
import { TIER_ORDER, TIER_META, estimateCompletion, type ExportFilter } from '../lib/stats';
import { Donut, BurndownChart, BarChart, TrendChart, Gauge, DailyStackChart, type DonutSeg, type Bar, type TrendDatum, type DualBar } from '../components/Charts';
import type { Progress, Summary } from '../types';

const WEEKS = 17; // 热力图回看周数
const WEEKDAY_LABELS = ['一', '', '三', '', '五', '', '日'];
const RANGES: Array<{ d: number; label: string }> = [
  { d: 7, label: '7天' },
  { d: 30, label: '30天' },
  { d: 90, label: '90天' },
  { d: 182, label: '全部' },
];
const EXPORTS: Array<{ key: ExportFilter; label: string }> = [
  { key: 'leech', label: '困难词' },
  { key: 'due', label: '即将到期' },
  { key: 'learning', label: '学习中' },
  { key: 'familiar', label: '熟悉' },
  { key: 'wrong-all', label: '全部错词' },
  { key: 'learned-all', label: '全部已学' },
];

// 段位：按「完全学会(掌握)」词数划分
const RANKS: Array<{ min: number; name: string; icon: string }> = [
  { min: 0, name: '词芽', icon: '🌱' },
  { min: 30, name: '初学乍练', icon: '📗' },
  { min: 120, name: '四级水准', icon: '📘' },
  { min: 400, name: '六级水准', icon: '📙' },
  { min: 1000, name: '考研入门', icon: '🎓' },
  { min: 2200, name: '考研高手', icon: '🏆' },
  { min: 3800, name: '词汇大神', icon: '👑' },
];
function fmtDur(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 1) return '不足 1 分';
  if (m < 60) return `${m} 分钟`;
  return `${Math.floor(m / 60)} 小时 ${m % 60} 分`;
}

interface HeatCell { key: string; count: number; }

function buildGrid(history: Record<string, number>): { cells: HeatCell[]; lead: number } {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const days = WEEKS * 7;
  const cells: HeatCell[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const key = dayKey(d);
    cells.push({ key, count: history[key] || 0 });
  }
  const first = new Date(today);
  first.setDate(today.getDate() - (days - 1));
  const lead = (first.getDay() + 6) % 7;
  return { cells, lead };
}

function levelOf(count: number, goal: number): number {
  if (!count) return 0;
  const r = count / (goal || 20);
  if (r < 0.34) return 1;
  if (r < 0.67) return 2;
  if (r < 1) return 3;
  return 4;
}
const cellStyle = (lvl: number): React.CSSProperties =>
  lvl === 0 ? { background: 'var(--accent-soft)' } : { background: 'var(--accent)', opacity: 0.3 + lvl * 0.17 };

const pct = (x: number) => Math.round(x * 100);
const fmt1 = (x: number) => (Math.round(x * 10) / 10).toString();

interface TileProps { icon: React.ReactNode; num: React.ReactNode; label: string; }
function Tile({ icon, num, label }: TileProps) {
  return (
    <div className="stat-tile">
      <span className="stat-icon">{icon}</span>
      <span className="stat-num">{num}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}

interface StatsScreenProps {
  progress: Progress;
  summary: Summary;
  themeKey: string;
  onTheme: (k: string) => void;
  onOpenSettings?: () => void;
  onExamDate: (iso: string) => void;
  onExport: (filter: ExportFilter) => void;
}

export default function StatsScreen({ progress, summary, themeKey, onTheme, onOpenSettings, onExamDate, onExport }: StatsScreenProps) {
  const history = progress.history || {};
  const goal = (progress.daily && progress.daily.goal) || 20;
  const [range, setRange] = useState(30);
  const [tier, setTier] = useState<string | null>(null);
  const stats = useStats(progress, summary, range);

  const { cells, lead } = useMemo(() => buildGrid(history), [history]);
  const studyDays = useMemo(() => Object.values(history).filter((n: number) => n > 0).length, [history]);
  const totalWordsCnt = useMemo(() => Object.values(history).reduce((a: number, b: number) => a + (b || 0), 0), [history]);
  const streak = (progress.daily && progress.daily.streak) || 0;

  const { coverage, pace, mastery, retention, futureDue, stabilityHist, trend } = stats;

  // 段位(按完全学会词数) / 学习时长 / 智能学完预估
  const mastered = mastery.tiers.solid;
  const rankIdx = RANKS.reduce((acc, r, i) => (mastered >= r.min ? i : acc), 0);
  const rank = RANKS[rankIdx];
  const nextRank = RANKS[rankIdx + 1];
  const rankProg = nextRank ? Math.min(1, (mastered - rank.min) / (nextRank.min - rank.min)) : 1;
  const timeHistory = progress.timeHistory || {};
  const todayMs = timeHistory[dayKey()] || 0;
  const totalMs = useMemo(() => Object.values(timeHistory).reduce((a: number, b: number) => a + (b || 0), 0), [timeHistory]);
  const estimate = useMemo(() => estimateCompletion(progress, summary), [progress, summary]);
  const dualBars: DualBar[] = stats.dual.map((d) => ({ label: d.label, learn: d.learn, review: d.review, cum: d.cum }));

  const donutSegs: DonutSeg[] = TIER_ORDER.map((t) => ({ key: t, label: TIER_META[t].label, value: mastery.tiers[t], color: TIER_META[t].color }));
  const selSeg = tier ? donutSegs.find((s) => s.key === tier) : null;

  const dueBars: Bar[] = useMemo(() => {
    const base = new Date();
    base.setHours(0, 0, 0, 0);
    return futureDue.days.map((v, i) => {
      const d = new Date(base);
      d.setDate(base.getDate() + i);
      return { label: `${d.getMonth() + 1}/${d.getDate()}`, value: v };
    });
  }, [futureDue]);
  const stabBars: Bar[] = stabilityHist.map((b) => ({ label: b.label, value: b.count }));
  const trendData: TrendDatum[] = trend.map((p) => ({ label: p.label, value: p.trueRet, extra: `${p.reviews}次` }));
  const hasTrend = trendData.some((p) => p.value != null);

  const paceMsg = pace.remaining === 0
    ? '🎉 词库已全部学完！'
    : pace.onTrack
      ? `✅ 在轨道上 · 近 7 日 ${fmt1(pace.actualPerDay)} 词/天 ≥ 需 ${fmt1(pace.neededPerDay)} 词/天`
      : pace.actualPerDay <= 0
        ? `⏳ 还没开始计速 · 需 ${fmt1(pace.neededPerDay)} 词/天才能考前学完`
        : `⚠️ 落后 · 当前 ${fmt1(pace.actualPerDay)} 词/天 < 需 ${fmt1(pace.neededPerDay)} 词/天，按此速度考前约差 ${pace.deficit} 词`;

  return (
    <>
      <HeaderBar
        themeKey={themeKey}
        onTheme={onTheme}
        extra={onOpenSettings && (
          <button className="pill" onClick={onOpenSettings} aria-label="设置" style={{ padding: '6px 8px' }}>
            <Settings size={16} />
          </button>
        )}
      />

      <div className="section-title">学习统计</div>
      <div className="stat-grid">
        <Tile icon={<BookCheck size={18} color="var(--accent)" />} num={summary.learnedWords} label="已学单词" />
        <Tile icon={<Target size={18} color="var(--accent)" />} num={`${accuracy(progress)}%`} label="答题正确率" />
        <Tile icon={<Brain size={18} color="var(--accent)" />} num={summary.wrongCount} label="复习中" />
        <Tile icon={<Zap size={18} color="var(--accent)" />} num={progress.xp} label="累计 XP" />
        <Tile icon={<Flame size={18} color="var(--accent)" />} num={streak} label="连续打卡(天)" />
        <Tile icon={<Trophy size={18} color="var(--accent)" />} num={progress.bestCombo || 0} label="最佳连胜" />
      </div>

      <div className="time-line">
        <Clock size={14} /> 今日学习 <b>{fmtDur(todayMs)}</b> · 累计 <b>{fmtDur(totalMs)}</b>
      </div>

      {/* —— 段位 —— */}
      <div className="section-title"><Medal size={15} /> 段位</div>
      <div className="card stat-card rank-card">
        <div className="rank-badge">{rank.icon}</div>
        <div className="rank-body">
          <div className="rank-name">{rank.name}</div>
          <div className="rank-sub">
            已完全学会 <b>{mastered}</b> 词{nextRank ? ` · 距「${nextRank.name}」还差 ${Math.max(0, nextRank.min - mastered)} 词` : ' · 已封顶 🎉'}
          </div>
          <div className="rank-bar"><i style={{ width: `${rankProg * 100}%` }} /></div>
        </div>
      </div>

      {/* —— 进度 · 配速 / 燃尽 —— */}
      <div className="section-title"><TrendingUp size={15} /> 进度 · 配速</div>
      <div className="card stat-card">
        <div className="row between wrap" style={{ gap: 8, marginBottom: 4 }}>
          <span className="big-num">{pct(coverage.pct)}%<span className="big-sub"> 覆盖 {coverage.learned}/{coverage.total}</span></span>
          <label className="exam-pick">
            考试日 <input type="date" value={progress.examDate || '2026-12-21'} onChange={(e) => e.target.value && onExamDate(e.target.value)} />
          </label>
        </div>
        <BurndownChart learned={coverage.learned} total={coverage.total} daysToExam={pace.daysToExam} actualPerDay={pace.actualPerDay} onTrack={pace.onTrack} />
        <div className={'pace-msg ' + (pace.onTrack || pace.remaining === 0 ? 'ok' : 'warn')}>{paceMsg}</div>
        <div className="est-line">
          📅 按每日 {estimate.capacity} 词(含复习)推演：
          {estimate.remainingNew === 0
            ? '新词已学完 🎉'
            : estimate.learnDays != null
              ? <>约 <b>{estimate.learnDays}</b> 天学完剩余新词</>
              : '当前每日量偏低，复习已占满精力，短期难学完'}
          {estimate.masterDays != null && <> · 约 <b>{estimate.masterDays}</b> 天全部掌握</>}
        </div>
        <div className="pace-grid">
          <div><b>{pace.daysToExam}</b><span>距考试(天)</span></div>
          <div><b>{pace.remaining}</b><span>剩余新词</span></div>
          <div><b>{fmt1(pace.neededPerDay)}</b><span>需 词/天</span></div>
          <div><b>{fmt1(pace.actualPerDay)}</b><span>近7日 词/天</span></div>
        </div>
      </div>

      {/* —— 每日学习 · 复习(分色柱 + 累计曲线) —— */}
      <div className="section-title"><BarChart3 size={15} /> 每日学习 · 复习</div>
      <div className="card stat-card">
        <div className="range-tabs">
          {RANGES.map((r) => (
            <button key={r.d} className={'range-tab' + (range === r.d ? ' on' : '')} onClick={() => setRange(r.d)}>{r.label}</button>
          ))}
        </div>
        <DailyStackChart bars={dualBars} />
        <div className="stack-legend">
          <span><i style={{ background: 'var(--accent)' }} /> 学习</span>
          <span><i style={{ background: 'var(--good)' }} /> 复习</span>
          <span><i className="ln" /> 累计已学</span>
        </div>
        <div className="muted-line">每根柱：上段＝当日新学、下段＝当日复习；曲线＝累计已学(学习曲线)。点柱看当天明细。</div>
      </div>

      {/* —— 掌握分布 —— */}
      <div className="section-title"><Layers size={15} /> 掌握分布</div>
      <div className="card stat-card">
        <div className="donut-wrap">
          <Donut segments={donutSegs} centerNum={`${pct(mastery.matureCoverage)}%`} centerSub="已掌握" onSelect={setTier} selectedKey={tier} />
          <div className="legend">
            {donutSegs.map((s) => (
              <button key={s.key} className={'legend-item' + (tier === s.key ? ' on' : '')} onClick={() => setTier(tier === s.key ? null : s.key)}>
                <i style={{ background: s.color }} /> {s.label} <b>{s.value}</b>
              </button>
            ))}
          </div>
        </div>
        <div className="muted-line">
          {selSeg ? `${selSeg.label}：${selSeg.value} 词 · 占 ${pct(coverage.total ? selSeg.value / coverage.total : 0)}%` : `已掌握(稳固)占词库 ${pct(mastery.matureCoverage)}%`}
          {mastery.leech > 0 && <span className="leech-tag"><AlertTriangle size={12} /> 困难词 {mastery.leech}</span>}
        </div>
      </div>

      {/* —— 错词保持率 —— */}
      <div className="section-title"><GaugeIcon size={15} /> 错词保持率</div>
      <div className="card stat-card">
        {retention.reviewedCount === 0 ? (
          <div className="empty-mod">复习错词后，这里显示记忆保持率 📈</div>
        ) : (
          <div className="retention-wrap">
            <Gauge value={retention.current ?? 0} target={retention.target} />
            <div className="retention-side">
              <div className="ret-row"><span>当前保持率</span><b>{retention.current != null ? pct(retention.current) : '—'}%</b></div>
              <div className="ret-row"><span>考试日(若不再复习)</span><b>{retention.atExam != null ? pct(retention.atExam) : '—'}%</b></div>
              <div className="ret-row">
                <span>真实保持率</span>
                <b>{retention.trueRet != null ? `${pct(retention.trueRet)}%` : '样本不足'}</b>
              </div>
              <div className="ret-foot">FSRS 目标 {pct(retention.target)}% · 样本 {retention.sampleSize} 次复习</div>
            </div>
          </div>
        )}
      </div>

      {/* —— 未来到期(复习债) —— */}
      <div className="section-title"><CalendarClock size={15} /> 未来 30 天到期</div>
      <div className="card stat-card">
        <BarChart bars={dueBars} unit=" 词" color="var(--accent)" />
        <div className="muted-line">
          {futureDue.overdue > 0 ? <span className="leech-tag"><AlertTriangle size={12} /> 已逾期 {futureDue.overdue} 词，尽快复习</span> : '把复习摊平到每天，别把债堆到考前。'}
        </div>
      </div>

      {/* —— 复习趋势 —— */}
      <div className="section-title"><TrendingUp size={15} /> 复习趋势</div>
      <div className="card stat-card">
        <div className="range-tabs">
          {RANGES.map((r) => (
            <button key={r.d} className={'range-tab' + (range === r.d ? ' on' : '')} onClick={() => setRange(r.d)}>{r.label}</button>
          ))}
        </div>
        {hasTrend ? (
          <TrendChart points={trendData} target={retention.target} />
        ) : (
          <div className="empty-mod">坚持复习后，这里显示每周「真实保持率」走势 📊</div>
        )}
      </div>

      {/* —— 记忆稳定度 —— */}
      {summary.wrongCount > 0 && (
        <>
          <div className="section-title"><Layers size={15} /> 记忆稳定度分布</div>
          <div className="card stat-card">
            <BarChart bars={stabBars} unit=" 词" color="var(--good)" />
            <div className="muted-line">错词卡按记忆稳定度(下次能撑多久)分桶。</div>
          </div>
        </>
      )}

      {/* —— 打卡热力图(原有) —— */}
      <div className="section-title"><CalendarDays size={15} /> 打卡热力图</div>
      <div className="heatmap">
        <div className="hm-body">
          <div className="hm-weekcol">
            {WEEKDAY_LABELS.map((w, i) => (<span key={i}>{w}</span>))}
          </div>
          <div className="hm-grid">
            {Array.from({ length: lead }).map((_, i) => (<div key={`lead-${i}`} className="hm-cell hm-blank" />))}
            {cells.map((c) => (
              <div key={c.key} className="hm-cell" style={cellStyle(levelOf(c.count, goal))} title={`${c.key}：${c.count} 词`} />
            ))}
          </div>
        </div>
        <div className="hm-foot">
          <span>近 {WEEKS} 周 · 学习 {studyDays} 天 · 累计练习 {totalWordsCnt} 词次</span>
          <span className="hm-legend">
            少{[0, 1, 2, 3, 4].map((l) => (<i key={l} style={cellStyle(l)} />))}多
          </span>
        </div>
      </div>

      {/* —— 导出 PDF —— */}
      <div className="section-title"><FileDown size={15} /> 导出 / 打印</div>
      <div className="card stat-card">
        <div className="export-grid">
          {EXPORTS.map((e) => (
            <button key={e.key} className="export-btn" onClick={() => onExport(e.key)}>{e.label}</button>
          ))}
        </div>
        <div className="muted-line">选一类导出单词表 → 打印对话框「另存为 PDF」。困难词最适合考前突击。</div>
      </div>

      {studyDays === 0 && (
        <div className="label center" style={{ marginTop: 14, fontSize: 12, opacity: 0.8 }}>开始学习后，这里会逐渐亮起来 ✨</div>
      )}
    </>
  );
}
