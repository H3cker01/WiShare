"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import { cleanRoom } from "../lib/room";

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

function fileName(pathname) {
  return pathname.split("/").pop();
}

export default function Home() {
  const [roomInput, setRoomInput] = useState("main");
  const [room, setRoom] = useState("main");
  const [files, setFiles] = useState([]);
  const [status, setStatus] = useState("");
  const [statusKind, setStatusKind] = useState("");
  const [busy, setBusy] = useState(false);
  const [pct, setPct] = useState(0);
  const [dragOver, setDragOver] = useState(false);
  const inputRef = useRef(null);

  const say = (text, kind = "") => {
    setStatus(text);
    setStatusKind(kind);
  };

  const load = useCallback(async (r) => {
    try {
      const res = await fetch(`/api/files?room=${encodeURIComponent(r)}`, {
        cache: "no-store",
      });
      if (!res.ok) throw new Error("list failed");
      setFiles(await res.json());
    } catch {
      say("Could not load files.", "err");
    }
  }, []);

  useEffect(() => {
    load(room);
  }, [room, load]);

  function joinRoom(e) {
    e.preventDefault();
    const r = cleanRoom(roomInput);
    setRoomInput(r);
    setRoom(r);
    say("Joined room '" + r + "'.", "ok");
  }

  async function sendFiles(list) {
    const items = Array.from(list || []);
    if (!items.length || busy) return;

    setBusy(true);
    try {
      for (let i = 0; i < items.length; i++) {
        const f = items[i];
        const safe = f.name.replace(/[^\w.\- ()]/g, "_");
        say(`Uploading ${i + 1}/${items.length}: ${f.name}`);
        setPct(0);
        await upload(`rooms/${room}/${safe}`, f, {
          access: "public",
          handleUploadUrl: "/api/blob",
          addRandomSuffix: true,
          contentType: f.type || undefined,
          onUploadProgress: ({ percentage }) => setPct(Math.round(percentage)),
        });
      }
      say("Uploaded " + items.length + " file(s).", "ok");
      await load(room);
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
      say("Deleted " + fileName(file.pathname) + ".", "ok");
      await load(room);
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
            onClick={() => load(room)}
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
                <th>Size</th>
                <th>Date</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {files.map((f) => (
                <tr key={f.pathname}>
                  <td className="name">{fileName(f.pathname)}</td>
                  <td>{humanSize(f.size)}</td>
                  <td className="muted">
                    {new Date(f.uploadedAt).toLocaleString()}
                  </td>
                  <td className="actions">
                    <a className="btn" href={f.url} download>
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
    </main>
  );
}
