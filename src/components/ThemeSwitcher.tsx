import React from 'react';
import { THEMES } from '../config/themes';

// 画风切换器：直接遍历 THEMES 配置渲染，不认识任何具体画风名。
// 新增画风(在 themes.jsx 加一个对象)后，这里会自动多出一个按钮。
interface ThemeSwitcherProps {
  value: string;
  onChange: (key: string) => void;
}

export default function ThemeSwitcher({ value, onChange }: ThemeSwitcherProps) {
  return (
    <div className="switcher" role="tablist" aria-label="画风">
      {THEMES.map((t) => (
        <button
          key={t.key}
          role="tab"
          aria-selected={t.key === value}
          className={`pill ${t.key === value ? 'on' : ''}`}
          onClick={() => onChange(t.key)}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
