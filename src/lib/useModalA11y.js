import { useEffect, useRef } from 'react';

/* 弹窗可访问性：挂载时把焦点移入弹窗、Esc 关闭、Tab 焦点锁在弹窗内、关闭后焦点归位。
   用法：const ref = useModalA11y(onClose); <div className="modal" ref={ref} role="dialog" aria-modal="true" tabIndex={-1}> */
const FOCUSABLE =
  'button:not(:disabled), [href], input:not(:disabled), textarea:not(:disabled), select:not(:disabled), [tabindex]:not([tabindex="-1"])';

export function useModalA11y(onClose) {
  const ref = useRef(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    const prevFocused = document.activeElement;
    const focusables = () =>
      [...(node ? node.querySelectorAll(FOCUSABLE) : [])].filter((el) => el.offsetParent !== null);

    // 打开即把焦点移入弹窗(首个可聚焦元素，否则容器自身)
    const first = focusables()[0];
    (first || node)?.focus?.();

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current && closeRef.current();
        return;
      }
      if (e.key === 'Tab' && node) {
        const items = focusables();
        if (!items.length) return;
        const firstEl = items[0];
        const lastEl = items[items.length - 1];
        if (e.shiftKey && document.activeElement === firstEl) {
          e.preventDefault();
          lastEl.focus();
        } else if (!e.shiftKey && document.activeElement === lastEl) {
          e.preventDefault();
          firstEl.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      // 关闭后把焦点还给触发弹窗的元素
      if (prevFocused && typeof prevFocused.focus === 'function') prevFocused.focus();
    };
  }, []);

  return ref;
}
