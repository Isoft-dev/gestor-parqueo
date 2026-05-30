import { hasFullAdminAccess } from './adminRoleAccess.js';
import CrudDemo from '../components/CrudDemo.jsx';
import CobroMinimoSub1hToggle from './CobroMinimoSub1hToggle.jsx';
import HelpHint from '../components/HelpHint.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AdminSectionPage({
  title,
  description,
  entityKeys,
  entityAccess,
  footnote,
  sectionPath,
}) {
  const { user } = useAuth();
  const sessionUserId = user?.USU_ID ?? null;
  const sessionIsFullAdmin = hasFullAdminAccess(user);
  return (
    <div className="admin-page">
      <header className="admin-page-header">
        <div className="admin-page-header__title-row">
          <div className="admin-page-header__title-main">
            <h1 className="admin-page-title">{title}</h1>
            {description ? (
              <HelpHint label={`Mostrar ayuda sobre ${title}`} title={`Guia de ${title}`}>
                <p>{description}</p>
              </HelpHint>
            ) : null}
          </div>

        </div>
        {footnote ? <p className="admin-page-footnote">{footnote}</p> : null}
      </header>
      {sectionPath === 'tarifas' ? (
        <div className="tarifa-card-wrap">
          <CobroMinimoSub1hToggle />
        </div>
      ) : null}
      <div className="admin-crud-embed">
        <CrudDemo
          key={sectionPath}
          filterEntityKeys={entityKeys}
          entityAccessMap={entityAccess}
          sessionUserId={sessionUserId}
          sessionIsFullAdmin={sessionIsFullAdmin}
          sectionPath={sectionPath}
        />
      </div>
    </div>
  );
}
