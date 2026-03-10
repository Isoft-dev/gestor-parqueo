import PropTypes from 'prop-types';

export default function Header({ tema, onToggleTema }) {
  return (
    <header className="header">
      <div className="header-top">
        <div className="header-brand">
          <h1 className="page-title">Gestor de Parqueo</h1>
        </div>
        <button
          type="button"
          className="btn btn-icon"
          onClick={onToggleTema}
          title={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
          aria-label={tema === 'dark' ? 'Modo claro' : 'Modo oscuro'}
        >
          {tema === 'dark' ? '☀️' : '🌙'}
        </button>
      </div>
      <p className="page-desc">
        Administra los espacios de parqueo de forma rápida y sencilla.
      </p>
    </header>
  );
}

Header.propTypes = {
  tema: PropTypes.string.isRequired,
  onToggleTema: PropTypes.func.isRequired,
};
