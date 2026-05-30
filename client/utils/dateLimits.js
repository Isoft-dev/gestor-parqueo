function pad2(n) {
  return String(n).padStart(2, '0');
}

export function todayYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function nowLocalDatetime() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

export function currentMonthYm() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}

export function clampDateYmd(value, max = todayYmd()) {
  const v = String(value ?? '').slice(0, 10);
  if (!v) return v;
  return v > max ? max : v;
}

export function clampMonthYm(value, max = currentMonthYm()) {
  const v = String(value ?? '').slice(0, 7);
  if (!v) return v;
  return v > max ? max : v;
}

export function clampDatetimeLocal(value, max = nowLocalDatetime()) {
  const v = String(value ?? '').trim();
  if (!v) return v;
  return v > max ? max : v;
}

export function isDateRangeInvalid(desde, hasta) {
  const d = String(desde ?? '').trim();
  const h = String(hasta ?? '').trim();
  if (!d || !h) return false;
  return d > h;
}

export function getDateRangeError(desde, hasta) {
  return isDateRangeInvalid(desde, hasta)
    ? 'La fecha «Desde» no puede ser posterior a «Hasta».'
    : null;
}

/** Ajusta el otro extremo del rango al teclear «desde» o «hasta». */
export function syncDateRangeOnChange(draft, field, rawValue, { max, useDatetime = false } = {}) {
  const clamp = useDatetime
    ? (v) => clampDatetimeLocal(v, max)
    : (v) => clampDateYmd(v, max);

  const nextValue = clamp(rawValue);
  const prevDesde = String(draft?.desde ?? '').trim();
  const prevHasta = String(draft?.hasta ?? '').trim();

  if (field === 'desde') {
    const desde = nextValue;
    let hasta = prevHasta;
    if (desde && hasta && desde > hasta) hasta = desde;
    return { ...draft, desde, hasta };
  }

  if (field === 'hasta') {
    const hasta = nextValue;
    let desde = prevDesde;
    if (desde && hasta && desde > hasta) desde = hasta;
    return { ...draft, desde, hasta };
  }

  return draft;
}
