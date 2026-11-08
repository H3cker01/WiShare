import { handleUpload } from "@vercel/blob/client";

export async function POST(request) {
  try {
    const body = await request.json();

    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith("rooms/")) {
          throw new Error("Invalid path");
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
