import TicketLoaderPage from '../sporadic/TicketLoaderPage.jsx';

export default function AdminOperationsPage() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">Operación de Cabina</h1>
        <p className="admin-page-desc">
          Flujos operativos para escaneo de PDF (ticket y tag), cobro y validación de salida.
        </p>
      </header>
      <div className="admin-panel-block">
        <TicketLoaderPage embeddedInAdmin />
      </div>
    </div>
  );
}
