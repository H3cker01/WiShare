import { put } from "@vercel/blob";
import { cleanRoom } from "../../../lib/room";
import { clampHours } from "../../../lib/expiry";
import { blobToken } from "../../../lib/blob";

export async function POST(request) {
  const url = new URL(request.url);
  const room = cleanRoom(url.searchParams.get("room"));
  const hours = clampHours(url.searchParams.get("hours"));
  const name = (url.searchParams.get("name") || "file")
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 150);
  const expiresAt = Date.now() + hours * 3600 * 1000;

  if (!request.body) {
    return Response.json({ error: "No file" }, { status: 400 });
  }

  try {
    const blob = await put(`rooms/${room}/${expiresAt}__${name}`, request.body, {
      access: "public",
      token: blobToken,
      addRandomSuffix: true,
      contentType: request.headers.get("content-type") || undefined,
    });
    return Response.json(blob);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
