/**
 * Rutas del panel administrativo (relativas a `/admin`).
 * `entityKeys` alimenta CrudDemo en modo filtrado.
 */
export const ADMIN_NAV_ROUTES = [
  {
    path: '',
    label: 'Dashboard',
    shortLabel: 'Resumen',
    description: 'Indicadores en tiempo real y accesos rápidos.',
    icon: '◆',
    isDashboard: true,
  },
  {
    path: 'clientes-mensuales',
    label: 'Clientes mensuales',
    description:
      'Administración de clientes, membresías y vehículos vinculados a planes mensuales.',
    icon: '◎',
    entityKeys: [
      'cliente',
      'membresia',
      'vehiculo',
      'tipo-membresia',
      'estado-membresia',
      'registro-movimiento-membresia',
    ],
  },
  {
    path: 'tickets-vehiculos',
    label: 'Tickets y vehículos',
    description:
      'Consulta de tickets y vehículos de clientes esporádicos, cobros y detalle en máquina.',
    icon: '▣',
    entityKeys: [
      'estado-ticket',
      'ticket',
      'vehiculo',
      'cobro',
      'tipo-cobro',
      'detalle-maquina-ticket',
    ],
    footnote:
      'Procedimientos operativos de ticket extraviado y pago tardío se implementarán como flujos guiados en este mismo módulo (Sprint 3).',
  },
  {
    path: 'usuarios',
    label: 'Gestión de usuarios',
    description: 'Usuarios del sistema y catálogo de roles.',
    icon: '◉',
    entityKeys: ['usuario', 'rol'],
  },
  {
    path: 'maquinas',
    label: 'Gestión de máquinas',
    description: 'Máquinas de cobro, tipos, estados, saldos y mantenimientos.',
    icon: '⬡',
    entityKeys: [
      'maquina',
      'tipo-maquina',
      'estado-maquina',
      'saldo-disponible',
      'detalle-saldo',
      'recargo-maquina',
      'registro-mantenimiento',
    ],
  },
  {
    path: 'tarifas',
    label: 'Gestión de tarifas',
    description: 'Tarifas del parqueo, tipos de cobro y formas de pago.',
    icon: '₲',
    entityKeys: ['tarifa', 'tipo-cobro', 'tipo-pago'],
  },
  {
    path: 'bitacora-incidentes',
    label: 'Bitácora de incidentes',
    description: 'Registro y seguimiento vinculado a vehículos e incidentes.',
    icon: '⚑',
    entityKeys: ['bitacora-incidente-vehiculo', 'incidente'],
  },
  {
    path: 'alertas',
    label: 'Alertas',
    description: 'Tipos, estados y registro de alertas operativas.',
    icon: '⚠',
    entityKeys: ['tipo-alerta', 'estado-alerta', 'alerta'],
  },
  {
    path: 'reportes',
    label: 'Reportes',
    description: 'Consolidados y exportaciones (programado para sprint posterior).',
    icon: '▤',
    isPlaceholder: true,
  },
];

export function adminPath(routePath) {
  return routePath === '' ? '/admin' : `/admin/${routePath}`;
}
