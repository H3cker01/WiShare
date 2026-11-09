import { list, put } from "@vercel/blob";
import { createHash, randomInt } from "crypto";
import { blobToken } from "./blob";

export function clientIp(request) {
  const fwd = request.headers.get("x-forwarded-for") || "";
  return fwd.split(",")[0].trim() || "unknown";
}

export function newPassword() {
  return String(randomInt(0, 1000000)).padStart(6, "0");
}

export function cookieValue(room, password) {
  return createHash("sha256").update(room + ":" + password).digest("hex");
}

export function hasUnlockCookie(request, room, password) {
  const header = request.headers.get("cookie") || "";
  const m = header.match(new RegExp("(?:^|;\\s*)ws_" + room + "=([a-f0-9]+)"));
  return !!m && m[1] === cookieValue(room, password);
}

export async function readMeta(room) {
  const path = `meta/${room}.json`;
  const { blobs } = await list({ prefix: path, token: blobToken, limit: 5 });
  const b = blobs.find((x) => x.pathname === path);
  if (!b) return null;
  const res = await fetch(b.url, {
    headers: { authorization: `Bearer ${blobToken}` },
    cache: "no-store",
  });
  if (!res.ok) return null;
  return res.json();
}

export async function writeMeta(room, meta) {
  await put(`meta/${room}.json`, JSON.stringify(meta), {
    access: "private",
    token: blobToken,
    addRandomSuffix: false,
    allowOverwrite: true,
    contentType: "application/json",
  });
}

// First visitor to a room becomes its owner (same network = no password).
export async function access(request, room) {
  const ip = clientIp(request);
  let meta = await readMeta(room);
  if (!meta) {
    meta = { owner: ip, password: newPassword(), createdAt: Date.now() };
    await writeMeta(room, meta);
  }
  const trusted = meta.owner === ip;
  const unlocked = hasUnlockCookie(request, room, meta.password);
  return { meta, trusted, unlocked, ip };
}

export async function findBlob(pathname) {
  const { blobs } = await list({ prefix: pathname, token: blobToken, limit: 5 });
  return blobs.find((x) => x.pathname === pathname) || null;
}
