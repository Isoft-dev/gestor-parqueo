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
