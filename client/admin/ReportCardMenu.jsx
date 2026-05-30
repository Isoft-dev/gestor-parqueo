import { BtnContent, IconBack } from '../components/UiIcons.jsx';

function ReportIcon({ type = 'chart' }) {
  const common = {
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: '1.7',
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  };
  const icons = {
    car: (
      <svg {...common}>
        <path d="M5 17H3a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1l3-4h8l3 4h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-2"/>
        <circle cx="7.5" cy="17" r="2.5"/>
        <circle cx="16.5" cy="17" r="2.5"/>
      </svg>
    ),
    machine: (
      <svg {...common}>
        <rect x="5" y="2" width="14" height="20" rx="2"/>
        <path d="M9 6h6M9 10h6M9 18h6"/>
        <circle cx="12" cy="14" r="1"/>
      </svg>
    ),
    money: (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2"/>
        <circle cx="12" cy="12" r="3"/>
        <path d="M7 10v4M17 10v4"/>
      </svg>
    ),
    users: (
      <svg {...common}>
        <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
      </svg>
    ),
    clock: (
      <svg {...common}>
        <circle cx="12" cy="12" r="10"/>
        <path d="M12 6v6l4 2"/>
      </svg>
    ),
    alert: (
      <svg {...common}>
        <path d="M12 9v4"/>
        <path d="M12 17h.01"/>
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>
      </svg>
    ),
    map: (
      <svg {...common}>
        <path d="M9 18l-6 3V6l6-3 6 3 6-3v15l-6 3z"/>
        <path d="M9 3v15M15 6v15"/>
      </svg>
    ),
    calendar: (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="18" rx="2"/>
        <path d="M16 2v4M8 2v4M3 10h18"/>
      </svg>
    ),
    brand: (
      <svg {...common}>
        <path d="M4 7h16l-2 10H6z"/>
        <path d="M8 7l2-3h4l2 3"/>
        <circle cx="9" cy="17" r="2"/>
        <circle cx="15" cy="17" r="2"/>
      </svg>
    ),
    chart: (
      <svg {...common}>
        <path d="M4 19V5"/>
        <path d="M4 19h16"/>
        <rect x="7" y="11" width="3" height="5" rx="1"/>
        <rect x="12" y="7" width="3" height="9" rx="1"/>
        <rect x="17" y="9" width="3" height="7" rx="1"/>
      </svg>
    ),
  };
  return icons[type] || icons.chart;
}

export function ReportCardMenu({ ariaLabel, items, onSelect }) {
  return (
    <div className="crudx-entity-carddeck reporte-carddeck" aria-label={ariaLabel}>
      {items.map((item) => (
        <article key={item.id} className={`crudx-entity-card crudx-entity-card--${item.tone || 'ocean'}`}>
          <div className="crudx-entity-card__glow" aria-hidden="true" />
          <div className="crudx-entity-card__head">
            <span className="crudx-entity-card__eyebrow">
              <span className="crudx-entity-card__badge-inline">{item.badge}</span>
              {' · '}
              {String(item.eyebrow || 'Reporte').toUpperCase()}
            </span>
            <span className="crudx-entity-card__icon" aria-hidden="true">
              <ReportIcon type={item.icon} />
            </span>
          </div>
          <div className="crudx-entity-card__title">{item.label}</div>
          <p className="crudx-entity-card__summary">{item.summary}</p>
          <div className="crudx-entity-card__traits" aria-label={`Filtros disponibles en ${item.label}`}>
            {(item.traits || ['Filtros', 'Graficas', 'PDF']).map((trait) => (
              <span key={trait} className="crudx-entity-card__trait">{trait}</span>
            ))}
          </div>
          <div className="crudx-entity-card__actions">
            <button
              type="button"
              className="crudx-entity-card__action crudx-entity-card__action--primary"
              onClick={() => onSelect(item.id)}
            >
              Abrir
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

export function ReportDetailNav({ eyebrow, title, onBack, backLabel = 'Volver', onBackHome }) {
  return (
    <div className="crudx-monthly-nav reporte-detail-nav">
      <div className="crudx-monthly-nav__text">
        <span className="crudx-monthly-nav__eyebrow">{eyebrow}</span>
        <strong>{title}</strong>
      </div>
      <div className="crudx-monthly-nav__actions">
        {onBack ? (
          <button type="button" className="crudx-btn-secondary" onClick={onBack}>
            <BtnContent icon={IconBack}>{backLabel}</BtnContent>
          </button>
        ) : null}
        {onBackHome ? (
          <button type="button" className="crudx-btn-secondary" onClick={onBackHome}>
            <BtnContent icon={IconBack}>Volver a reportes</BtnContent>
          </button>
        ) : null}
      </div>
    </div>
  );
}
