import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import AdminLayout from './admin/AdminLayout.jsx';
import AdminSectionPage from './admin/AdminSectionPage.jsx';
import DashboardPage from './admin/DashboardPage.jsx';
import ReportesPage from './admin/ReportesPage.jsx';
import AdminOperationsPage from './admin/AdminOperationsPage.jsx';
import CorreosSimuladosPage from './admin/CorreosSimuladosPage.jsx';
import PersonalizacionPage from './admin/PersonalizacionPage.jsx';
import LoginPage from './admin/LoginPage.jsx';
import { ADMIN_NAV_ROUTES } from './admin/adminNavConfig.js';
import {
  canAccessAdminPanel,
  canAccessAdminRoute,
  getAdminHomePath,
  getAdminRouteDefinition,
  getDefaultAdminRoute,
} from './admin/adminRoleAccess.js';
import TicketLoaderPage from './sporadic/TicketLoaderPage.jsx';
import { useAuth } from './context/AuthContext.jsx';

function RequireAdminPanel({ children }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }
  if (!canAccessAdminPanel(user)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

function RequireAdminRoute({ routePath, children }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessAdminRoute(user, routePath)) {
    return <Navigate to={getAdminHomePath(user)} replace />;
  }
  return children;
}

function AdminHomeRoute() {
  const { user } = useAuth();
  const defaultRoute = getDefaultAdminRoute(user);
  return defaultRoute === '' ? <DashboardPage /> : <Navigate to={getAdminHomePath(user)} replace />;
}

function AdminModuleRoute({ route }) {
  const { user } = useAuth();
  const effectiveRoute = getAdminRouteDefinition(user, route);
  if (!effectiveRoute) {
    return <Navigate to={getAdminHomePath(user)} replace />;
  }
  return (
    <AdminSectionPage
      title={effectiveRoute.label}
      description={effectiveRoute.description}
      entityKeys={effectiveRoute.entityKeys}
      entityAccess={effectiveRoute.entityAccess}
      footnote={effectiveRoute.footnote}
      sectionPath={effectiveRoute.path}
    />
  );
}

export default function App() {
  const moduleRoutes = ADMIN_NAV_ROUTES.filter((r) => r.entityKeys?.length > 0);

  return (
    <Routes>
      <Route path="/" element={<TicketLoaderPage key="ops-consulta" />} />
      <Route path="/cargar-ticket" element={<TicketLoaderPage key="ops-cargar-ticket" />} />
      <Route path="/maquina-cobro" element={<TicketLoaderPage key="kiosk-cobro" cobroOnly />} />
      <Route path="/maquina-entrada" element={<TicketLoaderPage key="kiosk-entrada" entradaOnly />} />
      <Route path="/maquina-salida" element={<TicketLoaderPage key="kiosk-salida" salidaOnly />} />
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/admin"
        element={
          <RequireAdminPanel>
            <AdminLayout />
          </RequireAdminPanel>
        }
      >
        <Route index element={<AdminHomeRoute />} />
        {moduleRoutes.map((r) => (
          <Route
            key={r.path}
            path={r.path}
            element={
              <RequireAdminRoute routePath={r.path}>
                <AdminModuleRoute route={r} />
              </RequireAdminRoute>
            }
          />
        ))}
        <Route
          path="maquina-entrada"
          element={
            <RequireAdminRoute routePath="maquina-entrada">
              <TicketLoaderPage key="admin-kiosk-entrada" entradaOnly />
            </RequireAdminRoute>
          }
        />
        <Route
          path="maquina-cobro"
          element={
            <RequireAdminRoute routePath="maquina-cobro">
              <TicketLoaderPage key="admin-kiosk-cobro" cobroOnly />
            </RequireAdminRoute>
          }
        />
        <Route
          path="maquina-salida"
          element={
            <RequireAdminRoute routePath="maquina-salida">
              <TicketLoaderPage key="admin-kiosk-salida" salidaOnly />
            </RequireAdminRoute>
          }
        />
        <Route
          path="operacion-cabina"
          element={
            <RequireAdminRoute routePath="operacion-cabina">
              <AdminOperationsPage />
            </RequireAdminRoute>
          }
        />
        <Route
          path="correos-simulados"
          element={
            <RequireAdminRoute routePath="correos-simulados">
              <CorreosSimuladosPage />
            </RequireAdminRoute>
          }
        />
        <Route
          path="reportes"
          element={
            <RequireAdminRoute routePath="reportes">
              <ReportesPage />
            </RequireAdminRoute>
          }
        />
        <Route
          path="personalizacion"
          element={
            <RequireAdminRoute routePath="personalizacion">
              <PersonalizacionPage />
            </RequireAdminRoute>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/admin" replace />} />
    </Routes>
  );
}
