import { del } from "@vercel/blob";
import { cleanRoom } from "../../../lib/room";
import { sweep } from "../../../lib/sweep";
import { access } from "../../../lib/store";
import { parseExpiry } from "../../../lib/expiry";
import { blobToken } from "../../../lib/blob";

export async function GET(request) {
  const room = cleanRoom(new URL(request.url).searchParams.get("room"));
  const a = await access(request, room);
  if (!a.trusted && !a.unlocked) {
    return Response.json({ error: "Password required" }, { status: 401 });
  }

  const { files } = await sweep(`rooms/${room}/`);
  const visible = files.filter((f) => f.mode === "r" || a.unlocked);
  visible.sort((x, y) => new Date(y.uploadedAt) - new Date(x.uploadedAt));

  return Response.json(visible);
}

export async function DELETE(request) {
  const body = await request.json().catch(() => ({}));
  const room = cleanRoom(body.room);
  const pathname = body.pathname || "";

  if (!pathname.startsWith(`rooms/${room}/`)) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  const a = await access(request, room);
  const mode = parseExpiry(pathname)?.mode;
  const allowed = mode === "p" ? a.unlocked : a.trusted || a.unlocked;
  if (!allowed) return Response.json({ error: "Password required" }, { status: 401 });

  await del(pathname, { token: blobToken });
  return Response.json({ ok: true });
}
