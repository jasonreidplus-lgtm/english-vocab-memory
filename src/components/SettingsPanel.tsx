import React, { useEffect, useRef, useState } from 'react';
import { X, Volume2, VolumeX, RotateCcw, LogOut, Download, Upload, CloudDownload, Copy, ClipboardPaste } from 'lucide-react';
import { useModalA11y } from '../lib/useModalA11y';
import { exportProgress, importProgress, exportProgressCode, importProgressCode } from '../lib/backup';
import { precacheAudio, type PrecacheProgress } from '../lib/precache';
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

  const fileRef = useRef<HTMLInputElement>(null);
  const [msg, setMsg] = useState<string>('');
  const [pc, setPc] = useState<PrecacheProgress | null>(null);
  const ctrl = useRef({ cancelled: false });
  const [goalInput, setGoalInput] = useState(String(goal));
  const [pasteOpen, setPasteOpen] = useState(false);
  const [pasteText, setPasteText] = useState('');

  useEffect(() => { setGoalInput(String(goal)); }, [goal]);

  const commitGoal = () => {
    const n = Math.max(1, Math.min(999, Math.round(Number(goalInput) || 0)));
    onSetGoal(n);
    setGoalInput(String(n));
  };

  const onPickFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    if (!window.confirm('导入会覆盖当前进度，确定继续？')) return;
    const ok = await importProgress(f);
    if (ok) {
      setMsg('导入成功，正在刷新…');
      setTimeout(() => location.reload(), 600);
    } else {
      setMsg('文件无效，未导入');
    }
  };

  // 跨设备：复制备份码到剪贴板；失败则展示在文本框里手动复制(#7)
  const onCopyBackup = async () => {
    try {
      const code = await exportProgressCode();
      await navigator.clipboard.writeText(code);
      setMsg('备份码已复制 ✓ 到另一台设备点「粘贴导入」');
    } catch {
      const code = await exportProgressCode();
      setPasteOpen(true);
      setPasteText(code);
      setMsg('已生成备份码，请长按全选复制');
    }
  };
  const onPasteImport = async () => {
    if (!window.confirm('导入会覆盖当前进度，确定继续？')) return;
    const ok = await importProgressCode(pasteText.trim());
    if (ok) {
      setMsg('导入成功，正在刷新…');
      setTimeout(() => location.reload(), 600);
    } else {
      setMsg('备份码无效，未导入');
    }
  };

  const runPrecache = async () => {
    if (pc && pc.done < pc.total) return; // 进行中
    ctrl.current.cancelled = false;
    setPc({ done: 0, total: 1, failed: 0 });
    const r = await precacheAudio(accent, setPc, ctrl.current);
    setPc(r);
  };
  const pcRunning = !!pc && pc.done < pc.total;
  const pcLabel = !pc
    ? '缓存全部'
    : pcRunning
      ? `缓存中 ${pc.done}/${pc.total}`
      : `已缓存 ${pc.done - pc.failed}${pc.failed ? `（${pc.failed} 个跳过）` : ''}`;

  return (
    <div className="modal-backdrop fade" onClick={onClose}>
      <div className="modal" ref={ref} role="dialog" aria-modal="true" aria-label="设置" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
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
              <button key={g} className={goal === g ? 'on' : ''} onClick={() => onSetGoal(g)}>{g}</button>
            ))}
          </div>
        </div>

        <div className="set-row">
          <span>自定义目标 / 词</span>
          <input
            className="goal-input"
            type="number"
            min={1}
            max={999}
            inputMode="numeric"
            value={goalInput}
            onChange={(e) => setGoalInput(e.target.value)}
            onBlur={commitGoal}
            onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
            aria-label="自定义每日目标词数"
          />
        </div>

        <div className="set-row">
          <span>离线发音（{accent === 'uk' ? '英音' : '美音'}）</span>
          <button className={`set-toggle ${pc && !pcRunning ? 'on' : ''}`} onClick={runPrecache} disabled={pcRunning}>
            <CloudDownload size={15} /> {pcLabel}
          </button>
        </div>

        <div className="set-row">
          <span>数据备份（文件）</span>
          <div className="seg">
            <button onClick={() => { exportProgress(); setMsg('已导出备份文件'); }}><Download size={14} /> 导出</button>
            <button onClick={() => fileRef.current?.click()}><Upload size={14} /> 导入</button>
          </div>
        </div>
        <input ref={fileRef} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={onPickFile} />

        <div className="set-row">
          <span>跨设备同步</span>
          <div className="seg">
            <button onClick={onCopyBackup}><Copy size={14} /> 复制</button>
            <button onClick={() => setPasteOpen((v) => !v)}><ClipboardPaste size={14} /> 粘贴导入</button>
          </div>
        </div>
        {pasteOpen && (
          <div className="paste-box">
            <textarea
              className="paste-area"
              rows={4}
              value={pasteText}
              onChange={(e) => setPasteText(e.target.value)}
              placeholder="把另一台设备点「复制」得到的备份码整段粘贴到这里"
            />
            <button className="btn ghost block mt8" onClick={onPasteImport} disabled={!pasteText.trim()}>
              确认导入（覆盖当前进度）
            </button>
          </div>
        )}

        {msg && <div className="label center mt8" style={{ fontSize: 12, color: 'var(--accent)' }}>{msg}</div>}

        {onLogout && (
          <button className="btn ghost block mt16" onClick={onLogout}>
            <LogOut size={15} /> 退出登录
          </button>
        )}

        <button className="btn ghost block mt12" onClick={onReset} style={{ color: 'var(--bad)' }}>
          <RotateCcw size={15} /> 重置全部进度
        </button>
        <div className="label center mt12" style={{ fontSize: 11, opacity: 0.7 }}>
          进度仅存本机浏览器 · 建议定期「导出备份」防丢失
        </div>
      </div>
    </div>
  );
}
