import React from 'react';
import type { ComponentType } from 'react';
import { Swords, Brain, BookOpen, BarChart3 } from 'lucide-react';

type TabKey = 'levels' | 'review' | 'reading' | 'stats';

interface TabItem {
  key: TabKey;
  label: string;
  Icon: ComponentType<{ size?: number }>;
}

const TABS: TabItem[] = [
  { key: 'levels', label: '闯关', Icon: Swords },
  { key: 'review', label: '复习', Icon: Brain },
  { key: 'reading', label: '阅读', Icon: BookOpen },
  { key: 'stats', label: '统计', Icon: BarChart3 },
];

interface TabBarProps {
  tab: TabKey;
  onTab: (key: TabKey) => void;
}

/* 底部主导航。仅在 4 个主标签页显示；深层流程(学习/闯关/精读等)不显示。 */
export default function TabBar({ tab, onTab }: TabBarProps) {
  return (
    <nav className="tabbar" role="tablist" aria-label="主导航">
      {TABS.map(({ key, label, Icon }) => (
        <button
          key={key}
          role="tab"
          aria-selected={tab === key}
          className={`tabbar-item${tab === key ? ' on' : ''}`}
          onClick={() => onTab(key)}
        >
          <Icon size={20} />
          <span>{label}</span>
        </button>
      ))}
    </nav>
  );
}
