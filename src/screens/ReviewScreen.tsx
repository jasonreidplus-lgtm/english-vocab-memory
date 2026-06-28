import React from 'react';
import { Brain, BookOpen, Puzzle, Settings, Repeat } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import MenuEntry from '../components/MenuEntry';

interface ReviewScreenProps {
  themeKey: string;
  onTheme: (key: string) => void;
  reviewDue?: number; // 今日复习：FSRS 到期
  relearnDue?: number; // 今日重温：今天答错/不认识、还没记牢
  wrongCount?: number; // 错词本规模(未掌握)
  onReview: () => void;
  onRelearn: () => void;
  onBrowseWrong?: () => void;
  onMatch: () => void;
  onOpenSettings?: () => void;
}

/* 「复习」标签页：今日复习(间隔到期) / 今日重温(今天没记牢) / 浏览错词 / 词根连连看。 */
export default function ReviewScreen({
  themeKey,
  onTheme,
  reviewDue = 0,
  relearnDue = 0,
  wrongCount = 0,
  onReview,
  onRelearn,
  onBrowseWrong,
  onMatch,
  onOpenSettings,
}: ReviewScreenProps) {
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

      <div className="section-title">复习</div>
      <div className="stack gap8 mt8">
        <MenuEntry
          icon={<Brain size={20} color="var(--accent)" />}
          title="今日复习"
          sub={reviewDue > 0 ? `间隔记忆到期 ${reviewDue} 词` : wrongCount > 0 ? '到期的都复习完了 · 今日已清' : '暂无到期，先去闯关吧'}
          disabled={reviewDue === 0}
          onClick={onReview}
        />
        <MenuEntry
          icon={<Repeat size={20} color="var(--accent)" />}
          title="今日重温"
          sub={relearnDue > 0 ? `今天没记牢 ${relearnDue} 词 · 趁热再过一遍` : '今天没有需要重温的词'}
          disabled={relearnDue === 0}
          onClick={onRelearn}
        />
        {wrongCount > 0 && onBrowseWrong && (
          <button className="btn ghost block" style={{ minHeight: 42, fontSize: 14 }} onClick={onBrowseWrong}>
            <BookOpen size={15} /> 浏览错词卡（不测验）
          </button>
        )}
        <MenuEntry
          icon={<Puzzle size={20} color="var(--accent)" />}
          title="词根连连看"
          sub="单词 ↔ 释义 配对挑战"
          onClick={onMatch}
        />
      </div>

      <div className="label center" style={{ marginTop: 18, fontSize: 12, opacity: 0.8, lineHeight: 1.8 }}>
        今日复习＝按 FSRS 间隔到期的词；今日重温＝今天答错/「不认识」、还没记牢的词。<br />
        自评「忘了 / 模糊 / 记得 / 秒答」，算法据此安排下次间隔；「记得/秒答」即移出今日重温。
      </div>
    </>
  );
}
