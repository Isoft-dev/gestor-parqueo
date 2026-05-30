export function ReportChartCard({
  title,
  description,
  actions = null,
  insights = [],
  children,
}) {
  return (
    <section className="reporte-chart-card">
      <div className="reporte-chart-card__header">
        <div>
          <h3 className="reporte-inc-subtitle" style={{ marginBottom: description ? '0.3rem' : 0 }}>
            {title}
          </h3>
          {description ? <p className="reporte-chart-card__description">{description}</p> : null}
        </div>
        {actions ? <div className="reporte-chart-card__actions">{actions}</div> : null}
      </div>
      {insights.length ? (
        <div className="reporte-chart-card__insights">
          {insights.map((item) => (
            <article key={`${item.label}-${item.value}`} className="reporte-chart-insight">
              <span className="reporte-chart-insight__label">{item.label}</span>
              <strong className="reporte-chart-insight__value">{item.value}</strong>
            </article>
          ))}
        </div>
      ) : null}
      <div className="reporte-chart-card__body">{children}</div>
    </section>
  );
}

export function ReportLegend({ items = [] }) {
  return (
    <div className="reporte-chart-legend">
      {items.map((item) => (
        <div key={`${item.label}-${item.value}`} className="reporte-chart-legend__item">
          <span
            className="reporte-chart-legend__dot"
            style={{ background: item.color }}
            aria-hidden="true"
          />
          <span className="reporte-chart-legend__label">{item.label}</span>
          <strong className="reporte-chart-legend__value">{item.value}</strong>
        </div>
      ))}
    </div>
  );
}
