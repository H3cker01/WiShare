import { access, cookieValue, writeMeta } from "../../../lib/store";
import { cleanRoom } from "../../../lib/room";

const attempts = new Map();

function isLocked(key) {
  const a = attempts.get(key);
  return !!a && a.count >= 5 && a.until > Date.now();
}

function recordFail(key) {
  const a = attempts.get(key) || { count: 0, until: 0 };
  a.count++;
  if (a.count >= 5) a.until = Date.now() + 15 * 60 * 1000;
  attempts.set(key, a);
}

function withCookie(room, password, body) {
  const res = Response.json(body);
  res.headers.set(
    "Set-Cookie",
    `ws_${room}=${cookieValue(room, password)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
  );
  return res;
}

export async function GET(request) {
  const room = cleanRoom(new URL(request.url).searchParams.get("room"));
  const a = await access(request, room);
  return Response.json({
    trusted: a.trusted,
    unlocked: a.unlocked,
    password: a.trusted ? a.meta.password : undefined,
  });
}

export async function POST(request) {
  const body = await request.json().catch(() => ({}));
  const room = cleanRoom(body.room);
  const a = await access(request, room);
  const key = a.ip + ":" + room;

  if (body.action === "unlock") {
    if (isLocked(key)) {
      return Response.json({ error: "Too many attempts. Try again in 15 minutes." }, { status: 429 });
    }
    if (String(body.password || "") !== a.meta.password) {
      recordFail(key);
      return Response.json({ error: "Wrong password." }, { status: 401 });
    }
    attempts.delete(key);
    return withCookie(room, a.meta.password, { ok: true });
  }

  if (body.action === "change") {
    if (!a.trusted && !a.unlocked) {
      return Response.json({ error: "Password required." }, { status: 401 });
    }
    const pwd = String(body.password || "");
    if (!/^\d{4,6}$/.test(pwd)) {
      return Response.json({ error: "Use 4 to 6 digits." }, { status: 400 });
    }
    await writeMeta(room, { ...a.meta, password: pwd });
    return withCookie(room, pwd, { ok: true, password: a.trusted ? pwd : undefined });
  }

  return Response.json({ error: "Bad request" }, { status: 400 });
}
