export const MAX_HOURS = 168;

export function clampHours(value) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return 4;
  return Math.min(MAX_HOURS, Math.max(1, n));
}

// pathname format: rooms/<room>/<expiresAtMs>__<name>
export function parseExpiry(pathname) {
  const m = pathname.match(/\/(\d+)__([^/]+)$/);
  if (!m) return null;
  return { expiresAt: Number(m[1]), name: m[2] };
}
