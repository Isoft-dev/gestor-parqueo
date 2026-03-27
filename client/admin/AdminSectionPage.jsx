import CrudDemo from '../components/CrudDemo.jsx';
import MonthlyPaymentsPanel from './MonthlyPaymentsPanel.jsx';

export default function AdminSectionPage({
  title,
  description,
  entityKeys,
  footnote,
  sectionPath,
}) {
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">{title}</h1>
        <p className="admin-page-desc">{description}</p>
        {footnote ? <p className="admin-page-footnote">{footnote}</p> : null}
      </header>
      {sectionPath === 'clientes-mensuales' ? <MonthlyPaymentsPanel /> : null}
      <div className="admin-crud-embed">
        <CrudDemo filterEntityKeys={entityKeys} />
      </div>
    </div>
  );
}
