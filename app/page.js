"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { cleanRoom } from "../lib/room";
import { clampHours, MAX_HOURS } from "../lib/expiry";

const SMALL_LIMIT = 4 * 1024 * 1024;

function humanSize(n) {
  if (n < 1024) return n + " B";
  const units = ["KB", "MB", "GB", "TB"];
  let i = -1;
  do {
    n /= 1024;
    i++;
  } while (n >= 1024 && i < units.length - 1);
  return n.toFixed(1) + " " + units[i];
}

function timeLeft(ts) {
  const ms = ts - Date.now();
  if (ms <= 0) return "expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? h + "h " + m + "m left" : m + "m left";
}

const inlineInput = {
  background: "var(--panel-hi)",
  border: "1px solid var(--border)",
  borderRadius: 6,
  color: "var(--text)",
  padding: "8px 10px",
  font: "inherit",
};

export default function Home() {
  const [roomInput, setRoomInput] = useState("main");
  const [room, setRoom] = useState("main");
  const [info, setInfo] = useState(null);
  const [files, setFiles] = useState([]);
  const [hours, setHours] = useState(4);
  const [mode, setMode] = useState("r");
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const [unlockPwd, setUnlockPwd] = useState("");
  const [editing, setEditing] = useState(false);
  const [newPwd, setNewPwd] = useState("");
  const inputRef = useRef(null);

  const say = (text, kind = "") => {
    setStatus(text);
    setStatusKind(kind);
  };

  const allowed = !!info && (info.trusted || info.unlocked);

  const loadFiles = useCallback(async (r) => {
    const res = await fetch(`/api/files?room=${encodeURIComponent(r)}`, {
      cache: "no-store",
    });
    if (!res.ok) {
      setFiles([]);
      return;
    }
    setFiles(await res.json());
  }, []);

  const loadRoom = useCallback(
    async (r) => {
      try {
        const res = await fetch(`/api/room?room=${encodeURIComponent(r)}`, {
          cache: "no-store",
        });
        const data = await res.json();
        setInfo(data);
        if (data.trusted || data.unlocked) {
          await loadFiles(r);
        } else {
          setFiles([]);
        }
      } catch {
        say("Could not load room.", "err");
      }
    },
    [loadFiles]
  );

  useEffect(() => {
    loadRoom(room);
  }, [room, loadRoom]);

  function joinRoom(e) {
    e.preventDefault();
    const r = cleanRoom(roomInput);
    setRoomInput(r);
    setRoom(r);
    say("Joined room '" + r + "'.", "ok");
  }

  async function unlock(e) {
    e.preventDefault();
    const res = await fetch("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, action: "unlock", password: unlockPwd }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      say(data.error || "Unlock failed.", "err");
      return;
    }
    setUnlockPwd("");
    say("Unlocked.", "ok");
    await loadRoom(room);
  }

  async function savePassword(e) {
    e.preventDefault();
    const res = await fetch("/api/room", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ room, action: "change", password: newPwd }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      say(data.error || "Could not change password.", "err");
      return;
    }
    setEditing(false);
    setNewPwd("");
    say("Password changed.", "ok");
    await loadRoom(room);
  }

  async function sendFiles(list) {
    const items = Array.from(list || []);
    if (!items.length || busy) return;

    const h = clampHours(hours);
    setHours(h);
    setBusy(true);
    try {
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        const safe = f.name.replace(/[^\w.\- ()]/g, "_");
        say(`Uploading ${i + 1}/${items.length}: ${f.name}`);
        setPct(0);

        if (f.size <= SMALL_LIMIT) {
          const res = await fetch(
            `/api/upload?room=${encodeURIComponent(room)}&name=${encodeURIComponent(safe)}&hours=${h}&mode=${mode}`,
            {
              method: "POST",
              headers: { "Content-Type": f.type || "application/octet-stream" },
              body: f,
            }
          );
          if (!res.ok) {
            const j = await res.json().catch(() => ({}));
            throw new Error(j.error || "upload failed");
          }
          setPct(100);
        } else {
          const expiresAt = Date.now() + h * 3600 * 1000;
          await upload(`rooms/${room}/${expiresAt}__${mode}__${safe}`, f, {
            access: "private",
            handleUploadUrl: "/api/blob",
            contentType: f.type || undefined,
            onUploadProgress: ({ percentage }) => setPct(Math.round(percentage)),
          });
        }
      }
      say("Uploaded " + items.length + " file(s).", "ok");
      await loadFiles(room);
    } catch (err) {
      say("Upload failed: " + err.message, "err");
    } finally {
      setBusy(false);
      setPct(0);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function removeFile(file) {
    try {
      const res = await fetch("/api/files", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room, pathname: file.pathname }),
      });
      if (!res.ok) throw new Error("delete failed");
      say("Deleted " + file.name + ".", "ok");
      await loadFiles(room);
    } catch (err) {
      say("Delete failed: " + err.message, "err");
    }
  }

  return (
    <main>
      <h1>WiShare</h1>

      <div className="panel">
        <form className="row" onSubmit={joinRoom}>
          <span className="muted">Room</span>
          <input
            type="text"
            value={roomInput}
            onChange={(e) => setRoomInput(e.target.value)}
            placeholder="room name"
          />
          <button className="btn" type="submit">
            Join
          </button>
          <span className="muted" style={{ marginLeft: "auto" }}>
            Current: {room}
          </span>
        </form>
      </div>

      {info && !allowed && (
        <div className="panel">
          <p>This room is password protected.</p>
          <form className="row" onSubmit={unlock}>
            <input
              type="text"
              inputMode="numeric"
              value={unlockPwd}
              onChange={(e) => setUnlockPwd(e.target.value)}
              placeholder="password"
            />
            <button className="btn primary" type="submit">
              Unlock
            </button>
          </form>
          <div className={"status " + statusKind}>{status}</div>
        </div>
      )}

      {allowed && (
        <>
          <div className="panel">
            <div className="row">
              <span className="muted">Room password:</span>
              {info.trusted ? (
                <strong style={{ letterSpacing: 2 }}>{info.password}</strong>
              ) : (
                <span className="muted">hidden (you are unlocked)</span>
              )}
              <button
                className="btn"
                style={{ marginLeft: "auto" }}
                title="Change password"
                onClick={() => setEditing(!editing)}
              >
                ✎
              </button>
            </div>
            {editing && (
              <form className="row" style={{ marginTop: 10 }} onSubmit={savePassword}>
                <input
                  type="text"
                  inputMode="numeric"
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="4 to 6 digits"
                />
                <button className="btn primary" type="submit">
                  Save
                </button>
              </form>
            )}
          </div>

          <div
            className={"drop" + (dragOver ? " over" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              sendFiles(e.dataTransfer.files);
            }}
          >
            <p>Drop files here</p>

            <div className="row" style={{ justifyContent: "center", marginBottom: 12 }}>
              <span className="muted">Keep for</span>
              <input
                type="number"
                min="1"
                max={MAX_HOURS}
                value={hours}
                onChange={(e) => setHours(e.target.value)}
                style={{ ...inlineInput, width: 90, flex: "none" }}
              />
              <span className="muted">hours</span>
              <select
                value={mode}
                onChange={(e) => setMode(e.target.value)}
                style={inlineInput}
              >
                <option value="r">Room access</option>
                <option value="p">Password only</option>
              </select>
            </div>

            <button
              className="btn primary"
              disabled={busy}
              onClick={() => inputRef.current && inputRef.current.click()}
            >
              Choose files
            </button>
            <input
              ref={inputRef}
              type="file"
              multiple
              hidden
              onChange={(e) => sendFiles(e.target.files)}
            />
            {busy && (
              <div className="progress">
                <div style={{ width: pct + "%" }} />
              </div>
            )}
            <div className={"status " + statusKind}>{status}</div>
          </div>

          <div className="panel">
            <div className="row" style={{ marginBottom: 8 }}>
              <strong>Files in '{room}'</strong>
              <button
                className="btn"
                style={{ marginLeft: "auto" }}
                onClick={() => loadFiles(room)}
              >
                Refresh
              </button>
            </div>

            {files.length === 0 ? (
              <p className="muted">No files yet.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Access</th>
                    <th>Size</th>
                    <th>Expires</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {files.map((f) => (
                    <tr key={f.pathname}>
                      <td className="name">{f.name}</td>
                      <td className="muted">{f.mode === "p" ? "Password" : "Room"}</td>
                      <td>{humanSize(f.size)}</td>
                      <td className="muted" title={new Date(f.expiresAt).toLocaleString()}>
                        {timeLeft(f.expiresAt)}
                      </td>
                      <td className="actions">
                        <a
                          className="btn"
                          href={`/api/download?room=${encodeURIComponent(room)}&pathname=${encodeURIComponent(f.pathname)}`}
                        >
                          Download
                        </a>
                        <button className="btn danger" onClick={() => removeFile(f)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {status && !info?.trusted && <div className={"status " + statusKind}>{status}</div>}
        </>
      )}
    </main>
  );
}
