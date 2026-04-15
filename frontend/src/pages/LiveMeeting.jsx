import API_BASE from "../config";
import { useState, useRef, useEffect } from "react";
import Layout from "../components/Layout";
import { jsPDF } from "jspdf";
import InlineChat from "../components/InlineChat";

const tabs = [
  { id: "transcript", label: "Transcript", icon: "📝" },
  { id: "summary", label: "Summary", icon: "📋" },
  { id: "actions", label: "Action Items", icon: "✅" },
];

export default function LiveMeeting() {
  const [status, setStatus] = useState("idle");
  const [seconds, setSeconds] = useState(0);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [screenSharing, setScreenSharing] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");

  const videoRef = useRef(null);
  const transcriptRef = useRef(null);
  const streamRef = useRef(null);
  const timerRef = useRef(null);
  const recognitionRef = useRef(null);
  const liveTranscriptRef = useRef("");
  const screenStreamRef = useRef(null);

  useEffect(() => { startCamera(); return () => cleanup(); }, []);

  useEffect(() => {
    liveTranscriptRef.current = liveTranscript;
    if (transcriptRef.current)
      transcriptRef.current.scrollTop = transcriptRef.current.scrollHeight;
  }, [liveTranscript]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      streamRef.current = stream;
      if (videoRef.current) videoRef.current.srcObject = stream;
    } catch {
      setError("Camera/microphone access denied.");
    }
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      setScreenSharing(false);
      return;
    }
    try {
      const screen = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: true });
      screenStreamRef.current = screen;
      screen.getVideoTracks()[0].onended = () => { setScreenSharing(false); screenStreamRef.current = null; };
      setScreenSharing(true);
    } catch {}
  };

  const cleanup = () => {
    streamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    clearInterval(timerRef.current);
    stopSpeechRecognition();
  };

  const startSpeechRecognition = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("Speech recognition not supported in this browser. Use Chrome.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (e) => {
      let interim = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const transcript = e.results[i][0].transcript;
        if (e.results[i].isFinal) {
          setLiveTranscript(prev => {
            const updated = prev ? prev + " " + transcript.trim() : transcript.trim();
            liveTranscriptRef.current = updated;
            return updated;
          });
          setInterimText("");
        } else {
          interim += transcript;
        }
      }
      setInterimText(interim);
    };

    recognition.onerror = (e) => {
      if (e.error !== "no-speech") console.warn("Speech recognition error:", e.error);
    };

    // Auto-restart on end while still recording
    recognition.onend = () => {
      if (recognitionRef.current === recognition) recognition.start();
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const stopSpeechRecognition = () => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null; // prevent auto-restart
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setInterimText("");
  };

  const startRecording = () => {
    setStatus("recording");
    setSeconds(0);
    setLiveTranscript("");
    setInterimText("");
    liveTranscriptRef.current = "";
    timerRef.current = setInterval(() => setSeconds(s => s + 1), 1000);
    startSpeechRecognition();
  };

  const stopRecording = async () => {
    clearInterval(timerRef.current);
    stopSpeechRecognition();
    setStatus("processing");

    const transcript = liveTranscriptRef.current.trim();
    if (!transcript) {
      setError("No speech detected. Please try again.");
      setStatus("idle");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/process-live`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ transcript }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setResult(data);
      setStatus("done");
      setActiveTab("transcript");
    } catch {
      setError("Error processing meeting.");
      setStatus("idle");
    }
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
      doc.splitTextToSize(body, maxWidth).forEach(line => {
        if (y > 275) { doc.addPage(); y = 20; }
        doc.text(line, margin, y); y += 6;
      }); y += 10;
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
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#006BBB", borderRightColor: "#006BBB", animation: "spin 1s linear infinite" }} />
            <div style={{ position: "absolute", inset: "12px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#FFC872", borderLeftColor: "#FFC872", animation: "spin 1.4s linear infinite reverse" }} />
            <div style={{ position: "absolute", inset: "24px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#30A0E0", borderRightColor: "#30A0E0", animation: "spin 1.8s linear infinite" }} />
            <div style={{ position: "absolute", inset: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #006BBB, #30A0E0)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", animation: "breathe 2s ease-in-out infinite" }}>🎙️</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "260px" }}>
            {[{ label: "Processing transcript", icon: "📝", color: "#006BBB" }, { label: "Generating summary", icon: "📋", color: "#FFC872" }, { label: "Extracting action items", icon: "✅", color: "#30A0E0" }].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#ffffff", borderRadius: "12px", padding: "12px 16px", border: `1px solid ${step.color}30`, animation: "slideUp 0.4s ease forwards", animationDelay: `${i * 0.15}s`, opacity: 0 }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{step.icon}</div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#1A3A52", flex: 1 }}>{step.label}</span>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: step.color, animation: "pulse 1.2s infinite", animationDelay: `${i * 0.3}s` }} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: "13px", color: "#5A8FA8", fontWeight: 500 }}>This may take a moment...</p>
        </div>
      )}

      {(status === "idle" || status === "recording") && (
        <div>
          <div style={{ marginBottom: "16px" }}>
            <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#001F3F", letterSpacing: "-0.5px", marginBottom: "4px" }}>Live Meeting</h1>
            <p style={{ color: "#3A6B85", fontSize: "13px" }}>Record your meeting with real-time transcription.</p>
          </div>

          {/* Always single column — video top, transcript bottom */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Webcam */}
            <div style={{ background: "#ffffff", border: "1px solid #D6EAF8", borderRadius: "16px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
              <div style={{ position: "relative", background: "#001F3F", aspectRatio: "4/3" }}>
                <video ref={videoRef} autoPlay muted playsInline style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {status === "recording" && (
                  <div style={{ position: "absolute", top: "10px", left: "10px", display: "flex", alignItems: "center", gap: "6px", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", borderRadius: "999px", padding: "4px 10px" }}>
                    <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#ef4444", animation: "pulse 1s infinite" }} />
                    <span style={{ color: "#fff", fontSize: "12px", fontWeight: 700 }}>REC {fmt(seconds)}</span>
                  </div>
                )}
                {error && (
                  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(15,23,42,0.85)" }}>
                    <p style={{ color: "#f87171", fontSize: "13px", textAlign: "center", padding: "20px" }}>{error}</p>
                  </div>
                )}
              </div>
              {/* Buttons row */}
              <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
                <div>
                  <p style={{ fontSize: "13px", fontWeight: 600, color: "#001F3F", marginBottom: "2px" }}>{status === "recording" ? "Recording..." : "Ready"}</p>
                  <p style={{ fontSize: "11px", color: "#5A8FA8" }}>{status === "recording" ? `${fmt(seconds)} elapsed` : "Tap Start to begin"}</p>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button onClick={toggleScreenShare} style={{ background: screenSharing ? "linear-gradient(135deg, #FFC872, #E6A830)" : "#EBF5FF", border: "1px solid #D6EAF8", borderRadius: "10px", padding: "12px 14px", fontSize: "13px", fontWeight: 700, color: screenSharing ? "#fff" : "#3A6B85", cursor: "pointer" }}>
                    🖥️
                  </button>
                  {status === "idle" ? (
                    <button onClick={startRecording} style={{ background: "linear-gradient(135deg, #006BBB, #30A0E0)", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,107,187,0.35)" }}>▶ Start</button>
                  ) : (
                    <button onClick={stopRecording} style={{ background: "linear-gradient(135deg, #ef4444, #dc2626)", border: "none", borderRadius: "10px", padding: "12px 24px", fontSize: "14px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(239,68,68,0.35)" }}>⏹ Stop</button>
                  )}
                </div>
              </div>
            </div>

            {/* Live transcript */}
            <div style={{ background: "#ffffff", border: "1px solid #D6EAF8", borderRadius: "16px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", minHeight: "200px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                <p style={{ fontSize: "10px", fontWeight: 700, color: "#5A8FA8", letterSpacing: "2px", textTransform: "uppercase" }}>Live Transcript</p>
                {status === "recording" && (
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#006BBB", animation: "pulse 1.2s infinite" }} />
                    <span style={{ fontSize: "11px", color: "#006BBB", fontWeight: 600 }}>Listening...</span>
                  </div>
                )}
              </div>
              <div ref={transcriptRef} style={{ flex: 1, overflowY: "auto", fontSize: "14px", lineHeight: 1.8, color: "#1A3A52", maxHeight: "220px" }}>
                {(liveTranscript || interimText) ? (
                  <p style={{ whiteSpace: "pre-wrap" }}>
                    {liveTranscript}
                    {interimText && <span style={{ color: "#5A8FA8", fontStyle: "italic" }}>{liveTranscript ? " " : ""}{interimText}</span>}
                  </p>
                ) : (
                  <p style={{ color: "#A8CFEA", fontStyle: "italic", fontSize: "13px" }}>
                    {status === "recording" ? "Listening... start speaking." : "Start recording to see live transcript."}
                  </p>
                )}
              </div>
              {status === "recording" && (
                <div style={{ marginTop: "12px", display: "flex", gap: "6px" }}>
                  {[0, 1, 2, 3].map(i => <div key={i} style={{ flex: 1, height: "3px", borderRadius: "999px", background: "#006BBB", animation: "wave 1s ease-in-out infinite", animationDelay: `${i * 0.15}s` }} />)}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {status === "done" && result && (
        <div style={{ maxWidth: "700px" }}>
          <InlineChat transcript={result.transcript} meetingName="Live Meeting" />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#001F3F", marginBottom: "4px" }}>Meeting Highlights 🎉</h1>
              <p style={{ color: "#3A6B85", fontSize: "13px" }}>Your meeting has been processed successfully.</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleDownloadPDF} style={{ background: "linear-gradient(135deg, #006BBB, #30A0E0)", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(0,107,187,0.3)" }}>⬇ PDF</button>
              <button onClick={() => { setStatus("idle"); setResult(null); setSeconds(0); setLiveTranscript(""); setError(null); startCamera(); }} style={{ background: "#EBF5FF", border: "1px solid #D6EAF8", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, color: "#3A6B85", cursor: "pointer" }}>↩ New</button>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "24px" }}>
            {[{ label: "Words", value: result.transcript?.split(" ").length || 0, icon: "📝" }, { label: "Summary", value: "Done", icon: "📋" }, { label: "Actions", value: result.action_items?.length || 0, icon: "✅" }].map((stat, i) => (
              <div key={i} style={{ background: "#ffffff", border: "1px solid #D6EAF8", borderRadius: "16px", padding: "20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
                <div style={{ fontSize: "22px", marginBottom: "8px" }}>{stat.icon}</div>
                <div style={{ fontSize: "24px", fontWeight: 800, color: "#001F3F" }}>{stat.value}</div>
                <div style={{ fontSize: "11px", color: "#3A6B85", fontWeight: 600, marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
              </div>
            ))}
          </div>

          <div style={{ display: "flex", gap: "4px", background: "#D6EAF8", borderRadius: "14px", padding: "5px", marginBottom: "14px" }}>
            {tabs.map((tab) => (
              <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", padding: "11px", borderRadius: "10px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", background: activeTab === tab.id ? "#ffffff" : "transparent", color: activeTab === tab.id ? "#001F3F" : "#3A6B85", boxShadow: activeTab === tab.id ? "0 2px 8px rgba(0,0,0,0.12)" : "none" }}>
                {tab.icon} {tab.label}
                {tab.id === "actions" && result.action_items?.length > 0 && (
                  <span style={{ background: activeTab === tab.id ? "rgba(0,107,187,0.15)" : "#A8CFEA", color: activeTab === tab.id ? "#006BBB" : "#3A6B85", borderRadius: "999px", padding: "1px 8px", fontSize: "11px", fontWeight: 700 }}>{result.action_items.length}</span>
                )}
              </button>
            ))}
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #D6EAF8", borderRadius: "20px", padding: "28px", minHeight: "260px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <p style={{ fontSize: "10px", fontWeight: 700, color: "#5A8FA8", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "18px" }}>{tabs.find(t => t.id === activeTab)?.label}</p>
            {activeTab === "transcript" && <p style={{ color: "#1A3A52", lineHeight: 1.9, fontSize: "14px", whiteSpace: "pre-wrap" }}>{result.transcript}</p>}
            {activeTab === "summary" && <p style={{ color: "#1A3A52", lineHeight: 1.9, fontSize: "14px" }}>{result.summary}</p>}
            {activeTab === "actions" && (
              result.action_items?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {result.action_items.map((item, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", background: "#F5FAFF", border: "1px solid #D6EAF8", borderRadius: "12px", padding: "14px 16px" }}>
                      <span style={{ minWidth: "26px", height: "26px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #006BBB, #30A0E0)", color: "#fff", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <span style={{ color: "#1A3A52", fontSize: "14px", lineHeight: 1.7 }}>{item}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#5A8FA8", fontSize: "14px" }}>No action items detected.</p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}

