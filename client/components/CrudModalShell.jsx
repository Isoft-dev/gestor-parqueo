import { memo, useEffect, useId } from 'react';

function CrudModalShell({
  title,
  eyebrow,
  meta,
  onClose,
  children,
  footer,
  className = '',
  ariaLabelledBy,
}) {
  const autoTitleId = useId();
  const titleId = ariaLabelledBy || autoTitleId;

  useEffect(() => {
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (ev) => {
      if (ev.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="ops-entry-modal-backdrop crudx-cliente-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={onClose}
    >
      <div className={`crudx-cliente-modal ${className}`.trim()} onClick={(e) => e.stopPropagation()}>
        <header className="crudx-cliente-modal__header">
          <div>
            {eyebrow ? <p className="crudx-cliente-modal__eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="crudx-cliente-modal__title">{title}</h2>
            {meta ? <p className="crudx-cliente-modal__meta">{meta}</p> : null}
          </div>
          <button
            type="button"
            className="crudx-form-close"
            onClick={onClose}
            aria-label="Cerrar"
            title="Cerrar"
          >
            ✕
          </button>
        </header>
        <div className="crudx-cliente-modal__body">{children}</div>
        {footer ? <footer className="crudx-cliente-modal__actions crudx-form-actions">{footer}</footer> : null}
      </div>
    </div>
  );
}

export default memo(CrudModalShell);
