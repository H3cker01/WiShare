import { del } from "@vercel/blob";
import { cleanRoom } from "../../../lib/room";
import { sweep } from "../../../lib/sweep";
import { blobToken } from "../../../lib/blob";

export async function GET(request) {
  const url = new URL(request.url);
  const room = cleanRoom(url.searchParams.get("room"));

  const { files } = await sweep(`rooms/${room}/`);
  files.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return Response.json(files);
}

export async function DELETE(request) {
  const { room: rawRoom, pathname } = await request.json();
  const room = cleanRoom(rawRoom);

  if (!pathname || !pathname.startsWith(`rooms/${room}/`)) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  await del(pathname, { token: blobToken });
  return Response.json({ ok: true });
}
