import React, { useState } from "react";
import axios from "axios";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import VideoToAudio from "./pages/VideoToAudio";
import LiveMeeting from "./pages/LiveMeeting";
import TranscriptUpload from "./pages/TranscriptUpload";
import ChatBot from "./pages/ChatBot";
import Layout from "./components/Layout";
import { jsPDF } from "jspdf";

const tabs = [
  { id: "transcript", label: "Transcript", icon: "📝" },
  { id: "summary", label: "Summary", icon: "📋" },
  { id: "actions", label: "Action Items", icon: "✅" },
];

const LoadingOverlay = ({ steps }) => (
  <div style={{
    position: "fixed", inset: 0, zIndex: 999,
    background: "rgba(241,245,249,0.95)", backdropFilter: "blur(8px)",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "36px"
  }}>
    <div style={{ position: "relative", width: "120px", height: "120px" }}>
      <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#10b981", borderRightColor: "#10b981", animation: "spin 1s linear infinite" }} />
      <div style={{ position: "absolute", inset: "12px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#f59e0b", borderLeftColor: "#f59e0b", animation: "spin 1.4s linear infinite reverse" }} />
      <div style={{ position: "absolute", inset: "24px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#38bdf8", borderRightColor: "#38bdf8", animation: "spin 1.8s linear infinite" }} />
      <div style={{ position: "absolute", inset: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", animation: "breathe 2s ease-in-out infinite" }}>🎙️</div>
    </div>
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "260px" }}>
      {steps.map((step, i) => (
        <div key={i} style={{
          display: "flex", alignItems: "center", gap: "12px",
          background: "#ffffff", borderRadius: "12px", padding: "12px 16px",
          border: `1px solid ${step.color}30`, boxShadow: `0 4px 16px ${step.color}15`,
          animation: "slideUp 0.4s ease forwards", animationDelay: `${i * 0.15}s`, opacity: 0
        }}>
          <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{step.icon}</div>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155", flex: 1 }}>{step.label}</span>
          <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: step.color, animation: "pulse 1.2s infinite", animationDelay: `${i * 0.3}s` }} />
        </div>
      ))}
    </div>
    <p style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>This may take a moment...</p>
  </div>
);

const ResultTabs = ({ result, activeTab, setActiveTab }) => (
  <div>
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "24px" }}>
      {[
        { label: "Words", value: result.transcript?.split(" ").length || 0, icon: "📝" },
        { label: "Summary", value: "Done", icon: "📋" },
        { label: "Actions", value: result.action_items?.length || 0, icon: "✅" },
      ].map((stat, i) => (
        <div key={i} style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "20px", textAlign: "center", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
          <div style={{ fontSize: "22px", marginBottom: "8px" }}>{stat.icon}</div>
          <div style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a" }}>{stat.value}</div>
          <div style={{ fontSize: "11px", color: "#64748b", fontWeight: 600, marginTop: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>{stat.label}</div>
        </div>
      ))}
    </div>
    <div style={{ display: "flex", gap: "4px", background: "#e2e8f0", borderRadius: "14px", padding: "5px", marginBottom: "14px" }}>
      {tabs.map((tab) => (
        <button key={tab.id} onClick={() => setActiveTab(tab.id)} style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          gap: "6px", padding: "11px", borderRadius: "10px", border: "none",
          fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s",
          background: activeTab === tab.id ? "#ffffff" : "transparent",
          color: activeTab === tab.id ? "#0f172a" : "#64748b",
          boxShadow: activeTab === tab.id ? "0 2px 8px rgba(0,0,0,0.12)" : "none",
        }}>
          {tab.icon} {tab.label}
          {tab.id === "actions" && result.action_items?.length > 0 && (
            <span style={{ background: activeTab === tab.id ? "rgba(16,185,129,0.2)" : "#cbd5e1", color: activeTab === tab.id ? "#10b981" : "#64748b", borderRadius: "999px", padding: "1px 8px", fontSize: "11px", fontWeight: 700 }}>{result.action_items.length}</span>
          )}
        </button>
      ))}
    </div>
    <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "28px", minHeight: "260px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
      <p style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "18px" }}>{tabs.find(t => t.id === activeTab)?.label}</p>
      {activeTab === "transcript" && <p style={{ color: "#334155", lineHeight: 1.9, fontSize: "14px", whiteSpace: "pre-wrap" }}>{result.transcript}</p>}
      {activeTab === "summary" && <p style={{ color: "#334155", lineHeight: 1.9, fontSize: "14px" }}>{result.summary}</p>}
      {activeTab === "actions" && (
        result.action_items?.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {result.action_items.map((item, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px" }}>
                <span style={{ minWidth: "26px", height: "26px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 4px 10px rgba(16,185,129,0.3)" }}>{i + 1}</span>
                <span style={{ color: "#334155", fontSize: "14px", lineHeight: 1.7 }}>{item}</span>
              </div>
            ))}
          </div>
        ) : <p style={{ color: "#94a3b8", fontSize: "14px" }}>No action items detected.</p>
      )}
    </div>
  </div>
);

function Home() {
  const [file, setFile] = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("transcript");
  const [dragOver, setDragOver] = useState(false);

  const handleUpload = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setLoading(true); setResult(null);
      const response = await axios.post("http://127.0.0.1:5000/process-audio", formData, { headers: { "Content-Type": "multipart/form-data" } });
      setResult(response.data); setActiveTab("transcript");
    } catch { alert("Error processing audio. Please try again."); }
    finally { setLoading(false); }
  };

  const handleDrop = (e) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) setFile(f); };

  const handleDownloadPDF = () => {
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
    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42); doc.text("Meeting Highlights", margin, y); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139); doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y); y += 14;
    addSection("TRANSCRIPT", result.transcript || "");
    addSection("SUMMARY", result.summary || "");
    addSection("ACTION ITEMS", result.action_items?.map((item, i) => `${i + 1}. ${item}`).join("\n") || "No action items.");
    doc.save(`${result.filename?.replace(/\.[^.]+$/, "") || "meeting"}-highlights.pdf`);
  };

  return (
    <Layout>
      {loading && <LoadingOverlay steps={[{ label: "Transcribing audio", icon: "🎧", color: "#10b981" }, { label: "Generating summary", icon: "📋", color: "#f59e0b" }, { label: "Extracting action items", icon: "✅", color: "#38bdf8" }]} />}

      {!result ? (
        <div style={{ maxWidth: "620px" }}>
          <div style={{ marginBottom: "32px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "999px", padding: "6px 14px", marginBottom: "16px" }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#10b981" }} />
              <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700, letterSpacing: "0.5px" }}>AI POWERED</span>
            </div>
            <h1 style={{ fontSize: "32px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.8px", marginBottom: "8px", lineHeight: 1.2 }}>Upload your meeting<br /><span style={{ background: "linear-gradient(135deg, #10b981, #059669)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>audio recording</span></h1>
            <p style={{ color: "#64748b", fontSize: "14px", lineHeight: 1.6 }}>Get a full transcript, smart summary, and action items in seconds.</p>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "24px", padding: "36px", boxShadow: "0 4px 24px rgba(0,0,0,0.06)" }}>
            <label onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: "24px", border: `2px dashed ${dragOver ? "#10b981" : "#e2e8f0"}`, borderRadius: "18px", padding: "52px 24px", background: dragOver ? "rgba(16,185,129,0.04)" : "#f8fafc", transition: "all 0.2s" }}>
              <input type="file" accept="audio/*" style={{ display: "none" }} onChange={(e) => setFile(e.target.files[0])} />
              <div style={{ width: "72px", height: "72px", borderRadius: "20px", marginBottom: "20px", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "30px", boxShadow: "0 8px 24px rgba(16,185,129,0.35)" }}>🎵</div>
              {file ? (
                <><p style={{ color: "#10b981", fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>{file.name}</p><p style={{ color: "#94a3b8", fontSize: "12px" }}>{(file.size / 1024 / 1024).toFixed(2)} MB · Ready to process</p></>
              ) : (
                <><p style={{ color: "#0f172a", fontWeight: 700, fontSize: "15px", marginBottom: "6px" }}>Drop your audio file here</p><p style={{ color: "#94a3b8", fontSize: "13px" }}>MP3, M4A, WAV, OGG · or click to browse</p></>
              )}
            </label>
            <button onClick={handleUpload} disabled={!file || loading} style={{ width: "100%", padding: "15px", borderRadius: "14px", border: "none", fontSize: "15px", fontWeight: 700, cursor: file && !loading ? "pointer" : "not-allowed", background: file && !loading ? "linear-gradient(135deg, #10b981, #059669)" : "#f1f5f9", color: file && !loading ? "#fff" : "#94a3b8", boxShadow: file && !loading ? "0 8px 24px rgba(16,185,129,0.35)" : "none", transition: "all 0.2s", letterSpacing: "0.2px" }}>
              🚀 Process Meeting
            </button>
          </div>
        </div>
      ) : (
        <div style={{ maxWidth: "700px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Meeting Highlights</h1>
              <p style={{ color: "#64748b", fontSize: "13px" }}>{result.filename}</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={handleDownloadPDF} style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>⬇ PDF</button>
              <button onClick={() => { setFile(null); setResult(null); }} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>↩ New</button>
            </div>
          </div>
          <ResultTabs result={result} activeTab={activeTab} setActiveTab={setActiveTab} />
        </div>
      )}
    </Layout>
  );
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/live" element={<LiveMeeting />} />
        <Route path="/video-audio" element={<VideoToAudio />} />
        <Route path="/transcript" element={<TranscriptUpload />} />
        <Route path="/chat" element={<ChatBot />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
