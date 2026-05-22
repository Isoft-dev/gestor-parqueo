import { ADMIN_NAV_ROUTES, adminPath } from './adminNavConfig.js';

function normalizeRoleText(value) {
  return String(value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}

export function getPanelRoleKey(user) {
  const role = normalizeRoleText(user?.ROL_TIPO ?? user?.rol_tipo);
  if (!role) return null;
  if (role.includes('admin')) return 'administrador';
  if (role.includes('gerente')) return 'gerente';
  if (role.includes('guardia')) return 'guardia';
  if (role.includes('supervisor') && role.includes('camara')) return 'supervisor_camaras';
  if (role.includes('jefe') && role.includes('grupo')) return 'jefe_grupo';
  return null;
}

export function hasFullAdminAccess(user) {
  return getPanelRoleKey(user) === 'administrador';
}

const ROLE_ROUTE_ACCESS = {
  administrador: {
    defaultPath: '',
    routes: null,
  },
  gerente: {
    defaultPath: 'reportes',
    routes: {
      reportes: {},
    },
  },
  guardia: {
    defaultPath: 'bitacora-incidentes',
    routes: {
      'bitacora-incidentes': {
        entityKeys: ['bitacora-incidente-vehiculo'],
        entityAccess: {
          'bitacora-incidente-vehiculo': {
            ops: { c: true, u: false, d: false },
          },
        },
      },
    },
  },
  supervisor_camaras: {
    defaultPath: 'bitacora-incidentes',
    routes: {
      'bitacora-incidentes': {
        entityKeys: ['bitacora-incidente-vehiculo'],
        entityAccess: {
          'bitacora-incidente-vehiculo': {
            ops: { c: true, u: true, d: false },
          },
        },
      },
      alertas: {
        entityKeys: ['alerta'],
        entityAccess: {
          alerta: {
            ops: { c: false, u: true, d: false },
          },
        },
      },
    },
  },
  jefe_grupo: {
    defaultPath: 'bitacora-incidentes',
    routes: {
      'bitacora-incidentes': {
        entityKeys: ['bitacora-incidente-vehiculo'],
        entityAccess: {
          'bitacora-incidente-vehiculo': {
            ops: { c: true, u: true, d: false },
          },
        },
      },
      alertas: {
        entityKeys: ['alerta'],
        entityAccess: {
          alerta: {
            ops: { c: false, u: true, d: false },
          },
        },
      },
    },
  },
};

function getRoleAccess(user) {
  const roleKey = getPanelRoleKey(user);
  return roleKey ? ROLE_ROUTE_ACCESS[roleKey] ?? null : null;
}

function getRoleRouteOverride(user, routePath = '') {
  const roleKey = getPanelRoleKey(user);
  if (!roleKey || roleKey === 'administrador') return null;
  return ROLE_ROUTE_ACCESS[roleKey]?.routes?.[routePath] ?? null;
}

export function canAccessAdminPanel(user) {
  return !!getRoleAccess(user);
}

export function canAccessAdminRoute(user, routePath = '') {
  const access = getRoleAccess(user);
  if (!access) return false;
  if (hasFullAdminAccess(user)) return true;
  return Object.prototype.hasOwnProperty.call(access.routes || {}, routePath);
}

export function getDefaultAdminRoute(user) {
  return getRoleAccess(user)?.defaultPath ?? '';
}

export function getAdminHomePath(user) {
  return adminPath(getDefaultAdminRoute(user));
}

export function getAdminRouteDefinition(user, route) {
  if (!route || !canAccessAdminRoute(user, route.path)) return null;
  const override = getRoleRouteOverride(user, route.path);
  if (!override) return route;
  return {
    ...route,
    entityKeys: override.entityKeys ?? route.entityKeys,
    entityAccess: override.entityAccess ?? null,
  };
}

export function getAllowedAdminRoutes(user) {
  return ADMIN_NAV_ROUTES
    .map((route) => getAdminRouteDefinition(user, route))
    .filter(Boolean);
}
