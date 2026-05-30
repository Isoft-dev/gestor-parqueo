import { memo } from 'react';
import { BtnContent, IconEdit } from './UiIcons.jsx';
import CrudModalShell from './CrudModalShell.jsx';

function CrudRecordDetailModal({
  title,
  eyebrow = 'Resumen del registro',
  meta,
  items = [],
  onClose,
  onEdit,
  editLabel = 'Editar',
  sizeClass = 'crudx-cliente-ficha-modal',
}) {
  return (
    <CrudModalShell
      title={title}
      eyebrow={eyebrow}
      meta={meta}
      onClose={onClose}
      className={sizeClass}
      footer={(
        <>
          <button type="button" onClick={onClose} className="crudx-btn-secondary">
            Cerrar
          </button>
          {onEdit ? (
            <button type="button" onClick={onEdit} className="crudx-btn-primary">
              <BtnContent icon={IconEdit}>{editLabel}</BtnContent>
            </button>
          ) : null}
        </>
      )}
    >
      <div className="crudx-client-detail-card__grid">
        {items.map((item) => (
          <div
            key={item.label}
            className={`crudx-client-detail-card__item${
              item.tone === 'ok' ? ' crudx-client-detail-card__item--ok' : ''
            }${item.tone === 'muted' ? ' crudx-client-detail-card__item--muted' : ''}${
              item.tone === 'danger' ? ' crudx-client-detail-card__item--danger' : ''
            }${item.fullWidth ? ' crudx-client-detail-card__item--full' : ''}`}
          >
            <span>{item.label}</span>
            <strong>{item.value ?? '—'}</strong>
          </div>
        ))}
      </div>
    </CrudModalShell>
  );
}

export default memo(CrudRecordDetailModal);
