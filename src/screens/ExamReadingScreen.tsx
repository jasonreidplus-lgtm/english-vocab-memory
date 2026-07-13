import React from 'react';
import { Lightbulb, Newspaper, ScrollText } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import MenuEntry from '../components/MenuEntry';
import type { ExamType } from '../types';

interface ExamReadingScreenProps {
  exam: ExamType;
  passageCount: number;
  themeKey: string;
  onTheme: (key: string) => void;
  onBack: () => void;
  onPassages: () => void;
  onRead: () => void;
  onCloze: () => void;
}

export default function ExamReadingScreen({
  exam,
  passageCount,
  themeKey,
  onTheme,
  onBack,
  onPassages,
  onRead,
  onCloze,
}: ExamReadingScreenProps) {
  const label = exam === 'english2' ? '考研英语二' : '考研英语一';
  return (
    <>
      <HeaderBar onBack={onBack} themeKey={themeKey} onTheme={onTheme} />
      <div className="section-title">
        {label}
        <span className="label" style={{ marginLeft: 'auto', fontSize: 12 }}>内置真题 {passageCount} 篇</span>
      </div>
      <div className="stack gap8 mt8">
        <MenuEntry
          icon={<Newspaper size={20} color="var(--accent)" />}
          title="真题阅读 · 闯关"
          sub="按年份和 Text 分类，逐句看原文与译文"
          onClick={onPassages}
        />
        <MenuEntry
          icon={<Lightbulb size={20} color="var(--accent)" />}
          title="句子精读 · 长难句"
          sub={`只使用${label}句库，查看主干、结构与考点`}
          onClick={onCloze}
        />
        <MenuEntry
          icon={<ScrollText size={20} color="var(--accent)" />}
          title="粘贴精读"
          sub={`粘贴${label}原文，自动高亮并点词查卡`}
          onClick={onRead}
        />
      </div>
    </>
  );
}
