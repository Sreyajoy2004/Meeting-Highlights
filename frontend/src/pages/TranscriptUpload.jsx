import API_BASE from "../config";
import { useState } from "react";
import Layout from "../components/Layout";
import { jsPDF } from "jspdf";
import InlineChat from "../components/InlineChat";

export default function TranscriptUpload() {
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [status, setStatus] = useState("idle");
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState("actions");

  const handleDrop = (e) => {
    e.preventDefault(); setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) { setFile(f); setResult(null); setError(null); }
  };

  const handleSubmit = async () => {
    if (!file) return;
    const formData = new FormData();
    formData.append("file", file);
    try {
      setStatus("processing"); setResult(null); setError(null);
      const res = await fetch(`${API_BASE}/process-transcript`, { method: "POST", body: formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || "Server error");
      setResult(data); setStatus("done"); setActiveTab("actions");
    } catch (err) {
      setError(err.message); setStatus("idle");
    }
  };

  const handleReset = () => { setFile(null); setResult(null); setError(null); setStatus("idle"); };

  const exportCSV = () => {
    const rows = [["#", "Person", "Task", "Deadline"]];
    result.action_items.forEach((item, i) =>
      rows.push([i + 1, item.person, item.task, item.deadline])
    );
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "action-items.csv"; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const margin = 16; const pageWidth = doc.internal.pageSize.getWidth(); const maxWidth = pageWidth - margin * 2;
    let y = 20;

    const addSection = (title, lines) => {
      doc.setFontSize(13); doc.setFont("helvetica", "bold"); doc.setTextColor(16, 185, 129);
      doc.text(title, margin, y); y += 8;
      doc.setDrawColor(16, 185, 129); doc.line(margin, y, pageWidth - margin, y); y += 8;
      doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(50, 50, 50);
      lines.forEach(line => {
        doc.splitTextToSize(line, maxWidth).forEach(l => { if (y > 275) { doc.addPage(); y = 20; } doc.text(l, margin, y); y += 6; });
      });
      y += 10;
    };

    doc.setFontSize(18); doc.setFont("helvetica", "bold"); doc.setTextColor(15, 23, 42);
    doc.text("Transcript Analysis", margin, y); y += 6;
    doc.setFontSize(9); doc.setFont("helvetica", "normal"); doc.setTextColor(100, 116, 139);
    doc.text(`Generated on ${new Date().toLocaleString()}`, margin, y); y += 14;

    addSection("DECISIONS", result.decisions?.length ? result.decisions.map((d, i) => `${i + 1}. ${d}`) : ["No decisions found."]);
    addSection("ACTION ITEMS", result.action_items?.length
      ? result.action_items.map((a, i) => `${i + 1}. ${a.person} — ${a.task} (By: ${a.deadline})`)
      : ["No action items found."]);

    doc.save("transcript-analysis.pdf");
  };

  const tabs = [
    { id: "actions", label: "Action Items", icon: "✅" },
    { id: "decisions", label: "Decisions", icon: "🤝" },
    { id: "transcript", label: "Transcript", icon: "📝" },
  ];

  return (
    <Layout>
      {status === "processing" && (
        <div style={{ position: "fixed", inset: 0, zIndex: 999, background: "rgba(241,245,249,0.95)", backdropFilter: "blur(8px)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: "36px" }}>
          <div style={{ position: "relative", width: "120px", height: "120px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#10b981", borderRightColor: "#10b981", animation: "spin 1s linear infinite" }} />
            <div style={{ position: "absolute", inset: "12px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#f59e0b", borderLeftColor: "#f59e0b", animation: "spin 1.4s linear infinite reverse" }} />
            <div style={{ position: "absolute", inset: "24px", borderRadius: "50%", border: "3px solid transparent", borderTopColor: "#38bdf8", borderRightColor: "#38bdf8", animation: "spin 1.8s linear infinite" }} />
            <div style={{ position: "absolute", inset: "36px", borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "22px", animation: "breathe 2s ease-in-out infinite" }}>📄</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", width: "260px" }}>
            {[{ label: "Reading transcript", icon: "📄", color: "#10b981" }, { label: "Extracting decisions", icon: "🤝", color: "#f59e0b" }, { label: "Finding action items", icon: "✅", color: "#38bdf8" }].map((step, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "12px", background: "#ffffff", borderRadius: "12px", padding: "12px 16px", border: `1px solid ${step.color}30`, animation: "slideUp 0.4s ease forwards", animationDelay: `${i * 0.15}s`, opacity: 0 }}>
                <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: `${step.color}18`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "15px" }}>{step.icon}</div>
                <span style={{ fontSize: "13px", fontWeight: 600, color: "#334155", flex: 1 }}>{step.label}</span>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: step.color, animation: "pulse 1.2s infinite", animationDelay: `${i * 0.3}s` }} />
              </div>
            ))}
          </div>
          <p style={{ fontSize: "13px", color: "#94a3b8", fontWeight: 500 }}>Analyzing your transcript...</p>
        </div>
      )}

      {status !== "done" && (
        <div style={{ maxWidth: "600px" }}>
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px", marginBottom: "6px" }}>Transcript Upload</h1>
            <p style={{ color: "#64748b", fontSize: "14px" }}>Upload a .txt or .vtt transcript to extract decisions and action items.</p>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <label onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={handleDrop}
              style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", marginBottom: "20px", border: `2px dashed ${dragOver ? "#10b981" : "#cbd5e1"}`, borderRadius: "14px", padding: "48px 24px", background: dragOver ? "rgba(16,185,129,0.04)" : "#f8fafc", transition: "all 0.2s" }}>
              <input type="file" accept=".txt,.vtt" style={{ display: "none" }} onChange={(e) => { setFile(e.target.files[0]); setResult(null); setError(null); }} />
              <div style={{ width: "60px", height: "60px", borderRadius: "16px", marginBottom: "16px", background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(56,189,248,0.08))", border: "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "26px" }}>📄</div>
              {file ? (
                <><p style={{ color: "#10b981", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{file.name}</p><p style={{ color: "#94a3b8", fontSize: "12px" }}>{(file.size / 1024).toFixed(1)} KB · Ready</p></>
              ) : (
                <><p style={{ color: "#334155", fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>Drop your transcript here</p><p style={{ color: "#94a3b8", fontSize: "12px" }}>.TXT or .VTT · or click to browse</p></>
              )}
            </label>
            {error && <p style={{ color: "#ef4444", fontSize: "13px", marginBottom: "12px", background: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", padding: "10px 14px" }}>⚠ {error}</p>}
            <button onClick={handleSubmit} disabled={!file} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", fontSize: "14px", fontWeight: 700, cursor: file ? "pointer" : "not-allowed", background: file ? "linear-gradient(135deg, #10b981, #059669)" : "#e2e8f0", color: file ? "#fff" : "#94a3b8", boxShadow: file ? "0 6px 20px rgba(16,185,129,0.3)" : "none", transition: "all 0.2s" }}>
              🔍 Analyze Transcript
            </button>
          </div>
        </div>
      )}

      {status === "done" && result && (
        <div style={{ maxWidth: "800px" }}>
          <InlineChat transcript={result.transcript} meetingName={result.filename} />
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "24px" }}>
            <div>
              <h1 style={{ fontSize: "24px", fontWeight: 800, color: "#0f172a", marginBottom: "4px" }}>Transcript Analysis</h1>
              <p style={{ color: "#64748b", fontSize: "13px" }}>{result.filename}</p>
            </div>
            <div style={{ display: "flex", gap: "10px" }}>
              <button onClick={exportCSV} style={{ background: "linear-gradient(135deg, #38bdf8, #0284c7)", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(56,189,248,0.3)" }}>⬇ CSV</button>
              <button onClick={exportPDF} style={{ background: "linear-gradient(135deg, #10b981, #059669)", border: "none", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 700, color: "#fff", cursor: "pointer", boxShadow: "0 4px 12px rgba(16,185,129,0.3)" }}>⬇ PDF</button>
              <button onClick={handleReset} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "10px 18px", fontSize: "13px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>↩ New File</button>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "14px", marginBottom: "24px" }}>
            {[
              { label: "Action Items", value: result.action_items?.length || 0, icon: "✅", color: "#10b981" },
              { label: "Decisions", value: result.decisions?.length || 0, icon: "🤝", color: "#f59e0b" },
              { label: "Words", value: result.transcript?.split(" ").length || 0, icon: "📝", color: "#38bdf8" },
            ].map((stat, i) => (
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
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "28px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>

            {activeTab === "actions" && (
              result.action_items?.length > 0 ? (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ background: "linear-gradient(135deg, #f0fdf4, #f8fafc)" }}>
                        {["#", "Person", "Task", "Deadline"].map((h) => (
                          <th key={h} style={{ padding: "12px 16px", textAlign: "left", fontWeight: 700, color: "#475569", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.5px", borderBottom: "2px solid #e2e8f0" }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {result.action_items.map((item, i) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.15s" }}
                          onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                          onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ minWidth: "24px", height: "24px", borderRadius: "50%", background: "linear-gradient(135deg, #10b981, #059669)", color: "#fff", fontSize: "11px", fontWeight: 800, display: "inline-flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                          </td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ background: "rgba(16,185,129,0.1)", color: "#059669", borderRadius: "999px", padding: "4px 10px", fontSize: "12px", fontWeight: 700 }}>{item.person}</span>
                          </td>
                          <td style={{ padding: "14px 16px", color: "#334155", lineHeight: 1.6 }}>{item.task}</td>
                          <td style={{ padding: "14px 16px" }}>
                            <span style={{ background: item.deadline === "Not specified" ? "#f1f5f9" : "rgba(245,158,11,0.1)", color: item.deadline === "Not specified" ? "#94a3b8" : "#d97706", borderRadius: "8px", padding: "4px 10px", fontSize: "12px", fontWeight: 600 }}>{item.deadline}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : <p style={{ color: "#94a3b8", fontSize: "14px" }}>No action items detected.</p>
            )}

            {activeTab === "decisions" && (
              result.decisions?.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {result.decisions.map((d, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: "14px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px" }}>
                      <span style={{ minWidth: "26px", height: "26px", borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg, #f59e0b, #d97706)", color: "#fff", fontSize: "11px", fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>{i + 1}</span>
                      <span style={{ color: "#334155", fontSize: "14px", lineHeight: 1.7 }}>{d}</span>
                    </div>
                  ))}
                </div>
              ) : <p style={{ color: "#94a3b8", fontSize: "14px" }}>No decisions detected.</p>
            )}

            {activeTab === "transcript" && (
              <p style={{ color: "#334155", lineHeight: 1.9, fontSize: "14px", whiteSpace: "pre-wrap" }}>{result.transcript}</p>
            )}
          </div>
        </div>
      )}
    </Layout>
  );
}
