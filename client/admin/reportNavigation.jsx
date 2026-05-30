import { useEffect, useRef } from 'react';

export const REPORT_FLOW_STEPS = [
  { id: 'dates', label: 'Fechas' },
  { id: 'type', label: 'Tipo' },
  { id: 'generate', label: 'Generar' },
  { id: 'results', label: 'Resultados' },
];

const TONE_ACCENT = {
  ocean: '#2563eb',
  mint: '#059669',
  sunset: '#d97706',
  steel: '#475569',
};

export function useReportGenerateScroll(activeKey) {
  const generateRef = useRef(null);
  useEffect(() => {
    if (!activeKey) return;
    const timer = window.setTimeout(() => {
      generateRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [activeKey]);
  return generateRef;
}

export function ReportFlowBar({ steps, activeStep = 1 }) {
  return (
    <nav className="reporte-flow-bar" aria-label="Pasos del reporte">
      {steps.map((step, index) => {
        const n = index + 1;
        const state = n < activeStep ? 'done' : n === activeStep ? 'current' : 'pending';
        return (
          <div key={step.id || step.label} className={`reporte-flow-bar__item reporte-flow-bar__item--${state}`}>
            <span className="reporte-flow-bar__dot" aria-hidden="true">
              {n}
            </span>
            <span className="reporte-flow-bar__label">{step.label}</span>
          </div>
        );
      })}
    </nav>
  );
}

export function ReportSubreportTabs({ ariaLabel, items, activeId, onSelect }) {
  return (
    <div className="reporte-subreport-tabs-wrap">
      <div className="reporte-subreport-tabs__label">Tipo de reporte</div>
      <div className="reporte-subreport-tabs" role="tablist" aria-label={ariaLabel}>
        {items.map((item) => {
          const isActive = item.id === activeId;
          const accent = TONE_ACCENT[item.tone] || TONE_ACCENT.ocean;
          return (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              className={`reporte-subreport-tab${isActive ? ' reporte-subreport-tab--active' : ''}`}
              style={{ '--report-tab-accent': accent }}
              onClick={() => onSelect(item.id)}
            >
              <span className="reporte-subreport-tab__badge">{item.badge}</span>
              <span className="reporte-subreport-tab__text">{item.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function ReportGeneratePanel({ panelRef, title, tone = 'ocean', children }) {
  const accent = TONE_ACCENT[tone] || TONE_ACCENT.ocean;
  return (
    <section
      ref={panelRef}
      className="reporte-generate-panel reporte-inc-card"
      style={{ '--report-panel-accent': accent }}
      aria-label="Generar reporte"
    >
      <div className="reporte-generate-panel__head">
        <span className="reporte-generate-panel__step">Generar</span>
        <h2 className="reporte-generate-panel__title">{title}</h2>
      </div>
      {children}
    </section>
  );
}

export function ReportResultsSection({ visible, render, children }) {
  if (!visible) {
    return (
      <div className="reporte-results-placeholder" aria-hidden="true">
        <p>Los gráficos y tablas aparecerán aquí después de pulsar <strong>Generar reporte</strong>.</p>
      </div>
    );
  }
  const content = typeof render === 'function' ? render() : children;
  return <div className="reporte-results-section">{content}</div>;
}

export function ReportWorkspace({ children, scrollOnMount = true }) {
  const workspaceRef = useRef(null);
  useEffect(() => {
    if (!scrollOnMount) return undefined;
    const timer = window.setTimeout(() => {
      workspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 80);
    return () => window.clearTimeout(timer);
  }, [scrollOnMount]);
  return (
    <div ref={workspaceRef} className="reporte-workspace">
      {children}
    </div>
  );
}
