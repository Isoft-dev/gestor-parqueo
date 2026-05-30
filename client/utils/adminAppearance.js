import { DEFAULT_THEME, THEME_KEY, ADMIN_APPEARANCE_KEY } from '../config.js';

export const DEFAULT_MODULE_COLORS = {
  'clientes-mensuales': '#2563EB',
  'tickets-vehiculos': '#059669',
  usuarios: '#7C3AED',
  maquinas: '#0D9488',
  tarifas: '#D97706',
  informativo: '#64748B',
  'bitacora-incidentes': '#DC2626',
  alertas: '#EA580C',
  'operacion-cabina': '#0891B2',
  'correos-simulados': '#4F46E5',
  reportes: '#1D4ED8',
};

export const DEFAULT_ADMIN_APPEARANCE = {
  mode: DEFAULT_THEME,
  primaryColor: '#2563EB',
  secondaryColor: '#FFFFFF',
  sidebarColor: '#0F172A',
  sidebarTextColor: '#E2E8F0',
  sidebarMutedColor: '#94A3B8',
  kpiSpacesStart: '#0EA5E9',
  kpiSpacesEnd: '#2563EB',
  kpiAlertsStart: '#F59E0B',
  kpiAlertsEnd: '#EA580C',
  kpiReservedStart: '#38BDF8',
  kpiReservedEnd: '#2563EB',
  kpiMembersStart: '#10B981',
  kpiMembersEnd: '#047857',
  machineStatusSuccess: '#22C55E',
  machineStatusCaution: '#F97316',
  machineStatusDanger: '#EF4444',
  machineStatusNeutral: '#94A3B8',
  machineEntryAccent: '#2563EB',
  machineCashAccent: '#059669',
  machineExitAccent: '#DC2626',
  moduleColors: { ...DEFAULT_MODULE_COLORS },
};

const COLOR_KEYS = [
  'primaryColor',
  'secondaryColor',
  'sidebarColor',
  'sidebarTextColor',
  'sidebarMutedColor',
  'kpiSpacesStart',
  'kpiSpacesEnd',
  'kpiAlertsStart',
  'kpiAlertsEnd',
  'kpiReservedStart',
  'kpiReservedEnd',
  'kpiMembersStart',
  'kpiMembersEnd',
  'machineStatusSuccess',
  'machineStatusCaution',
  'machineStatusDanger',
  'machineStatusNeutral',
  'machineEntryAccent',
  'machineCashAccent',
  'machineExitAccent',
];

const STATUS_TONE_KEYS = ['success', 'caution', 'danger', 'neutral'];
const STATUS_COLOR_MAP = {
  success: 'machineStatusSuccess',
  caution: 'machineStatusCaution',
  danger: 'machineStatusDanger',
  neutral: 'machineStatusNeutral',
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function expandHex(hex) {
  if (hex.length !== 4) return hex;
  return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
}

export function normalizeHexColor(value, fallback) {
  const candidate = String(value ?? '').trim();
  if (!/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(candidate)) {
    return fallback.toUpperCase();
  }
  return expandHex(candidate).toUpperCase();
}

function hexToRgb(hex) {
  const normalized = normalizeHexColor(hex, '#000000');
  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((value) => clamp(Math.round(value), 0, 255).toString(16).padStart(2, '0'))
    .join('')}`.toUpperCase();
}

export function mixHexColors(base, target, weight = 0.5) {
  const start = hexToRgb(base);
  const end = hexToRgb(target);
  const ratio = clamp(weight, 0, 1);
  return rgbToHex({
    r: start.r + (end.r - start.r) * ratio,
    g: start.g + (end.g - start.g) * ratio,
    b: start.b + (end.b - start.b) * ratio,
  });
}

export function shiftHexColor(hex, amount = 0) {
  const target = amount >= 0 ? '#FFFFFF' : '#000000';
  return mixHexColors(hex, target, Math.abs(amount));
}

export function getContrastColor(hex) {
  const { r, g, b } = hexToRgb(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.63 ? '#0F172A' : '#FFFFFF';
}

export function toAlpha(hex, alpha) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${clamp(alpha, 0, 1)})`;
}

function buildMachineStatusToneVars(tone, hex, mode) {
  const color = normalizeHexColor(hex, DEFAULT_ADMIN_APPEARANCE[STATUS_COLOR_MAP[tone]]);
  if (mode === 'dark') {
    return {
      [`--machine-status-${tone}`]: color,
      [`--machine-status-${tone}-bg`]: toAlpha(color, 0.22),
      [`--machine-status-${tone}-border`]: toAlpha(color, 0.48),
      [`--machine-status-${tone}-text`]: mixHexColors(color, '#FFFFFF', 0.28),
    };
  }
  return {
    [`--machine-status-${tone}`]: color,
    [`--machine-status-${tone}-bg`]: mixHexColors(color, '#FFFFFF', 0.82),
    [`--machine-status-${tone}-border`]: mixHexColors(color, '#FFFFFF', 0.52),
    [`--machine-status-${tone}-text`]: mixHexColors(color, '#000000', 0.42),
  };
}

function buildMachineTypeVars(type, hex, mode, panelSurface, panelSurfaceAlt) {
  const accent = normalizeHexColor(hex, DEFAULT_ADMIN_APPEARANCE[`machine${type.charAt(0).toUpperCase()}${type.slice(1)}Accent`] || '#2563EB');
  const soft = toAlpha(accent, mode === 'dark' ? 0.18 : 0.14);
  const border = toAlpha(accent, mode === 'dark' ? 0.38 : 0.24);
  const titleText = mode === 'dark' ? mixHexColors(accent, '#FFFFFF', 0.22) : mixHexColors(accent, '#000000', 0.28);
  const titleBg = toAlpha(accent, mode === 'dark' ? 0.2 : 0.12);
  const rowBg = mode === 'dark'
    ? `linear-gradient(135deg, ${toAlpha(accent, 0.14)} 0%, transparent 42%), linear-gradient(135deg, ${panelSurface} 0%, ${panelSurfaceAlt} 100%)`
    : `linear-gradient(135deg, ${toAlpha(accent, 0.08)} 0%, transparent 42%), linear-gradient(135deg, ${mixHexColors(panelSurface, '#FFFFFF', 0.04)} 0%, ${mixHexColors(accent, '#FFFFFF', 0.92)} 100%)`;

  return {
    [`--machine-${type}-accent`]: accent,
    [`--machine-${type}-accent-soft`]: soft,
    [`--machine-row-${type}-border`]: border,
    [`--machine-row-${type}-bg`]: rowBg,
    [`--machine-row-${type}-title-text`]: titleText,
    [`--machine-row-${type}-title-bg`]: titleBg,
  };
}

export function getModuleAccentColor(appearance, path, fallback) {
  const stored = appearance?.moduleColors?.[path];
  const base = stored || fallback || appearance?.primaryColor || DEFAULT_ADMIN_APPEARANCE.primaryColor;
  return normalizeHexColor(base, DEFAULT_ADMIN_APPEARANCE.primaryColor);
}

export function getModuleAccentStyle(appearance, path, fallback) {
  const accent = getModuleAccentColor(appearance, path, fallback);
  return {
    '--module-accent': accent,
    '--module-accent-soft': toAlpha(accent, appearance?.mode === 'dark' ? 0.16 : 0.1),
    '--module-accent-shadow': toAlpha(accent, 0.22),
  };
}

function sanitizeModuleColors(value) {
  const merged = { ...DEFAULT_MODULE_COLORS };
  const input = value?.moduleColors && typeof value.moduleColors === 'object' ? value.moduleColors : value;
  if (input && typeof input === 'object') {
    for (const [path, color] of Object.entries(input)) {
      if (path in DEFAULT_MODULE_COLORS || path.startsWith('module-')) {
        merged[path.replace(/^module-/, '')] = normalizeHexColor(color, merged[path] || DEFAULT_ADMIN_APPEARANCE.primaryColor);
      } else if (path in merged) {
        merged[path] = normalizeHexColor(color, merged[path]);
      }
    }
  }
  return merged;
}

export function sanitizeAdminAppearance(value) {
  let storedTheme = DEFAULT_THEME;
  try {
    storedTheme = localStorage.getItem(THEME_KEY) || DEFAULT_THEME;
  } catch {
    storedTheme = DEFAULT_THEME;
  }

  const themeMode =
    value?.mode === 'dark' || value?.mode === 'light'
      ? value.mode
      : storedTheme;

  const appearance = {
    ...DEFAULT_ADMIN_APPEARANCE,
    mode: themeMode,
    moduleColors: sanitizeModuleColors(value),
  };

  for (const key of COLOR_KEYS) {
    appearance[key] = normalizeHexColor(value?.[key], DEFAULT_ADMIN_APPEARANCE[key]);
  }

  return appearance;
}

export function loadAdminAppearance() {
  try {
    const raw = localStorage.getItem(ADMIN_APPEARANCE_KEY);
    if (!raw) {
      return sanitizeAdminAppearance({});
    }
    return sanitizeAdminAppearance(JSON.parse(raw));
  } catch {
    return sanitizeAdminAppearance({});
  }
}

export function buildAdminAppearanceVars(appearance) {
  const sidebarColor = normalizeHexColor(appearance.sidebarColor, DEFAULT_ADMIN_APPEARANCE.sidebarColor);
  const sidebarTextColor = normalizeHexColor(
    appearance.sidebarTextColor,
    DEFAULT_ADMIN_APPEARANCE.sidebarTextColor,
  );
  const sidebarMutedColor = normalizeHexColor(
    appearance.sidebarMutedColor,
    DEFAULT_ADMIN_APPEARANCE.sidebarMutedColor,
  );
  const primaryColor = normalizeHexColor(
    appearance.primaryColor,
    DEFAULT_ADMIN_APPEARANCE.primaryColor,
  );
  const secondaryColor = normalizeHexColor(
    appearance.secondaryColor,
    DEFAULT_ADMIN_APPEARANCE.secondaryColor,
  );
  const mode = appearance.mode;

  const primaryStrong = shiftHexColor(primaryColor, -0.22);
  const secondaryBorderBase = mode === 'dark' ? '#CBD5E1' : '#64748B';
  const panelSurface = mode === 'dark'
    ? mixHexColors(sidebarColor, '#111827', 0.4)
    : mixHexColors(secondaryColor, '#FFFFFF', 0.9);
  const panelSurfaceAlt = mode === 'dark'
    ? mixHexColors(panelSurface, '#000000', 0.12)
    : mixHexColors(panelSurface, '#0F172A', 0.04);
  const panelText = getContrastColor(panelSurface);
  const panelMuted = mode === 'dark'
    ? mixHexColors(panelText, panelSurface, 0.34)
    : mixHexColors(panelText, panelSurface, 0.48);
  const tableBg = mode === 'dark'
    ? mixHexColors(panelSurface, '#0B1120', 0.18)
    : mixHexColors(panelSurface, '#FFFFFF', 0.94);
  const tableText = getContrastColor(tableBg);
  const tableMuted = mode === 'dark'
    ? mixHexColors(tableText, tableBg, 0.34)
    : mixHexColors(tableText, tableBg, 0.44);
  const tableBorder = mode === 'dark'
    ? toAlpha(tableText, 0.12)
    : mixHexColors(tableBg, '#94A3B8', 0.35);
  const tableHeadBg = mode === 'dark'
    ? mixHexColors(tableBg, primaryColor, 0.26)
    : mixHexColors(tableBg, primaryColor, 0.12);
  const tableHeadText = mode === 'dark'
    ? '#EAF2FF'
    : mixHexColors(tableText, primaryColor, 0.28);
  const tableHeadBorder = mode === 'dark'
    ? toAlpha(tableHeadText, 0.12)
    : mixHexColors(tableHeadBg, '#94A3B8', 0.28);
  const chipBg = mode === 'dark'
    ? mixHexColors(tableBg, '#0F172A', 0.28)
    : mixHexColors(tableBg, '#F8FAFC', 0.92);
  const chipText = mode === 'dark'
    ? '#D8E5F6'
    : mixHexColors(tableText, '#334155', 0.38);
  const chipBorder = mode === 'dark'
    ? toAlpha(chipText, 0.16)
    : mixHexColors(chipBg, '#94A3B8', 0.34);

  const primaryHoverStart = mode === 'dark'
    ? mixHexColors(primaryColor, '#FFFFFF', 0.16)
    : mixHexColors(primaryColor, '#000000', 0.1);
  const primaryHoverEnd = mode === 'dark'
    ? mixHexColors(primaryStrong, '#FFFFFF', 0.12)
    : mixHexColors(primaryStrong, '#000000', 0.16);
  const ghostHoverBg = mode === 'dark'
    ? mixHexColors(panelSurfaceAlt, primaryColor, 0.32)
    : mixHexColors(secondaryColor, primaryColor, 0.1);
  const ghostHoverText = getContrastColor(ghostHoverBg);
  const tarifaAccent = getModuleAccentColor(appearance, 'tarifas', DEFAULT_MODULE_COLORS.tarifas);
  const kioskBgTop = mode === 'dark'
    ? mixHexColors(sidebarColor, '#111827', 0.52)
    : '#E5E7EB';
  const kioskBgBottom = mode === 'dark'
    ? mixHexColors(panelSurface, '#000000', 0.28)
    : '#D1D5DB';
  const mainBg = mode === 'dark'
    ? mixHexColors(sidebarColor, '#080C14', 0.38)
    : mixHexColors(secondaryColor, '#F1F5F9', 0.55);

  const statusVars = STATUS_TONE_KEYS.reduce(
    (acc, tone) => ({
      ...acc,
      ...buildMachineStatusToneVars(tone, appearance[STATUS_COLOR_MAP[tone]], mode),
    }),
    {},
  );

  const machineTypeVars = {
    ...buildMachineTypeVars('entry', appearance.machineEntryAccent, mode, panelSurface, panelSurfaceAlt),
    ...buildMachineTypeVars('cash', appearance.machineCashAccent, mode, panelSurface, panelSurfaceAlt),
    ...buildMachineTypeVars('exit', appearance.machineExitAccent, mode, panelSurface, panelSurfaceAlt),
  };

  return {
    '--admin-sidebar-bg': sidebarColor,
    '--admin-sidebar-border': toAlpha(sidebarTextColor, 0.12),
    '--admin-sidebar-text': sidebarTextColor,
    '--admin-sidebar-muted': sidebarMutedColor,
    '--admin-sidebar-hover': toAlpha(sidebarTextColor, 0.09),
    '--admin-sidebar-active-bg': toAlpha(primaryColor, mode === 'dark' ? 0.3 : 0.18),
    '--admin-sidebar-active-border': toAlpha(primaryColor, 0.42),
    '--admin-sidebar-active-text': sidebarTextColor,
    '--admin-accent': primaryColor,
    '--admin-accent-strong': primaryStrong,
    '--admin-accent-soft': toAlpha(primaryColor, 0.18),
    '--admin-accent-contrast': getContrastColor(primaryColor),
    '--admin-accent-shadow': toAlpha(primaryColor, 0.28),
    '--admin-btn-primary-bg': `linear-gradient(145deg, ${primaryColor}, ${primaryStrong})`,
    '--admin-btn-primary-bg-hover': `linear-gradient(145deg, ${primaryHoverStart}, ${primaryHoverEnd})`,
    '--admin-btn-primary-border-hover': primaryHoverEnd,
    '--admin-ghost-bg': secondaryColor,
    '--admin-ghost-text': getContrastColor(secondaryColor),
    '--admin-ghost-border': mixHexColors(secondaryColor, secondaryBorderBase, 0.35),
    '--admin-ghost-hover': ghostHoverBg,
    '--admin-ghost-hover-text': ghostHoverText,
    '--admin-ghost-hover-border': toAlpha(primaryColor, mode === 'dark' ? 0.42 : 0.32),
    '--admin-main-bg': mainBg,
    '--admin-tarifa-accent': tarifaAccent,
    '--admin-tarifa-accent-soft': toAlpha(tarifaAccent, mode === 'dark' ? 0.18 : 0.12),
    '--admin-tarifa-stats-bg': mode === 'dark'
      ? mixHexColors(panelSurfaceAlt, tarifaAccent, 0.1)
      : mixHexColors('#FFFFFF', tarifaAccent, 0.06),
    '--ops-kiosk-page-bg': `linear-gradient(180deg, ${kioskBgTop} 0%, ${kioskBgBottom} 100%)`,
    '--admin-panel-surface': panelSurface,
    '--admin-panel-surface-alt': panelSurfaceAlt,
    '--admin-panel-text': panelText,
    '--admin-panel-muted': panelMuted,
    '--admin-table-bg': tableBg,
    '--admin-table-text': tableText,
    '--admin-table-muted': tableMuted,
    '--admin-table-border': tableBorder,
    '--admin-table-head-bg': tableHeadBg,
    '--admin-table-head-text': tableHeadText,
    '--admin-table-head-border': tableHeadBorder,
    '--admin-chip-bg': chipBg,
    '--admin-chip-text': chipText,
    '--admin-chip-border': chipBorder,
    '--admin-kpi-spaces': `linear-gradient(135deg, ${normalizeHexColor(
      appearance.kpiSpacesStart,
      DEFAULT_ADMIN_APPEARANCE.kpiSpacesStart,
    )} 0%, ${normalizeHexColor(appearance.kpiSpacesEnd, DEFAULT_ADMIN_APPEARANCE.kpiSpacesEnd)} 100%)`,
    '--admin-kpi-alerts': `linear-gradient(135deg, ${normalizeHexColor(
      appearance.kpiAlertsStart,
      DEFAULT_ADMIN_APPEARANCE.kpiAlertsStart,
    )} 0%, ${normalizeHexColor(appearance.kpiAlertsEnd, DEFAULT_ADMIN_APPEARANCE.kpiAlertsEnd)} 100%)`,
    '--admin-kpi-alerts2': `linear-gradient(135deg, ${normalizeHexColor(
      appearance.kpiReservedStart,
      DEFAULT_ADMIN_APPEARANCE.kpiReservedStart,
    )} 0%, ${normalizeHexColor(
      appearance.kpiReservedEnd,
      DEFAULT_ADMIN_APPEARANCE.kpiReservedEnd,
    )} 100%)`,
    '--admin-kpi-members': `linear-gradient(135deg, ${normalizeHexColor(
      appearance.kpiMembersStart,
      DEFAULT_ADMIN_APPEARANCE.kpiMembersStart,
    )} 0%, ${normalizeHexColor(appearance.kpiMembersEnd, DEFAULT_ADMIN_APPEARANCE.kpiMembersEnd)} 100%)`,
    ...statusVars,
    ...machineTypeVars,
  };
}
