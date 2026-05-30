import { memo } from 'react';

function CrudTableLoadingPanel({
  title = 'Cargando resultados…',
  hint = 'Esto puede tardar unos segundos si hay muchos registros.',
  columnCount = 6,
  rowCount = 7,
}) {
  const cols = Math.min(Math.max(columnCount, 3), 8);
  const rows = Math.min(Math.max(rowCount, 4), 10);

  return (
    <div className="crudx-table-loading" role="status" aria-live="polite" aria-busy="true">
      <div className="crudx-table-loading__header">
        <span className="crudx-table-loading__spinner ops-loader" aria-hidden="true" />
        <div className="crudx-table-loading__copy">
          <strong>{title}</strong>
          <p>{hint}</p>
        </div>
      </div>
      <div className="crudx-table-loading__skeleton" aria-hidden="true">
        <div className="crudx-table-loading__skeleton-head">
          {Array.from({ length: cols }, (_, index) => (
            <span
              key={`head-${index}`}
              className="crudx-skeleton-bar crudx-skeleton-bar--head"
              style={{ width: `${48 + (index % 3) * 12}%` }}
            />
          ))}
        </div>
        {Array.from({ length: rows }, (_, rowIndex) => (
          <div key={`row-${rowIndex}`} className="crudx-table-loading__skeleton-row">
            {Array.from({ length: cols }, (_, colIndex) => (
              <span
                key={`cell-${rowIndex}-${colIndex}`}
                className="crudx-skeleton-bar"
                style={{ width: `${42 + ((rowIndex + colIndex) % 4) * 14}%` }}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export default memo(CrudTableLoadingPanel);
