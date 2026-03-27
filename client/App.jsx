import { Navigate, Route, Routes } from 'react-router-dom';
import AdminLayout from './admin/AdminLayout.jsx';
import AdminSectionPage from './admin/AdminSectionPage.jsx';
import DashboardPage from './admin/DashboardPage.jsx';
import ReportesPlaceholder from './admin/ReportesPlaceholder.jsx';
import { ADMIN_NAV_ROUTES } from './admin/adminNavConfig.js';
import TicketLoaderPage from './sporadic/TicketLoaderPage.jsx';

export default function App() {
  const moduleRoutes = ADMIN_NAV_ROUTES.filter((r) => r.entityKeys?.length > 0);

  return (
    <Routes>
      <Route path="/" element={<TicketLoaderPage />} />
      <Route path="/cargar-ticket" element={<TicketLoaderPage />} />
      <Route path="/admin" element={<AdminLayout />}>
        <Route index element={<DashboardPage />} />
        {moduleRoutes.map((r) => (
          <Route
            key={r.path}
            path={r.path}
            element={
              <AdminSectionPage
                title={r.label}
                description={r.description}
                entityKeys={r.entityKeys}
                footnote={r.footnote}
                sectionPath={r.path}
              />
            }
          />
        ))}
        <Route path="reportes" element={<ReportesPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
