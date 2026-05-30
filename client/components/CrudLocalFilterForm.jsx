import { memo, useEffect, useState } from 'react';
import { BtnContent, IconClear, IconSearch } from './UiIcons.jsx';

/**
 * Formulario de filtros con borrador local: teclear o cambiar selects no re-renderiza CrudDemo.
 * Se sincroniza con la URL cuando cambia syncKey (p. ej. tras Buscar / Limpiar).
 */
function CrudLocalFilterForm({
  syncKey,
  initialValues,
  clearValues,
  onApply,
  onClear,
  loading = false,
  className = 'admin-search-form crudx-ticket-search-form',
  children,
}) {
  const [draft, setDraft] = useState(initialValues);

  useEffect(() => {
    setDraft(initialValues);
  }, [syncKey]); // eslint-disable-line react-hooks/exhaustive-deps -- initialValues derivan de syncKey (URL)

  const setField = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <form
      className={className}
      onSubmit={(e) => {
        e.preventDefault();
        onApply(draft);
      }}
    >
      {children({ draft, setField, setDraft })}
      <div className="admin-search-actions">
        <button type="submit" className="admin-btn-search" disabled={loading}>
          <BtnContent icon={IconSearch}>Buscar</BtnContent>
        </button>
        <button
          type="button"
          className="admin-btn-search-clear"
          onClick={() => {
            setDraft(clearValues ?? initialValues);
            onClear();
          }}
          disabled={loading}
        >
          <BtnContent icon={IconClear}>Limpiar</BtnContent>
        </button>
      </div>
    </form>
  );
}

export default memo(CrudLocalFilterForm);
