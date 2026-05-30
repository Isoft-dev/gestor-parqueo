/**
 * SavedViews.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Fase 6 — Vistas guardadas (Power BI-style bookmarks).
 *
 * Permite al usuario guardar el estado actual de los filtros globales con un
 * nombre personalizado y cargarlo de nuevo con un solo clic.
 * Persistencia: localStorage (clave STORAGE_KEY).
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useReportFilter } from './ReportFilterContext.jsx';

const STORAGE_KEY = 'gestor_parqueo_saved_views';
const MAX_VIEWS   = 10;

function loadViews() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function persistViews(views) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
  } catch {}
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

export default function SavedViews() {
  const { filtros, setFiltro } = useReportFilter();

  const [views, setViews]       = useState(loadViews);
  const [saving, setSaving]     = useState(false);
  const [nombre, setNombre]     = useState('');
  const [feedback, setFeedback] = useState('');
  const [activeId, setActiveId] = useState(null);
  const inputRef      = useRef(null);
  const feedbackTimer = useRef(null);

  useEffect(() => { persistViews(views); }, [views]);

  useEffect(() => {
    if (saving && inputRef.current) inputRef.current.focus();
  }, [saving]);

  useEffect(() => {
    if (activeId) {
      const active = views.find((v) => v.id === activeId);
      if (active) {
        const same =
          active.filtros.desde        === filtros.desde &&
          active.filtros.hasta        === filtros.hasta &&
          active.filtros.tipoCliente  === filtros.tipoCliente &&
          active.filtros.tipoVehiculo === filtros.tipoVehiculo;
        if (!same) setActiveId(null);
      }
    }
  }, [filtros, activeId, views]);

  const showFeedback = useCallback((msg) => {
    setFeedback(msg);
    clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(''), 2200);
  }, []);

  const handleSaveClick = () => {
    if (views.length >= MAX_VIEWS) {
      showFeedback('Limite de ' + MAX_VIEWS + ' vistas alcanzado');
      return;
    }
    const suggested = filtros.desde && filtros.hasta
      ? filtros.desde + ' - ' + filtros.hasta
      : 'Vista ' + (views.length + 1);
    setNombre(suggested);
    setSaving(true);
  };

  const handleConfirmSave = () => {
    const trimmed = nombre.trim();
    if (!trimmed) return;
    const newView = {
      id: uid(),
      name: trimmed,
      filtros: {
        desde:        filtros.desde,
        hasta:        filtros.hasta,
        tipoCliente:  filtros.tipoCliente,
        tipoVehiculo: filtros.tipoVehiculo,
      },
      savedAt: new Date().toISOString(),
    };
    setViews((prev) => [newView, ...prev]);
    setActiveId(newView.id);
    setSaving(false);
    setNombre('');
    showFeedback('Vista guardada');
  };

  const handleCancelSave = () => {
    setSaving(false);
    setNombre('');
  };

  const handleLoad = useCallback((view) => {
    setFiltro('desde',        view.filtros.desde);
    setFiltro('hasta',        view.filtros.hasta);
    setFiltro('tipoCliente',  view.filtros.tipoCliente);
    setFiltro('tipoVehiculo', view.filtros.tipoVehiculo);
    setActiveId(view.id);
    showFeedback('Vista cargada: ' + view.name);
  }, [setFiltro, showFeedback]);

  const handleDelete = useCallback((e, id) => {
    e.stopPropagation();
    setViews((prev) => prev.filter((v) => v.id !== id));
    if (activeId === id) setActiveId(null);
  }, [activeId]);

  return (
    <div className="saved-views">
      <div className="saved-views__inner">

        <div className="saved-views__save-area">
          {!saving ? (
            <button
              type="button"
              className="saved-views__save-btn"
              onClick={handleSaveClick}
              title="Guardar filtros actuales como vista"
            >
              <span className="saved-views__save-icon" aria-hidden="true">★</span>
              Guardar vista
            </button>
          ) : (
            <div className="saved-views__form">
              <input
                ref={inputRef}
                type="text"
                className="saved-views__name-input"
                placeholder="Nombre de la vista..."
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleConfirmSave();
                  if (e.key === 'Escape') handleCancelSave();
                }}
                maxLength={40}
              />
              <button
                type="button"
                className="saved-views__form-btn saved-views__form-btn--confirm"
                onClick={handleConfirmSave}
                disabled={!nombre.trim()}
                title="Confirmar"
              >
                ✓
              </button>
              <button
                type="button"
                className="saved-views__form-btn saved-views__form-btn--cancel"
                onClick={handleCancelSave}
                title="Cancelar"
              >
                ✕
              </button>
            </div>
          )}
        </div>

        {views.length > 0 && (
          <div className="saved-views__divider" aria-hidden="true" />
        )}

        {views.length > 0 && (
          <div className="saved-views__list" role="list" aria-label="Vistas guardadas">
            {views.map((view) => (
              <button
                key={view.id}
                type="button"
                role="listitem"
                className={
                  'saved-views__chip' +
                  (activeId === view.id ? ' saved-views__chip--active' : '')
                }
                onClick={() => handleLoad(view)}
                title={
                  'Desde: ' + view.filtros.desde +
                  '  Hasta: ' + view.filtros.hasta +
                  (view.filtros.tipoCliente !== 'Todos' ? '  Cliente: ' + view.filtros.tipoCliente : '') +
                  (view.filtros.tipoVehiculo !== 'Todos' ? '  Vehiculo: ' + view.filtros.tipoVehiculo : '')
                }
              >
                <span className="saved-views__chip-star" aria-hidden="true">
                  {activeId === view.id ? '★' : '☆'}
                </span>
                <span className="saved-views__chip-name">{view.name}</span>
                <span
                  className="saved-views__chip-delete"
                  role="button"
                  aria-label={'Eliminar vista ' + view.name}
                  tabIndex={0}
                  onClick={(e) => handleDelete(e, view.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') handleDelete(e, view.id);
                  }}
                >
                  ✕
                </span>
              </button>
            ))}
          </div>
        )}

        {feedback && (
          <span className="saved-views__feedback" role="status" aria-live="polite">
            {feedback}
          </span>
        )}
      </div>
    </div>
  );
}
