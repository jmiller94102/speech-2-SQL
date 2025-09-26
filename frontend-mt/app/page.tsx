"use client";
import { useEffect, useMemo, useRef, useState } from "react";

type LogItem = {
  id: number;
  source: "ui" | "worker-1" | "worker-2";
  text: string;
  time: string;
};

function now() {
  const d = new Date();
  return d.toLocaleTimeString();
}

export default function Page() {
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<LogItem[]>([]);
  const idRef = useRef(0);
  const worker1Ref = useRef<Worker | null>(null);
  const worker2Ref = useRef<Worker | null>(null);

  useEffect(() => {
    // Create workers from public folder scripts
    const w1 = new Worker("/workers/echo.js");
    const w2 = new Worker("/workers/compute.js");
    worker1Ref.current = w1;
    worker2Ref.current = w2;

    const onMsg1 = (e: MessageEvent) => {
      setLogs((prev) => [
        { id: ++idRef.current, source: "worker-1", text: JSON.stringify(e.data), time: now() },
        ...prev,
      ]);
    };
    const onMsg2 = (e: MessageEvent) => {
      setLogs((prev) => [
        { id: ++idRef.current, source: "worker-2", text: JSON.stringify(e.data), time: now() },
        ...prev,
      ]);
    };
    w1.addEventListener("message", onMsg1);
    w2.addEventListener("message", onMsg2);

    return () => {
      w1.removeEventListener("message", onMsg1);
      w2.removeEventListener("message", onMsg2);
      w1.terminate();
      w2.terminate();
    };
  }, []);

  const sendToWorker1 = () => {
    const text = message.trim();
    if (!text) return;
    setLogs((prev) => [
      { id: ++idRef.current, source: "ui", text: `-> worker-1: ${text}` , time: now() },
      ...prev,
    ]);
    worker1Ref.current?.postMessage({ type: "echo", payload: text });
  };

  const sendToWorker2 = () => {
    const text = message.trim();
    if (!text) return;
    setLogs((prev) => [
      { id: ++idRef.current, source: "ui", text: `-> worker-2 (heavy): ${text}` , time: now() },
      ...prev,
    ]);
    worker2Ref.current?.postMessage({ type: "heavy", payload: text });
  };

  const clearLog = () => setLogs([]);

  return (
    <div className="container">
      <h1 style={{ margin: 0, marginBottom: 8 }}>Multithreaded Messages</h1>
      <p style={{ marginTop: 0, color: "#9ca3af" }}>Two Web Workers process messages concurrently.</p>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">Controls</div>
        <div className="card-content" style={{ display: "grid", gap: 12 }}>
          <div className="row">
            <input
              className="input"
              placeholder="Type a message..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
            />
          </div>
          <div className="row">
            <button className="button" onClick={sendToWorker1}>Send to Worker 1 (Echo)</button>
            <button className="button" onClick={sendToWorker2}>Send to Worker 2 (Heavy)</button>
            <button className="button secondary" onClick={clearLog}>Clear Log</button>
          </div>
          <div className="row" style={{ gap: 8 }}>
            <span className="badge">Worker 1: Echo back payload with latency</span>
            <span className="badge">Worker 2: Simulates heavy CPU work</span>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-header">Log</div>
        <div className="card-content">
          <div className="log">
            {logs.length === 0 && <div style={{ color: "#9ca3af" }}>No messages yet.</div>}
            {logs.map((l) => (
              <div key={l.id}>
                <span style={{ color: "#9ca3af" }}>[{l.time}]</span> <strong>{l.source}</strong>: {l.text}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
