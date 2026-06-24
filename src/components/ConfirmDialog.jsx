import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useModalA11y } from '../lib/useModalA11y.js';

/* 应用内确认弹窗(替代原生 window.confirm，统一画风)。复用 .modal 样式。 */
export default function ConfirmDialog({
  title,
  message,
  confirmText = '确定',
  cancelText = '取消',
  danger = false,
  onConfirm,
  onCancel,
}) {
  const ref = useModalA11y(onCancel);
  return (
    <div className="modal-backdrop fade" onClick={onCancel}>
      <div
        className="modal"
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: 340 }}
      >
        <div
          className="result-title"
          style={{ fontSize: 19, display: 'flex', alignItems: 'center', gap: 8 }}
        >
          {danger && <AlertTriangle size={18} style={{ color: 'var(--bad)' }} />}
          {title}
        </div>
        {message && (
          <div className="label" style={{ marginTop: 10, lineHeight: 1.6 }}>
            {message}
          </div>
        )}
        <div className="row gap10 mt16">
          <button className="btn ghost grow" onClick={onCancel}>
            {cancelText}
          </button>
          <button
            className="btn grow"
            onClick={onConfirm}
            style={danger ? { background: 'var(--bad)', color: 'var(--bg2)' } : undefined}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
