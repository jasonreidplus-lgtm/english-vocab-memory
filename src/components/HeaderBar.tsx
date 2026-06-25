import React from 'react';
import { ChevronLeft } from 'lucide-react';
import ThemeSwitcher from './ThemeSwitcher';

interface HeaderBarProps {
  onBack?: () => void;
  themeKey: string;
  onTheme: (k: string) => void;
  extra?: React.ReactNode;
}

export default function HeaderBar({ onBack, themeKey, onTheme, extra }: HeaderBarProps) {
  return (
    <div className="row between">
      <div className="row" style={{ gap: 6, minWidth: 0 }}>
        {onBack && (
          <button
            className="pill"
            onClick={onBack}
            aria-label="返回"
            style={{ display: 'inline-flex', alignItems: 'center', padding: '6px 8px' }}
          >
            <ChevronLeft size={18} />
          </button>
        )}
        <div className="brand">
          考研词关<span className="brand-en"> <span className="dot">·</span> WordQuest</span>
        </div>
      </div>
      <div className="row" style={{ gap: 6 }}>
        {extra}
        <ThemeSwitcher value={themeKey} onChange={onTheme} />
      </div>
    </div>
  );
}
