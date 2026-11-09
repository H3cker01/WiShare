import { put } from "@vercel/blob";
import { cleanRoom } from "../../../lib/room";
import { clampHours } from "../../../lib/expiry";
import { access } from "../../../lib/store";
import { blobToken } from "../../../lib/blob";

export async function POST(request) {
  const url = new URL(request.url);
  const room = cleanRoom(url.searchParams.get("room"));

  const a = await access(request, room);
  if (!a.trusted && !a.unlocked) {
    return Response.json({ error: "Password required" }, { status: 401 });
  }

  const hours = clampHours(url.searchParams.get("hours"));
  const mode = url.searchParams.get("mode") === "p" ? "p" : "r";
  const name = (url.searchParams.get("name") || "file")
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 150);
  const expiresAt = Date.now() + hours * 3600 * 1000;

  if (!request.body) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  try {
    const blob = await put(`rooms/${room}/${expiresAt}__${mode}__${name}`, request.body, {
      access: "private",
      token: blobToken,
      addRandomSuffix: true,
      contentType: request.headers.get("content-type") || undefined,
    });
    return Response.json({ ok: true, pathname: blob.pathname });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
