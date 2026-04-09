import CrudDemo from '../components/CrudDemo.jsx';
import MonthlyPaymentsPanel from './MonthlyPaymentsPanel.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminSectionPage({
  title,
  description,
  entityKeys,
  footnote,
  sectionPath,
}) {
  const { user } = useAuth();
  const sessionUserId = user?.USU_ID ?? null;
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <h1 className="admin-page-title">{title}</h1>
        <p className="admin-page-desc">{description}</p>
        {footnote ? <p className="admin-page-footnote">{footnote}</p> : null}
      </header>
      {sectionPath === 'clientes-mensuales' ? <MonthlyPaymentsPanel /> : null}
      <div className="admin-crud-embed">
        <CrudDemo
          key={sectionPath}
          filterEntityKeys={entityKeys}
          sessionUserId={sessionUserId}
          sectionPath={sectionPath}
        />
      </div>
    </div>
  );
}
