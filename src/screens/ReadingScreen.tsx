import React from 'react';
import { BookOpenCheck, GraduationCap, Search, Settings } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import MenuEntry from '../components/MenuEntry';
import type { ExamType } from '../types';

interface ReadingScreenProps {
  themeKey: string;
  onTheme: (key: string) => void;
  onExam: (exam: ExamType) => void;
  counts: Record<ExamType, number>;
  onSearch: () => void;
  onOpenSettings?: () => void;
}

/* 「阅读·查词」总入口：英语一、英语二严格分库，再进入各自的阅读/长难句流程。 */
export default function ReadingScreen({ themeKey, onTheme, onExam, counts, onSearch, onOpenSettings }: ReadingScreenProps) {
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

      <div className="section-title">阅读 · 查词</div>
      <div className="stack gap8 mt8">
        <MenuEntry
          icon={<GraduationCap size={20} color="var(--accent)" />}
          title="考研英语一"
          sub={`内置真题 ${counts.english1} 篇 · 逐句翻译、长难句拆解`}
          onClick={() => onExam('english1')}
        />
        <MenuEntry
          icon={<BookOpenCheck size={20} color="var(--accent)" />}
          title="考研英语二"
          sub={`内置真题 ${counts.english2} 篇 · 2010—2026 分类与长难句`}
          onClick={() => onExam('english2')}
        />
        <MenuEntry
          icon={<Search size={20} color="var(--accent)" />}
          title="查词"
          sub="考研核心 + 广义词典，查任意单词"
          onClick={onSearch}
        />
      </div>
    </>
  );
}
