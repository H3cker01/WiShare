export function cleanRoom(value) {
  const s = (value || "")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
  return s || "main";
}
