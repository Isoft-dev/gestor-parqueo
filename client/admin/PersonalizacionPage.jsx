import { useAdminAppearance } from '../context/AdminAppearanceContext.jsx';

const PRESETS = [
  {
    id: 'predeterminado',
    name: 'Predeterminado',
    description: 'Mantiene el estilo institucional azul con el panel oscuro actual.',
    values: {
      mode: 'light',
      primaryColor: '#2563EB',
      secondaryColor: '#FFFFFF',
      sidebarColor: '#0F172A',
      sidebarTextColor: '#E2E8F0',
      sidebarMutedColor: '#94A3B8',
      kpiSpacesStart: '#0EA5E9',
      kpiSpacesEnd: '#2563EB',
      kpiAlertsStart: '#F59E0B',
      kpiAlertsEnd: '#EA580C',
      kpiReservedStart: '#38BDF8',
      kpiReservedEnd: '#2563EB',
      kpiMembersStart: '#10B981',
      kpiMembersEnd: '#047857',
    },
  },
  {
    id: 'bosque',
    name: 'Bosque',
    description: 'Tonos verdes y minerales para una apariencia más sobria.',
    values: {
      mode: 'light',
      primaryColor: '#0F766E',
      secondaryColor: '#ECFDF5',
      sidebarColor: '#102A1F',
      sidebarTextColor: '#E7F8EF',
      sidebarMutedColor: '#9ED8BE',
      kpiSpacesStart: '#0F766E',
      kpiSpacesEnd: '#14B8A6',
      kpiAlertsStart: '#D97706',
      kpiAlertsEnd: '#B45309',
      kpiReservedStart: '#1D4ED8',
      kpiReservedEnd: '#0F766E',
      kpiMembersStart: '#16A34A',
      kpiMembersEnd: '#166534',
    },
  },
  {
    id: 'atardecer',
    name: 'Atardecer',
    description: 'Contraste cálido para interfaces con acento naranja y coral.',
    values: {
      mode: 'light',
      primaryColor: '#EA580C',
      secondaryColor: '#FFF7ED',
      sidebarColor: '#312E81',
      sidebarTextColor: '#F5F3FF',
      sidebarMutedColor: '#C4B5FD',
      kpiSpacesStart: '#F97316',
      kpiSpacesEnd: '#EA580C',
      kpiAlertsStart: '#E11D48',
      kpiAlertsEnd: '#BE123C',
      kpiReservedStart: '#2563EB',
      kpiReservedEnd: '#4338CA',
      kpiMembersStart: '#14B8A6',
      kpiMembersEnd: '#0F766E',
    },
  },
];

const COLOR_SECTIONS = [
  {
    title: 'Base del panel',
    description: 'Ajusta el menú lateral y el color principal de interacción.',
    fields: [
      { key: 'sidebarColor', label: 'Fondo del panel lateral' },
      { key: 'sidebarTextColor', label: 'Texto principal del panel' },
      { key: 'sidebarMutedColor', label: 'Texto secundario del panel' },
      { key: 'primaryColor', label: 'Color principal de acciones' },
      { key: 'secondaryColor', label: 'Botón secundario / neutro' },
    ],
  },
  {
    title: 'Tarjetas del dashboard',
    description: 'Cada indicador usa un degradado que puedes ajustar por separado.',
    fields: [
      { key: 'kpiSpacesStart', label: 'Espacios disponibles - inicio' },
      { key: 'kpiSpacesEnd', label: 'Espacios disponibles - fin' },
      { key: 'kpiAlertsStart', label: 'Alertas pendientes - inicio' },
      { key: 'kpiAlertsEnd', label: 'Alertas pendientes - fin' },
      { key: 'kpiReservedStart', label: 'Espacios reservados - inicio' },
      { key: 'kpiReservedEnd', label: 'Espacios reservados - fin' },
      { key: 'kpiMembersStart', label: 'Membresías - inicio' },
      { key: 'kpiMembersEnd', label: 'Membresías - fin' },
    ],
  },
];

function ColorField({ id, label, value, onChange }) {
  return (
    <label className="admin-color-field" htmlFor={id}>
      <span className="admin-color-field__label">{label}</span>
      <span className="admin-color-field__control">
        <input
          id={id}
          className="admin-color-field__picker"
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="admin-color-field__value">{value}</span>
      </span>
    </label>
  );
}

export default function PersonalizacionPage() {
  const { appearance, updateAppearance, resetAppearance } = useAdminAppearance();

  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="admin-page-header__title-row">
          <h1 className="admin-page-title">Personalización</h1>
        </div>
        <p className="admin-page-desc">
          Personaliza los colores del panel administrativo y observa los cambios al instante en la
          vista previa. Los ajustes se guardan automáticamente en este navegador.
        </p>
        <p className="admin-page-footnote">
          Recomendación: usa colores con buen contraste para mantener la legibilidad en botones,
          menú lateral y tarjetas del dashboard.
        </p>
      </header>

      <div className="admin-theme-layout">
        <section className="admin-panel-block admin-theme-controls">
          <div className="admin-panel-head">
            <h2>Modo general</h2>
            <button type="button" className="admin-btn-ghost" onClick={() => resetAppearance()}>
              Restaurar valores
            </button>
          </div>

          <div className="admin-theme-mode-toggle" role="tablist" aria-label="Modo visual">
            <button
              type="button"
              className={`admin-theme-mode-btn${appearance.mode === 'light' ? ' admin-theme-mode-btn--active' : ''}`}
              onClick={() => updateAppearance({ mode: 'light' })}
            >
              Claro
            </button>
            <button
              type="button"
              className={`admin-theme-mode-btn${appearance.mode === 'dark' ? ' admin-theme-mode-btn--active' : ''}`}
              onClick={() => updateAppearance({ mode: 'dark' })}
            >
              Oscuro
            </button>
          </div>

          <div className="admin-panel-head" style={{ marginTop: '1.5rem' }}>
            <h2>Estilos rápidos</h2>
            <p className="admin-panel-sub">Puedes partir de una base y luego afinar cada color.</p>
          </div>
          <div className="admin-theme-presets">
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="admin-theme-preset"
                onClick={() => updateAppearance(preset.values)}
              >
                <span className="admin-theme-preset__title">{preset.name}</span>
                <span className="admin-theme-preset__desc">{preset.description}</span>
              </button>
            ))}
          </div>

          {COLOR_SECTIONS.map((section) => (
            <div key={section.title} className="admin-theme-section">
              <div className="admin-panel-head">
                <h2>{section.title}</h2>
                <p className="admin-panel-sub">{section.description}</p>
              </div>
              <div className="admin-color-grid">
                {section.fields.map((field) => (
                  <ColorField
                    key={field.key}
                    id={field.key}
                    label={field.label}
                    value={appearance[field.key]}
                    onChange={(value) => updateAppearance({ [field.key]: value })}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        <aside className="admin-panel-block admin-theme-preview-panel">
          <div className="admin-panel-head">
            <h2>Vista previa en vivo</h2>
            <p className="admin-panel-sub">
              Refleja el mismo sistema de colores que usa el panel real.
            </p>
          </div>

          <div className="admin-theme-preview-shell">
            <aside className="admin-theme-preview-sidebar">
              <div className="admin-theme-preview-brand">
                <div className="admin-theme-preview-brand__title">Gestor de Parqueo</div>
                <div className="admin-theme-preview-brand__sub">Panel de administración</div>
              </div>
              <nav className="admin-theme-preview-nav" aria-label="Vista previa del menú">
                <div className="admin-nav-link admin-nav-link--active">
                  <span className="admin-nav-icon" aria-hidden="true">
                    {'\u{1F4CA}'}
                  </span>
                  <span>Dashboard</span>
                </div>
                <div className="admin-nav-link">
                  <span className="admin-nav-icon" aria-hidden="true">
                    {'\u{1F465}'}
                  </span>
                  <span>Clientes mensuales</span>
                </div>
                <div className="admin-nav-link">
                  <span className="admin-nav-icon" aria-hidden="true">
                    {'\u{1F3A8}'}
                  </span>
                  <span>Personalización</span>
                </div>
              </nav>
            </aside>

            <div className="admin-theme-preview-main">
              <div className="admin-theme-preview-toolbar">
                <button type="button" className="admin-btn-primary">
                  Acción principal
                </button>
                <button type="button" className="admin-btn-ghost">
                  Acción secundaria
                </button>
              </div>

              <div className="admin-theme-preview-kpis">
                <article className="admin-kpi admin-kpi--spaces">
                  <div className="admin-kpi-label">Espacios</div>
                  <div className="admin-kpi-value">495</div>
                  <div className="admin-kpi-hint">Disponible</div>
                </article>
                <article className="admin-kpi admin-kpi--alerts">
                  <div className="admin-kpi-label">Alertas</div>
                  <div className="admin-kpi-value">29</div>
                  <div className="admin-kpi-hint">Pendientes</div>
                </article>
                <article className="admin-kpi admin-kpi--alerts2">
                  <div className="admin-kpi-label">Reservados</div>
                  <div className="admin-kpi-value">15</div>
                  <div className="admin-kpi-hint">Libres</div>
                </article>
                <article className="admin-kpi admin-kpi--members">
                  <div className="admin-kpi-label">Membresías</div>
                  <div className="admin-kpi-value">15</div>
                  <div className="admin-kpi-hint">Activas</div>
                </article>
              </div>

              <div className="admin-theme-preview-note">
                Los cambios se aplican al menú lateral, botones principales/secundarios y tarjetas
                del dashboard.
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
