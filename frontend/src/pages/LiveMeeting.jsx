import { useState, useRef, useEffect } from "react";
import Layout from "../components/Layout";
import { jsPDF } from "jspdf";

const CHUNK_INTERVAL = 5000; // reduced to 5s for more frequent updates
const tabs = [
  { id: "transcript", label: "Transcript", icon: "📝" },
  { id: "summary", label: "Summary", icon: "📋" },
  { id: "actions", label: "Action Items", icon: "✅" },
];

export default function LiveMeeting() {
  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  const videoRef = useRef(null);
  const transcriptRef = useRef(null);
  const streamRef = useRef(null);
  const fullRecorderRef = useRef(null);
  const fullChunksRef = useRef([]);
  const timerRef = useRef(null);
  const chunkIntervalRef = useRef(null);
  const liveTranscriptRef = useRef(""); // keep latest value accessible in async callbacks

  useEffect(() => { startCamera(); return () => cleanup(); }, []);
  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
    if (transcriptRef.current) transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [liveTranscript]);

  const startCamera = async () => {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: { noiseSuppression: true, echoCancellation: true, autoGainControl: true, sampleRate: 16000 }
      });
      const audioContext = new AudioContext();
      const dest = audioContext.createMediaStreamDestination();
      audioContext.createMediaStreamSource(micStream).connect(dest);
      const mixed = new MediaStream([...micStream.getVideoTracks(), ...dest.stream.getAudioTracks()]);
      mixed._micStream = micStream; mixed._screenStream = null; mixed._audioContext = audioContext; mixed._dest = dest;
      streamRef.current = mixed;
      if (videoRef.current) videoRef.current.srcObject = micStream;
    } catch { setError("Camera/microphone access denied."); }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      streamRef.current?._screenStream?.getTracks().forEach(t => t.stop());
      streamRef.current._screenStream = null;
      setScreenSharing(false);
      return;
    }
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      if (screenStream.getAudioTracks().length > 0)
        streamRef.current._audioContext.createMediaStreamSource(screenStream).connect(streamRef.current._dest);
      streamRef.current._screenStream = screenStream;
      screenStream.getVideoTracks()[0].onended = () => { setScreenSharing(false); streamRef.current._screenStream = null; };
      setScreenSharing(true);
    } catch {}
  };

  const cleanup = () => {
    streamRef.current?._micStream?.getTracks().forEach(t => t.stop());
    streamRef.current?._screenStream?.getTracks().forEach(t => t.stop());
    streamRef.current?._audioContext?.close();
    clearInterval(timerRef.current); clearInterval(chunkIntervalRef.current);
  };

  const startRecording = () => {
    if (!streamRef.current) return;
    fullChunksRef.current = [];
    const fullMR = new MediaRecorder(streamRef.current, { mimeType: "video/webm" });
    fullMR.ondataavailable = (e) => { if (e.data.size > 0) fullChunksRef.current.push(e.data); };
    fullMR.start(1000);
    fullRecorderRef.current = fullMR;
    setStatus("recording"); setSeconds(0); setLiveTranscript(""); liveTranscriptRef.current = "";
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    // Send first chunk immediately after 5s, then every 5s
    chunkIntervalRef.current = setInterval(() => sendAudioChunk(), CHUNK_INTERVAL);
  };

  const sendAudioChunk = () => {
    if (!streamRef.current) return;
    const audioStream = new MediaStream(streamRef.current.getAudioTracks());
    const chunkMR = new MediaRecorder(audioStream, { mimeType: "audio/webm" });
    const chunkData = [];
    chunkMR.ondataavailable = (e) => { if (e.data.size > 0) chunkData.push(e.data); };
    chunkMR.onstop = async () => {
      const blob = new Blob(chunkData, { type: "audio/webm" });
      if (blob.size < 500) return;
      const formData = new FormData();
      formData.append("audio", blob, "chunk.webm");
      try {
        const res = await fetch("http://127.0.0.1:5000/transcribe-chunk", { method: "POST", body: formData });
        const data = await res.json();
        if (data.text?.trim()) {
          setLiveTranscript(prev => prev ? prev + "\n" + data.text.trim() : data.text.trim());
        }
      } catch {}
    };
    chunkMR.start();
    setTimeout(() => { if (chunkMR.state === "recording") chunkMR.stop(); }, CHUNK_INTERVAL - 300);
  };

  const stopRecording = () => {
    clearInterval(timerRef.current); clearInterval(chunkIntervalRef.current);
    setStatus("processing");
    fullRecorderRef.current.stop();
    fullRecorderRef.current.onstop = () => processVideo();
  };

  const processVideo = async () => {
    const blob = new Blob(fullChunksRef.current, { type: "video/webm" });
    const formData = new FormData();
    formData.append("video", blob, "meeting.webm");
    try {
      const res = await fetch("http://127.0.0.1:5000/process-video", { method: "POST", body: formData });
      if (!res.ok) throw new Error();
      const data = await res.json();
      // Use live transcript if backend transcript is empty/short
      if (liveTranscriptRef.current && (!data.transcript || data.transcript.length < liveTranscriptRef.current.length)) {
        data.transcript = liveTranscriptRef.current;
      }
      setResult(data); setStatus("done"); setActiveTab("transcript");
    } catch { setError("Error processing meeting."); setStatus("idle"); }
  };

  const handleDownloadPDF = () => {
    if (!result) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 16; const maxWidth = pageWidth - margin * 2; let y = 20;
    const addSection = (title, body) => {
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(16, 185, 129);
      doc.text(title, margin, y); y += 8;
      doc.setDrawColor(16, 185, 129); doc.line(margin, y, pageWidth - margin, y); y += 8;
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
      doc.splitTextToSize(body, maxWidth).forEach(line => { if (y > 275) { doc.addPage(); y = 20; } doc.text(line, margin, y); y += 6; }); y += 10;
    };
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("Meeting Highlights", margin, y); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y); y += 14;
    addSection("TRANSCRIPT", result.transcript || "");
    addSection("SUMMARY", result.summary || "");
    addSection("ACTION ITEMS", result.action_items?.map((item, i) => `${i + 1}. ${item}`).join("\n") || "No action items.");
    doc.save("meeting-highlights.pdf");
  };

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  return (
    <Layout>
      {status === "processing" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(241,245,249,0.95)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "36px" }}>
          <div style={{ position: "relative", width: "120px", height: "120px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#10b981", borderRightColor: "#10b981", animation: "spin 1s linear infinite" }} />
            <div style={{ position: "absolute", inset: "12px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#f59e0b", borderLeftColor: "#f59e0b", animation: "spin 1.4s linear infinite reverse" }} />
            <div style={{ position: "absolute", inset: "24px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#38bdf8", borderRightColor: "#38bdf8", animation: "spin 1.8s linear infinite" }} />
            <div style={{ position: "absolute", inset: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", animation: "breathe 2s ease-in-out infinite" }}>🎙️</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "260px" }}>
            {[{ label: "Extracting audio", icon: "🎬", color: "#10b981" }, { label: "Transcribing speech", icon: "🎧", color: "#f59e0b" }, { label: "Generating highlights", icon: "✅", color: "#38bdf8" }].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#ffffff", borderRadius: "12px", padding: "12px 16px", border: `1px solid ${step.color}30`, animation: "slideUp 0.4s ease forwards", animationDelay: `${i * 0.15}s`, opacity: 0 }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{step.icon}</div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155", flex: 1 }}>{step.label}</span>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: step.color, animation: "pulse 1.2s infinite", animationDelay: `${i * 0.3}s` }} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>This may take a moment...</p>
        </div>
      )}

      {(status === "idle" || status === "recording") && (
        <div>
          <div style={{ marginBottom: "24px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px", marginBottom: "6px" }}>Live Meeting</h1>
            <p style={{ color: "#64748b", fontSize: "14px" }}>Record your meeting with live transcription of all participants.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", alignItems: "start" }}>
            {/* Webcam */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ position: "relative", background: "#0f172a", aspectRatio: "4/3" }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {status === "recording" && (
                  <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", alignItems: "center", gap: "7px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", borderRadius: "999px", padding: "5px 12px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
                    <span style={{ color: "#fff", fontSize: "12px", fontWeight: 700 }}>REC {fmt(seconds)}</span>
                  </div>
                )}
                {error && <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.85)" }}><p style={{ color: "#f87171", fontSize: "13px", textAlign: "center", padding: "20px" }}>{error}</p></div>}
              </div>
              <div style={{ padding: "18px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a", marginBottom: "2px" }}>{status === "recording" ? "Recording..." : "Ready"}</p>
                  <p style={{ fontSize: "11px", color: "#94a3b8" }}>{status === "recording" ? `${fmt(seconds)} elapsed` : "Click Start to begin"}</p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={toggleScreenShare} style={{ background: screenSharing ? "linear-gradient(135deg, #f59e0b, #d97706)" : "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 14px", fontSize: "12px", fontWeight: 700, color: screenSharing ? "#fff" : "#64748b", cursor: "pointer" }}>
                    {screenSharing ? "🖥️ Sharing" : "🖥️ Share"}
                  </button>
                  {status === "idle" ? (
                    <button onClick={startRecording} style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.35)" }}>▶ Start</button>
                  ) : (
                    <button onClick={stopRecording} style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: "10px", padding: "10px 20px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(239,68,68,0.35)" }}>⏹ Stop</button>
                  )}
                </div>
              </div>
            </div>

            {/* Live transcript */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", minHeight: "320px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", letterSpacing: "2px", textTransform: "uppercase" }}>Live Transcript</p>
                {status === "recording" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.2s infinite" }} />
                    <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 600 }}>Updates every 5s</span>
                  </div>
                )}
              </div>
              <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", fontSize: "13px", lineHeight: 1.8, color: "#334155", maxHeight: "260px" }}>
                {liveTranscript
                  ? <p style={{ whiteSpace: "pre-wrap" }}>{liveTranscript}</p>
                  : <p style={{ color: "#cbd5e1", fontStyle: "italic", fontSize: "13px" }}>{status === "recording" ? "Listening... first update in ~5 seconds." : "Start recording to see live transcript."}</p>}
              </div>
              {status === "recording" && (
                <div style={{ marginTop: "14px", display: "flex", gap: "6px" }}>
                  {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: "3px", borderRadius: "999px", background: "#10b981", animation: "wave 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "done" && result && (
        <div style={{ maxWidth: "700px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Meeting Highlights 🎉</h1>
              <p style={{ color: "#64748b", fontSize: "13px" }}>Your meeting has been processed successfully.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleDownloadPDF} style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>⬇ PDF</button>
              <button onClick={() => { setStatus("idle"); setResult(null); setSeconds(0); setLiveTranscript(""); startCamera(); }} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>↩ New</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "24px" }}>
            {[{ label: "Words", value: result.transcript?.split(" ").length || 0, icon: "📝" }, { label: "Summary", value: "Done", icon: "📋" }, { label: "Actions", value: result.action_items?.length || 0, icon: "✅" }].map((stat, i) => (
              <div key={i} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "22px", marginBottom: "8px" }}>{stat.icon}</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>{stat.value}</div>
                <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Tabs */}
          <div style={{ display: "flex", gap: "4px", background: "#e2e8f0", borderRadius: "14px", padding: "5px", marginBottom: "14px" }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px", borderRadius: "10px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", background: activeTab === tab.id ? "#ffffff" : "transparent", color: activeTab === tab.id ? "#0f172a" : "#64748b", boxShadow: activeTab === tab.id ? "0 2px 8px rgba(0,0,0,0.12)" : "none" }}>
                {tab.icon} {tab.label}
                {tab.id === "actions" && result.action_items?.length > 0 && <span style={{ background: activeTab === tab.id ? "rgba(16,185,129,0.2)" : "#cbd5e1", color: activeTab === tab.id ? "#10b981" : "#64748b", borderRadius: "999px", padding: "1px 8px", fontSize: "11px", fontWeight: 700 }}>{result.action_items.length}</span>}
              </button>
            ))}
          </div>

          {/* Content */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "28px", minHeight: "260px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "18px" }}>{tabs.find(t => t.id === activeTab)?.label}</p>
            {activeTab === "transcript" && <p style={{ color: "#334155", lineHeight: 1.9, fontSize: "14px", whiteSpace: "pre-wrap" }}>{result.transcript}</p>}
            {activeTab === "summary" && <p style={{ color: "#334155", lineHeight: 1.9, fontSize: "14px" }}>{result.summary}</p>}
            {activeTab === "actions" && (
              result.action_items?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {result.action_items.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px" }}>
                      <span style={{ minWidth: "26px", height: "26px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <span style={{ color: "#334155", fontSize: "14px", lineHeight: 1.7 }}>{item}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#94a3b8", fontSize: "14px" }}>No action items detected.</p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
