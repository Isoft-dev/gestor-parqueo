import { DEFAULT_THEME, THEME_KEY, ADMIN_APPEARANCE_KEY } from '../config.js';

export const DEFAULT_ADMIN_APPEARANCE = {
  mode: DEFAULT_THEME,
  primaryColor: '#2563eb',
  secondaryColor: '#ffffff',
  sidebarColor: '#0f172a',
  sidebarTextColor: '#e2e8f0',
  sidebarMutedColor: '#94a3b8',
  kpiSpacesStart: '#0ea5e9',
  kpiSpacesEnd: '#2563eb',
  kpiAlertsStart: '#f59e0b',
  kpiAlertsEnd: '#ea580c',
  kpiReservedStart: '#38bdf8',
  kpiReservedEnd: '#2563eb',
  kpiMembersStart: '#10b981',
  kpiMembersEnd: '#047857',
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
];

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

  const primaryStrong = shiftHexColor(primaryColor, -0.22);
  const secondaryBorderBase = appearance.mode === 'dark' ? '#CBD5E1' : '#64748B';
  const secondaryHover = appearance.mode === 'dark'
    ? shiftHexColor(secondaryColor, 0.08)
    : shiftHexColor(secondaryColor, -0.06);
  const panelSurface = appearance.mode === 'dark'
    ? mixHexColors(sidebarColor, '#111827', 0.4)
    : mixHexColors(secondaryColor, '#FFFFFF', 0.9);
  const panelSurfaceAlt = appearance.mode === 'dark'
    ? mixHexColors(panelSurface, '#000000', 0.12)
    : mixHexColors(panelSurface, '#0F172A', 0.04);
  const panelText = getContrastColor(panelSurface);
  const panelMuted = appearance.mode === 'dark'
    ? mixHexColors(panelText, panelSurface, 0.34)
    : mixHexColors(panelText, panelSurface, 0.48);
  const tableBg = appearance.mode === 'dark'
    ? mixHexColors(panelSurface, '#0B1120', 0.18)
    : mixHexColors(panelSurface, '#FFFFFF', 0.94);
  const tableText = getContrastColor(tableBg);
  const tableMuted = appearance.mode === 'dark'
    ? mixHexColors(tableText, tableBg, 0.34)
    : mixHexColors(tableText, tableBg, 0.44);
  const tableBorder = appearance.mode === 'dark'
    ? toAlpha(tableText, 0.12)
    : mixHexColors(tableBg, '#94A3B8', 0.35);
  const tableHeadBg = appearance.mode === 'dark'
    ? mixHexColors(tableBg, primaryColor, 0.26)
    : mixHexColors(tableBg, primaryColor, 0.12);
  const tableHeadText = appearance.mode === 'dark'
    ? '#EAF2FF'
    : mixHexColors(tableText, primaryColor, 0.28);
  const tableHeadBorder = appearance.mode === 'dark'
    ? toAlpha(tableHeadText, 0.12)
    : mixHexColors(tableHeadBg, '#94A3B8', 0.28);
  const chipBg = appearance.mode === 'dark'
    ? mixHexColors(tableBg, '#0F172A', 0.28)
    : mixHexColors(tableBg, '#F8FAFC', 0.92);
  const chipText = appearance.mode === 'dark'
    ? '#D8E5F6'
    : mixHexColors(tableText, '#334155', 0.38);
  const chipBorder = appearance.mode === 'dark'
    ? toAlpha(chipText, 0.16)
    : mixHexColors(chipBg, '#94A3B8', 0.34);

  return {
    '--admin-sidebar-bg': sidebarColor,
    '--admin-sidebar-border': toAlpha(sidebarTextColor, 0.12),
    '--admin-sidebar-text': sidebarTextColor,
    '--admin-sidebar-muted': sidebarMutedColor,
    '--admin-sidebar-hover': toAlpha(sidebarTextColor, 0.09),
    '--admin-sidebar-active-bg': toAlpha(primaryColor, appearance.mode === 'dark' ? 0.3 : 0.18),
    '--admin-sidebar-active-border': toAlpha(primaryColor, 0.42),
    '--admin-sidebar-active-text': sidebarTextColor,
    '--admin-accent': primaryColor,
    '--admin-accent-strong': primaryStrong,
    '--admin-accent-soft': toAlpha(primaryColor, 0.18),
    '--admin-accent-contrast': getContrastColor(primaryColor),
    '--admin-accent-shadow': toAlpha(primaryColor, 0.28),
    '--admin-ghost-bg': secondaryColor,
    '--admin-ghost-text': getContrastColor(secondaryColor),
    '--admin-ghost-border': mixHexColors(secondaryColor, secondaryBorderBase, 0.35),
    '--admin-ghost-hover': secondaryHover,
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
    )} 0%, ${normalizeHexColor(
      appearance.kpiMembersEnd,
      DEFAULT_ADMIN_APPEARANCE.kpiMembersEnd,
    )} 100%)`,
  };
}
