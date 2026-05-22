import HelpHint from '../components/HelpHint.jsx';
import TicketLoaderPage from '../sporadic/TicketLoaderPage.jsx';
import LostTicketPanel from './LostTicketPanel.jsx';

export default function AdminOperationsPage() {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="admin-page-header__title-main">
          <h1 className="admin-page-title">Operacion de Cabina</h1>
          <HelpHint label="Mostrar ayuda de operacion de cabina" title="Guia de operacion de cabina">
            <p>Usa este modulo para escanear PDF, cobrar tickets y validar la salida de vehiculos.</p>
            <p>
              Aqui tambien quedan los apoyos operativos para casos manuales, como tickets
              extraviados o cobros que ya no pasan por el flujo normal de maquina.
            </p>
          </HelpHint>
        </div>
      </header>
      <LostTicketPanel />
      <div className="admin-panel-block">
        <TicketLoaderPage embeddedInAdmin />
      </div>
    </div>
  );
}
