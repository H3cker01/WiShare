import { sweep } from "../../../../lib/sweep";

export async function GET(request) {
  const secret = process.env.CRON_SECRET;
  if (secret && request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { removed } = await sweep("rooms/");
  return Response.json({ removed });
}
