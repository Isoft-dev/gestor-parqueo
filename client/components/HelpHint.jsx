import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';

export default function HelpHint({
  label = 'Mostrar ayuda',
  title = 'Guia',
  children,
  className = '',
  align = 'start',
}) {
  const [open, setOpen] = useState(false);
  const [resolvedAlign, setResolvedAlign] = useState(align);
  const rootRef = useRef(null);
  const panelRef = useRef(null);
  const panelId = useId();

  useEffect(() => {
    setResolvedAlign(align);
  }, [align]);

  useEffect(() => {
    if (!open) return undefined;

    function handlePointerDown(event) {
      if (!rootRef.current?.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('touchstart', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('touchstart', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return undefined;

    function updateAlignment() {
      const root = rootRef.current;
      const panel = panelRef.current;
      if (!root || !panel) return;

      const gutter = 16;
      const viewportWidth = window.innerWidth;
      const panelWidth = panel.offsetWidth;
      const rootRect = root.getBoundingClientRect();
      const fitsStart = rootRect.left + panelWidth <= viewportWidth - gutter;
      const fitsEnd = rootRect.right - panelWidth >= gutter;
      let nextAlign = align === 'end' ? 'end' : 'start';

      if (nextAlign === 'start' && !fitsStart && fitsEnd) {
        nextAlign = 'end';
      } else if (nextAlign === 'end' && !fitsEnd && fitsStart) {
        nextAlign = 'start';
      } else if (!fitsStart && !fitsEnd) {
        nextAlign = rootRect.left > viewportWidth - rootRect.right ? 'end' : 'start';
      }

      setResolvedAlign((current) => (current === nextAlign ? current : nextAlign));
    }

    updateAlignment();
    window.addEventListener('resize', updateAlignment);

    return () => {
      window.removeEventListener('resize', updateAlignment);
    };
  }, [align, open]);

  return (
    <div
      ref={rootRef}
      className={`help-hint help-hint--align-${resolvedAlign}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="help-hint__button"
        aria-label={label}
        aria-expanded={open}
        aria-controls={panelId}
        title={label}
        onClick={() => setOpen((value) => !value)}
      >
        ?
      </button>
      {open ? (
        <div
          ref={panelRef}
          id={panelId}
          className="help-hint__panel"
          role="dialog"
          aria-label={title}
        >
          {title ? <div className="help-hint__title">{title}</div> : null}
          <div className="help-hint__content">{children}</div>
        </div>
      ) : null}
    </div>
  );
}
