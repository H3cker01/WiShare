import { handleUpload } from "@vercel/blob/client";
import { MAX_HOURS } from "../../../lib/expiry";

export async function POST(request) {
  try {
    const body = await request.json();

    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        const m = pathname.match(/^rooms\/[a-z0-9_-]+\/(\d+)__.+$/);
        if (!m) throw new Error("Invalid path");
        const expiresAt = Number(m[1]);
        const now = Date.now();
        if (expiresAt <= now || expiresAt > now + MAX_HOURS * 3600 * 1000 + 60000) {
          throw new Error("Invalid expiry");
        }
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
