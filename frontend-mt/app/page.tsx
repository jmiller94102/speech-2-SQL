"use client";
import { useEffect, useRef, useState } from "react";
import { checkHealth, submitVoiceQuery, API_BASE_URL, type QueryResponse, type HealthResponse } from "@/lib/api";

type LogItem = {
  id: number;
  source: "ui" | "worker-1" | "worker-2" | "backend";
  text: string;
  time: string;
};

function now() {
  const d = new Date();
  return d.toLocaleTimeString();
}

// --- Audio helpers: WebM -> WAV (PCM16 mono) ---
async function blobToArrayBuffer(b: Blob): Promise<ArrayBuffer> {
  return await b.arrayBuffer();
}

async function decodeToPCMMono(ab: ArrayBuffer): Promise<{ pcm: Float32Array; sampleRate: number }> {
  const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
  const audioBuf = await ctx.decodeAudioData(ab.slice(0));
  // Downmix to mono by averaging channels if needed
  const channels = audioBuf.numberOfChannels;
  const length = audioBuf.length;
  const sr = audioBuf.sampleRate;
  const tmp = new Float32Array(length);
  for (let ch = 0; ch < channels; ch++) {
    const data = audioBuf.getChannelData(ch);
    for (let i = 0; i < length; i++) tmp[i] += data[i];
  }
  if (channels > 1) {
    for (let i = 0; i < length; i++) tmp[i] /= channels;
  }
  // Close context to free resources
  if (typeof ctx.close === 'function') try { await ctx.close(); } catch {}
  return { pcm: tmp, sampleRate: sr };
}

function encodeWavPCM16Mono({ pcm, sampleRate }: { pcm: Float32Array; sampleRate: number }): Blob {
  // Convert float32 [-1,1] to int16
  const buffer = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(offset + i, s.charCodeAt(i)); };
  // RIFF header
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeString(8, 'WAVE');
  // fmt chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM chunk size
  view.setUint16(20, 1, true);  // PCM format
  view.setUint16(22, 1, true);  // mono
  view.setUint32(24, sampleRate, true);
  const byteRate = sampleRate * 1 * 2;
  view.setUint32(28, byteRate, true);
  view.setUint16(32, 1 * 2, true); // block align
  view.setUint16(34, 16, true);    // bits per sample
  // data chunk
  writeString(36, 'data');
  view.setUint32(40, pcm.length * 2, true);
  // samples
  let offset = 44;
  for (let i = 0; i < pcm.length; i++, offset += 2) {
    let s = Math.max(-1, Math.min(1, pcm[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }
  return new Blob([view], { type: 'audio/wav' });
}

async function transcodeWebmToWav(blob: Blob): Promise<Blob> {
  const ab = await blobToArrayBuffer(blob);
  const { pcm, sampleRate } = await decodeToPCMMono(ab);
  return encodeWavPCM16Mono({ pcm, sampleRate });
}

export default function Page() {
  const [message, setMessage] = useState("");
  const [logs, setLogs] = useState<LogItem[]>([]);
  const idRef = useRef(0);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const stoppingRef = useRef(false);
  const startTsRef = useRef<number | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [queryResult, setQueryResult] = useState<QueryResponse | null>(null);
  const [loadingQuery, setLoadingQuery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastErrorDetails, setLastErrorDetails] = useState<string | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);

  // No web workers – simplified UX to text + send + mic

  const addLog = (source: LogItem["source"], text: string) => {
    setLogs((prev) => [
      ...prev,
      { id: ++idRef.current, source, text, time: now() },
    ]);
  };

  const copyErrorDetails = async () => {
    if (!lastErrorDetails) return;
    try {
      await navigator.clipboard.writeText(lastErrorDetails);
      addLog("ui", "Copied error details to clipboard");
    } catch (e) {
      addLog("ui", "Failed to copy to clipboard");
    }
  };

  const handleMicClick = () => {
    const rec = recorderRef.current;
    const active = isRecording || (rec && rec.state !== "inactive");
    if (active) {
      stopRecording();
    } else {
      void startRecording();
    }
  };

  // keep chat scrolled to bottom
  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [logs.length]);

  const sendText = () => {
    const text = message.trim();
    if (!text) return;
    addLog("ui", text);
    setMessage("");
  };

  const clearLog = () => setLogs([]);

  // Voice recording controls
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setMediaStream(stream);
      // Prefer OGG (opus) to match backend supported formats, fallback to webm
      const mimeType = MediaRecorder.isTypeSupported("audio/ogg;codecs=opus")
        ? "audio/ogg;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : "";
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/ogg" });
        setAudioBlob(blob);
        addLog("ui", "⏫ Uploading voice message...");
        await submitBlob(blob);
      };
      chunksRef.current = [];
      recorder.start();
      setIsRecording(true);
      startTsRef.current = Date.now();
      addLog("ui", "🎙️ Recording started");
    } catch (e: any) {
      setError(e?.message || "Failed to access microphone");
    }
  };

  const stopRecording = () => {
    if (stoppingRef.current) return;
    stoppingRef.current = true;
    try {
      const rec = recorderRef.current;
      if (rec && rec.state !== "inactive") {
        rec.stop();
      }
    } finally {
      // stop all tracks regardless
      mediaStream?.getTracks().forEach((t) => t.stop());
      setIsRecording(false);
      addLog("ui", "🛑 Recording stopped");
      // release guard shortly after to avoid rapid toggles while onstop finalizes
      setTimeout(() => { stoppingRef.current = false; }, 300);
    }
  };

  const submitBlob = async (blob: Blob) => {
    setLoadingQuery(true);
    setError(null);
    setQueryResult(null);
    try {
      // Guard: ignore extremely short clips (< 700ms)
      const durMs = startTsRef.current ? Date.now() - startTsRef.current : undefined;
      if (typeof durMs === 'number' && durMs < 700) {
        setLoadingQuery(false);
        const msg = `Recording too short (${durMs}ms). Please record at least 1 second.`;
        setError(msg);
        addLog("ui", msg);
        return;
      }
      // If we captured webm, try backend as-is once; if it fails, transcode and retry
      const isWebm = /webm/i.test(blob.type);
      let file: File;
      if (isWebm) {
        addLog("ui", "🔄 Converting to WAV for compatibility...");
        const wavBlob = await transcodeWebmToWav(blob);
        file = new File([wavBlob], `recording.wav`, { type: 'audio/wav' });
      } else {
        const ext = blob.type.includes("ogg") ? "ogg" : "wav";
        file = new File([blob], `recording.${ext}`, { type: blob.type || "audio/wav" });
      }
      let res = await submitVoiceQuery(file);
      setQueryResult(res);
      if (!res.success) setError(res.error || "Processing failed");
      if (res.success) {
        const parts: string[] = [];
        if (res.transcription) parts.push(`"${res.transcription}"`);
        if (res.sql) parts.push(`SQL: ${res.sql}`);
        addLog("backend", parts.join("\n"));
      } else {
        const headerLines = res.responseHeaders
          ? Object.entries(res.responseHeaders).map(([k,v]) => `${k}: ${v}`)
          : [];
        const reqInfo = `Request-Audio: type=${file.type || "unknown"}, size=${(file.size/1024).toFixed(1)}KB`;
        const ua = typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown';
        const loc = typeof location !== 'undefined' ? location.href : '';
        const debug = [
          `Error: ${res.error || "Processing failed"}`,
          res.httpStatus ? `HTTP: ${res.httpStatus} ${res.statusText || ""}`.trim() : undefined,
          headerLines.length ? `Response-Headers:\n${headerLines.join("\n")}` : undefined,
          `Api-URL: ${API_BASE_URL}`,
          reqInfo,
          `Client: UA=${ua}`,
          loc ? `URL: ${loc}` : undefined,
          res.raw ? `Raw: ${res.raw.slice(0, 500)}` : undefined,
        ].filter(Boolean).join("\n\n");
        setLastErrorDetails(debug);
        addLog("backend", debug);
      }
    } catch (e: any) {
      const debug = `Network error: ${e?.message || "Unknown"}`;
      setError(e?.message || "Network error");
      setLastErrorDetails(debug);
      addLog("backend", debug);
    } finally {
      setLoadingQuery(false);
    }
  };

  const doHealthCheck = async () => {
    try {
      const h = await checkHealth();
      setHealth(h);
    } catch (e: any) {
      setError(e?.message || "Health check failed");
    }
  };

  return (
    <div className="app">
      <main className="main">
        <div className="header">
          <div className="badge">Multithreaded Chat</div>
          <div className="badge" onClick={doHealthCheck} style={{ cursor: "pointer" }}>Health</div>
        </div>
        <div className="card" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
          <div className="card-content" style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div ref={chatRef} className="chat">
              {logs.length === 0 && <div style={{ color: "#9ca3af" }}>No messages yet.</div>}
              {logs.map((m) => {
                const isRight = m.source === "ui";
                const avatarClass = m.source === "backend" ? "avatar backend" : "avatar";
                return (
                  <div key={m.id} className={`msg ${isRight ? "right" : ""}`}>
                    {!isRight && <div className={avatarClass} />}
                    <div>
                      <div className={`bubble ${isRight ? "right" : "left"}`}>{m.text}</div>
                      <div className="meta">{m.source} • {m.time}</div>
                    </div>
                    {isRight && <div className={avatarClass} />}
                  </div>
                );
              })}
            </div>
            <div className="composer">
              <input
                className="input"
                placeholder="Message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") sendText(); }}
              />
              <button className="button" onClick={sendText}>Send</button>
              <div style={{ position: "relative" }}>
                <button
                  className={`mic ${isRecording ? "recording" : ""}`}
                  aria-label={isRecording ? "Stop recording" : "Start recording"}
                  onClick={handleMicClick}
                >
                  <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 14a3 3 0 0 0 3-3V7a3 3 0 1 0-6 0v4a3 3 0 0 0 3 3zm5-3a5 5 0 0 1-10 0H5a7 7 0 0 0 14 0h-2zM11 19h2v3h-2v-3z"/></svg>
                </button>
                {isRecording && <span className="pulse" />}
              </div>
            </div>
          </div>
        </div>
        {error && (
          <div style={{ display: "flex", justifyContent: "center", gap: 8 }}>
            <div className="badge" style={{ color: "#ef4444", borderColor: "#7f1d1d" }}>{error}</div>
            {lastErrorDetails && (
              <button className="button secondary" onClick={copyErrorDetails}>
                Copy Error Details
              </button>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
