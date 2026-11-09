import { cleanRoom } from "../../../lib/room";
import { access, findBlob } from "../../../lib/store";
import { parseExpiry } from "../../../lib/expiry";
import { blobToken } from "../../../lib/blob";

export async function GET(request) {
  const url = new URL(request.url);
  const room = cleanRoom(url.searchParams.get("room"));
  const pathname = url.searchParams.get("pathname") || "";

  if (!pathname.startsWith(`rooms/${room}/`)) {
    return new Response("Bad request", { status: 400 });
  }
  const info = parseExpiry(pathname);
  if (!info) return new Response("Not found", { status: 404 });
  if (info.expiresAt <= Date.now()) return new Response("Expired", { status: 410 });

  const a = await access(request, room);
  const allowed = info.mode === "p" ? a.unlocked : a.trusted || a.unlocked;
  if (!allowed) return new Response("Password required", { status: 401 });

  const blob = await findBlob(pathname);
  if (!blob) return new Response("Not found", { status: 404 });

  const res = await fetch(blob.url, {
    headers: { authorization: `Bearer ${blobToken}` },
    cache: "no-store",
  });
  if (!res.ok) return new Response("Fetch failed", { status: 502 });

  const headers = new Headers();
  headers.set("content-type", res.headers.get("content-type") || "application/octet-stream");
  headers.set("content-disposition", `attachment; filename="${info.name.replace(/"/g, "")}"`);
  return new Response(res.body, { headers });
}
