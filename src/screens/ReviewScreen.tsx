import React from 'react';
import { Brain, BookOpen, Puzzle, Settings } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import MenuEntry from '../components/MenuEntry';

interface ReviewScreenProps {
  themeKey: string;
  onTheme: (key: string) => void;
  reviewDue?: number;
  wrongCount?: number;
  onReview: () => void;
  onBrowseWrong?: () => void;
  onMatch: () => void;
  onOpenSettings?: () => void;
}

/* 「复习」标签页：间隔复习 / 浏览错词 / 词根连连看。 */
export default function ReviewScreen({ themeKey, onTheme, reviewDue = 0, wrongCount = 0, onReview, onBrowseWrong, onMatch, onOpenSettings }: ReviewScreenProps) {
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
          title="间隔复习"
          sub={reviewDue > 0 ? `今日待复习 ${reviewDue} 词` : wrongCount > 0 ? `复习池 ${wrongCount} 词 · 今日已清` : '暂无错词，先去闯关吧'}
          disabled={reviewDue === 0}
          onClick={onReview}
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
        错词来自：闯关答错 · 真题点词「加入错词本」· 学习卡「不认识」。<br />
        到期才提醒，按 1/2/4/7/15 天间隔安排复习。
      </div>
    </>
  );
}
