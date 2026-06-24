import React from 'react';
import { ChevronRight } from 'lucide-react';

/* 列表式入口(复习/阅读 标签页共用)。复用 .review-entry 样式。 */
export default function MenuEntry({ icon, title, sub, disabled, onClick }) {
  return (
    <button className="review-entry" disabled={disabled} onClick={onClick}>
      <span className="re-icon">{icon}</span>
      <span className="re-text">
        <span className="re-title">{title}</span>
        <span className="re-sub">{sub}</span>
      </span>
      {!disabled && <ChevronRight size={18} className="muted" />}
    </button>
  );
}
