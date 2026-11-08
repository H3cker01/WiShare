import { list, del } from "@vercel/blob";
import { parseExpiry } from "./expiry";

// Deletes expired blobs under prefix and returns the live ones.
export async function sweep(prefix) {
  const now = Date.now();
  let cursor;
  let removed = 0;
  const files = [];

  do {
    const res = await list({ prefix, cursor, limit: 1000 });
    const expired = [];

    for (const b of res.blobs) {
      const p = parseExpiry(b.pathname);
      if (!p) continue;
      if (p.expiresAt <= now) {
        expired.push(b.pathname);
      } else {
        files.push({
          pathname: b.pathname,
          name: p.name,
          url: b.url,
          size: b.size,
          uploadedAt: b.uploadedAt,
          expiresAt: p.expiresAt,
        });
      }
    }

    if (expired.length) {
      await del(expired);
      removed += expired.length;
    }
    cursor = res.hasMore ? res.cursor : undefined;
  } while (cursor);

  return { files, removed };
}
