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
    icon: '📊',
    isDashboard: true,
  },
  {
    path: 'clientes-mensuales',
    label: 'Clientes mensuales y vehículos',
    description:
      'Administración de clientes mensuales o de alta administrativa, sus membresías y vehículos vinculados.',
    icon: '👤',
    entityKeys: [
      'cliente',
      'membresia',
      'detalle-pago-membresia',
      'vehiculo',
      'registro-movimiento-membresia',
    ],
  },
  {
    path: 'tickets-vehiculos',
    label: 'Clientes esporádicos, tickets y vehículos',
    description:
      'Consulta de clientes esporádicos capturados por tickets/NIT, sus vehículos, cobros y detalle en máquina.',
    icon: '🚗',
    entityKeys: [
      'estado-ticket',
      'ticket',
      'cliente',
      'vehiculo',
      'cobro',
      'detalle-maquina-ticket',
    ],
  },
  {
    path: 'usuarios',
    label: 'Gestión de usuarios',
    description: 'Usuarios del sistema y catálogo de roles.',
    icon: '🧑‍💼',
    entityKeys: ['usuario', 'rol'],
  },
  {
    path: 'maquinas',
    label: 'Gestión de máquinas',
    description: 'Máquinas de cobro, tipos, estados, saldos y mantenimientos.',
    icon: '🚧',
    entityKeys: [
      'maquina',
      'tipo-maquina',
      'detalle-maquina-ticket',
      'saldo-disponible',
      'detalle-saldo',
      'recargo-maquina',
      'registro-mantenimiento',
    ],
  },
  {
    path: 'tarifas',
    label: 'Gestión de cobro',
    description: 'Tarifas del parqueo, tipos de cobro y formas de pago.',
    icon: '💵',
    entityKeys: ['tarifa'],
  },
  {
    path: 'informativo',
    label: 'Informativo',
    description: 'Catálogos de consulta para vehículos, membresías, cobros y estados operativos.',
    icon: '📋',
    entityKeys: [
      'tipo-vehiculo',
      'marca-vehiculo',
      'modelo-vehiculo',
      'color-vehiculo',
      'tipo-membresia',
      'estado-membresia',
      'tipo-cobro',
      'estado-maquina',
      'tipo-pago',
    ],
    entityAccess: {
      'tipo-vehiculo': { ops: { c: false, u: false, d: false } },
      'marca-vehiculo': { ops: { c: false, u: false, d: false } },
      'modelo-vehiculo': { ops: { c: false, u: false, d: false } },
      'color-vehiculo': { ops: { c: false, u: false, d: false } },
      'tipo-membresia': { ops: { c: false, u: false, d: false } },
      'estado-membresia': { ops: { c: false, u: false, d: false } },
      'tipo-cobro': { ops: { c: false, u: false, d: false } },
      'estado-maquina': { ops: { c: false, u: false, d: false } },
      'tipo-pago': { ops: { c: false, u: false, d: false } },
    },
  },
  {
    path: 'bitacora-incidentes',
    label: 'Bitácora de incidentes',
    description: 'Registro y seguimiento vinculado a vehículos e incidentes.',
    icon: '📓',
    entityKeys: ['bitacora-incidente-vehiculo', 'incidente'],
  },
  {
    path: 'alertas',
    label: 'Alertas',
    description: 'Tipos, estados y registro de alertas operativas.',
    icon: '⚠️',
    entityKeys: ['tipo-alerta', 'estado-alerta', 'alerta'],
  },
  {
    path: 'operacion-cabina',
    label: 'Operación cabina',
    description: 'Escaneo PDF de tickets y tags para entrada, cobro y salida.',
    icon: '🖨️',
  },
  {
    path: 'correos-simulados',
    label: 'Correos simulados',
    description:
      'Bandeja de notificaciones de membresías que el sistema "envió" (modo simulate o SMTP).',
    icon: '✉️',
  },
  {
    path: 'reportes',
    label: 'Reportes',
    description:
      'Incidentes, membresías por estado, clientes en mora (vista actual) y PDF.',
    icon: '📘',
  },
  {
    path: 'personalizacion',
    label: 'Personalización',
    description: 'Colores del panel, botones y tarjetas con vista previa inmediata.',
    icon: '🎨',
  },
];

export function adminPath(routePath) {
  return routePath === '' ? '/admin' : `/admin/${routePath}`;
}
