import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AdminLayout from './admin/AdminLayout.jsx';
import AdminSectionPage from './admin/AdminSectionPage.jsx';
import DashboardPage from './admin/DashboardPage.jsx';
import ReportesPlaceholder from './admin/ReportesPlaceholder.jsx';
import AdminOperationsPage from './admin/AdminOperationsPage.jsx';
import LoginPage from './admin/LoginPage.jsx';
import { ADMIN_NAV_ROUTES } from './admin/adminNavConfig.js';
import TicketLoaderPage from './sporadic/TicketLoaderPage.jsx';
import { useAuth, isAdminPanelUser } from './context/AuthContext.jsx';

function RequireAdmin({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!isAdminPanelUser(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  const moduleRoutes = ADMIN_NAV_ROUTES.filter((r) => r.entityKeys?.length > 0);

  return (
    <Routes>
      <Route path="/" element={<TicketLoaderPage />} />
      <Route path="/cargar-ticket" element={<TicketLoaderPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
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
        <Route path="operacion-cabina" element={<AdminOperationsPage />} />
        <Route path="reportes" element={<ReportesPlaceholder />} />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
