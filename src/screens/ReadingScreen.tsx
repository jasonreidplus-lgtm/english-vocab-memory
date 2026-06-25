import React from 'react';
import { Newspaper, ScrollText, Lightbulb, Search, Settings } from 'lucide-react';
import HeaderBar from '../components/HeaderBar';
import MenuEntry from '../components/MenuEntry';

interface ReadingScreenProps {
  themeKey: string;
  onTheme: (key: string) => void;
  onPassages: () => void;
  onRead: () => void;
  onCloze: () => void;
  onSearch: () => void;
  onOpenSettings?: () => void;
}

/* 「阅读·查词」标签页：真题阅读闯关 / 真题精读 / 句子精读 / 查词。 */
export default function ReadingScreen({ themeKey, onTheme, onPassages, onRead, onCloze, onSearch, onOpenSettings }: ReadingScreenProps) {
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
          icon={<Newspaper size={20} color="var(--accent)" />}
          title="真题阅读 · 闯关"
          sub="历年真题，逐句精读、标考研词、看译文"
          onClick={onPassages}
        />
        <MenuEntry
          icon={<ScrollText size={20} color="var(--accent)" />}
          title="真题精读"
          sub="粘贴任意真题原文，自动高亮、点词看卡"
          onClick={onRead}
        />
        <MenuEntry
          icon={<Lightbulb size={20} color="var(--accent)" />}
          title="句子精读"
          sub="整句英文 + 翻译 + 词义讲解"
          onClick={onCloze}
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
