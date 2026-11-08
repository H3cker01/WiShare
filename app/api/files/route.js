import { list, del } from "@vercel/blob";
import { cleanRoom } from "../../../lib/room";

export async function GET(request) {
  const url = new URL(request.url);
  const room = cleanRoom(url.searchParams.get("room"));

  const { blobs } = await list({ prefix: `rooms/${room}/` });

  const files = blobs
    .map((b) => ({
      pathname: b.pathname,
      url: b.url,
      size: b.size,
      uploadedAt: b.uploadedAt,
    }))
    .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

  return Response.json(files);
}

export async function DELETE(request) {
  const { room: rawRoom, pathname } = await request.json();
  const room = cleanRoom(rawRoom);

  if (!pathname || !pathname.startsWith(`rooms/${room}/`)) {
    return Response.json({ error: "Invalid path" }, { status: 400 });
  }

  await del(pathname);
  return Response.json({ ok: true });
}
