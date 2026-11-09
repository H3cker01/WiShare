import { handleUpload } from "@vercel/blob/client";
import { MAX_HOURS } from "../../../lib/expiry";
import { blobToken } from "../../../lib/blob";
import { access } from "../../../lib/store";

export async function POST(request) {
  try {
    const body = await request.json();

    const json = await handleUpload({
      token: blobToken,
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const m = pathname.match(/^rooms\/([a-z0-9_-]+)\/(\d+)__[rp]__.+$/);
        if (!m) throw new Error("Invalid path");

        const room = m[1];
        const expiresAt = Number(m[2]);
        const now = Date.now();
        if (expiresAt <= now || expiresAt > now + MAX_HOURS * 3600 * 1000 + 60000) {
          throw new Error("Invalid expiry");
        }

        const a = await access(request, room);
        if (!a.trusted && !a.unlocked) throw new Error("Password required");

        return {
          maximumSizeInBytes: 2 * 1024 * 1024 * 1024,
          addRandomSuffix: true,
        };
      },
      onUploadCompleted: async () => {},
    });

    return Response.json(json);
  } catch (err) {
    return Response.json({ error: err.message }, { status: 400 });
  }
}
