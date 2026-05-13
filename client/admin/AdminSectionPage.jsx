import CrudDemo from '../components/CrudDemo.jsx';
import CobroMinimoSub1hToggle from './CobroMinimoSub1hToggle.jsx';
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
        <div className="admin-page-header__title-row">
          <h1 className="admin-page-title">{title}</h1>
          {sectionPath === 'tarifas' ? (
            <div className="admin-page-header__title-aside">
              <CobroMinimoSub1hToggle />
            </div>
          ) : null}
        </div>
        <p className="admin-page-desc">{description}</p>
        {footnote ? <p className="admin-page-footnote">{footnote}</p> : null}
      </header>
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
