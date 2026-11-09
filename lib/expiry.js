export const MAX_HOURS = 168;

export function clampHours(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 4;
  return Math.min(MAX_HOURS, Math.max(1, n));
}

// pathname format: rooms/<room>/<expiresAtMs>__<mode>__<name>
// mode: r = room password (same network free), p = password always
export function parseExpiry(pathname) {
  const m = pathname.match(/\/(\d+)__([rp])__([^/]+)$/);
  if (!m) return null;
  return { expiresAt: Number(m[1]), mode: m[2], name: m[3] };
}
