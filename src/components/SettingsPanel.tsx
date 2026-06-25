import React from 'react';
import { X, Volume2, VolumeX, RotateCcw, LogOut } from 'lucide-react';
import { useModalA11y } from '../lib/useModalA11y';
import type { Progress } from '../types';

interface SettingsPanelProps {
  progress: Progress;
  onClose: () => void;
  onSetPref: ((key: 'sound', value: boolean) => void) & ((key: 'accent', value: 'us' | 'uk') => void);
  onSetGoal: (goal: number) => void;
  onReset: () => void;
  onLogout?: () => void;
}

export default function SettingsPanel({ progress, onClose, onSetPref, onSetGoal, onReset, onLogout }: SettingsPanelProps) {
  const sound = progress.sound !== false;
  const accent = progress.accent || 'us';
  const goal = (progress.daily && progress.daily.goal) || 20;
  const ref = useModalA11y(onClose);

  return (
    <div className="modal-backdrop fade" onClick={onClose}>
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label="设置"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ marginBottom: 6 }}>
          <div className="result-title" style={{ fontSize: 20 }}>设置</div>
          <button className="pill" onClick={onClose} aria-label="关闭" style={{ padding: '6px 8px' }}>
            <X size={18} />
          </button>
        </div>

        <div className="set-row">
          <span>音效朗读</span>
          <button className={`set-toggle ${sound ? 'on' : ''}`} onClick={() => onSetPref('sound', !sound)}>
            {sound ? <Volume2 size={15} /> : <VolumeX size={15} />} {sound ? '开' : '关'}
          </button>
        </div>

        <div className="set-row">
          <span>发音口音</span>
          <div className="seg">
            <button className={accent === 'us' ? 'on' : ''} onClick={() => onSetPref('accent', 'us')}>美音</button>
            <button className={accent === 'uk' ? 'on' : ''} onClick={() => onSetPref('accent', 'uk')}>英音</button>
          </div>
        </div>

        <div className="set-row">
          <span>每日目标</span>
          <div className="seg">
            {[10, 20, 30, 50].map((g) => (
              <button key={g} className={goal === g ? 'on' : ''} onClick={() => onSetGoal(g)}>
                {g}
              </button>
            ))}
          </div>
        </div>

        {onLogout && (
          <button className="btn ghost block mt16" onClick={onLogout}>
            <LogOut size={15} /> 退出登录
          </button>
        )}

        <button className="btn ghost block mt12" onClick={onReset} style={{ color: 'var(--bad)' }}>
          <RotateCcw size={15} /> 重置全部进度
        </button>
        <div className="label center mt12" style={{ fontSize: 11, opacity: 0.7 }}>
          进度仅保存在本机浏览器 · 画风不受重置影响
        </div>
      </div>
    </div>
  );
}
