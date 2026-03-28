export default function ReportesPlaceholder() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Reportes</h1>
        <p className="admin-page-desc">
          Este apartado está reservado para reportes consolidados, exportaciones y cuadros de mando
          (programado para un sprint posterior).
        </p>
      </header>
      <div className="admin-placeholder-card">
        <p>
          Aquí podrás generar informes de ocupación, ingresos, membresías y alertas históricas sin
          salir del panel.
        </p>
        <ul className="admin-placeholder-list">
          <li>Exportación a hoja de cálculo / PDF</li>
          <li>Filtros por rango de fechas y por sede</li>
          <li>Indicadores para toma de decisiones</li>
        </ul>
      </div>
    </div>
  );
}
