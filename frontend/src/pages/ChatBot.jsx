import API_BASE from "../config";
import { useState, useRef, useEffect } from "react";
import Layout from "../components/Layout";

export default function ChatBot() {
  const [transcript, setTranscript] = useState("");
  const [meetingName, setMeetingName] = useState("");
  const [question, setQuestion] = useState("");
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [expandedCitation, setExpandedCitation] = useState(null); // eslint-disable-line
  const [inputMode, setInputMode] = useState("file"); // "file" | "paste"
  const [dragOver, setDragOver] = useState(false);
  const [fileLoaded, setFileLoaded] = useState(null); // { name, words }
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  const messagesRef = useRef([]);

  useEffect(() => {
    messagesRef.current = messages;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const readFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["txt", "vtt", "pdf"].includes(ext)) {
      alert("Only .txt, .vtt and .pdf files are supported.");
      return;
    }

    if (ext === "pdf") {
      setFileLoaded({ name: file.name, words: null, loading: true });
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await fetch(`${API_BASE}/extract-pdf`, { method: "POST", body: formData });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to extract PDF");
        setTranscript(data.text);
        setFileLoaded({ name: file.name, words: data.text.trim().split(/\s+/).length, loading: false });
        if (!meetingName) setMeetingName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
      } catch (err) {
        alert(err.message);
        setFileLoaded(null);
      }
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      let text = e.target.result;
      if (ext === "vtt") {
        text = text
          .replace(/WEBVTT.*\n/g, "")
          .replace(/\d{2}:\d{2}[:.\d]+\s*-->.*\n/g, "")
          .replace(/^\d+\s*$/gm, "")
          .replace(/\n{2,}/g, "\n")
          .trim();
      }
      setTranscript(text);
      setFileLoaded({ name: file.name, words: text.trim().split(/\s+/).length, loading: false });
      if (!meetingName) setMeetingName(file.name.replace(/\.[^.]+$/, "").replace(/[-_]/g, " "));
    };
    reader.readAsText(file);
  };

  const handleStart = () => {
    if (!transcript.trim()) return;
    setReady(true);
    setMessages([{
      role: "assistant",
      text: `I've loaded the transcript for "${meetingName || "your meeting"}". Ask me anything about it — decisions, action items, speaker concerns, or any specific topic.`,
      citations: []
    }]);
  };

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);

    // Use ref to get latest messages — avoids stale closure bug
    const currentMessages = messagesRef.current;
    const history = currentMessages
      .slice(1) // skip welcome message
      .filter(m => m.role === "user" || m.role === "assistant")
      .map(m => ({ role: m.role, content: m.text }));

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, transcript, meeting_name: meetingName || "Meeting", history })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Server error");
      setMessages(prev => [...prev, { role: "assistant", text: data.answer, citations: data.citations || [] }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: "assistant", text: `⚠️ ${err.message}`, citations: [] }]);
    } finally {
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAsk(); }
  };

  const handleReset = () => {
    setReady(false); setMessages([]); setTranscript(""); setMeetingName(""); setQuestion("");
    setFileLoaded(null); setInputMode("file");
  };

  const suggestedQuestions = [
    "What decisions were made in this meeting?",
    "What action items were assigned?",
    "What concerns were raised?",
    "Who is responsible for what tasks?",
  ];

  return (
    <Layout>
      {!ready ? (
        /* ── Setup screen ── */
        <div style={{ maxWidth: "640px" }}>
          <div style={{ marginBottom: "28px" }}>
            <h1 style={{ fontSize: "28px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.5px", marginBottom: "6px" }}>Transcript Chatbot</h1>
            <p style={{ color: "#64748b", fontSize: "14px" }}>Upload or paste a meeting transcript and ask natural language questions with cited answers.</p>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "20px", padding: "32px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)", display: "flex", flexDirection: "column", gap: "18px" }}>

            {/* Mode toggle */}
            <div style={{ display: "flex", background: "#f1f5f9", borderRadius: "10px", padding: "4px", gap: "4px" }}>
              {[{ id: "file", label: "📁 Upload File" }, { id: "paste", label: "📋 Paste Text" }].map(m => (
                <button key={m.id} onClick={() => setInputMode(m.id)}
                  style={{ flex: 1, padding: "9px", borderRadius: "8px", border: "none", fontSize: "13px", fontWeight: 600, cursor: "pointer", transition: "all 0.2s", background: inputMode === m.id ? "#ffffff" : "transparent", color: inputMode === m.id ? "#0f172a" : "#64748b", boxShadow: inputMode === m.id ? "0 1px 4px rgba(0,0,0,0.1)" : "none" }}>
                  {m.label}
                </button>
              ))}
            </div>

            {/* File upload */}
            {inputMode === "file" && (
              <label
                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={e => { e.preventDefault(); setDragOver(false); readFile(e.dataTransfer.files[0]); }}
                style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", cursor: "pointer", border: `2px dashed ${dragOver ? "#10b981" : fileLoaded ? "#10b981" : "#cbd5e1"}`, borderRadius: "14px", padding: "40px 24px", background: dragOver ? "rgba(16,185,129,0.04)" : fileLoaded ? "#f0fdf4" : "#f8fafc", transition: "all 0.2s" }}>
                <input type="file" accept=".txt,.vtt,.pdf" style={{ display: "none" }} onChange={e => readFile(e.target.files[0])} />
                <div style={{ width: "56px", height: "56px", borderRadius: "14px", marginBottom: "14px", background: fileLoaded ? "linear-gradient(135deg, #10b981, #059669)" : "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(56,189,248,0.08))", border: fileLoaded ? "none" : "1px solid rgba(16,185,129,0.2)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "24px" }}>
                  {fileLoaded ? "✅" : "📄"}
                </div>
                  {fileLoaded?.loading ? (
                  <>
                    <p style={{ color: "#10b981", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>Extracting PDF text...</p>
                    <p style={{ color: "#059669", fontSize: "12px" }}>Please wait</p>
                  </>
                ) : fileLoaded ? (
                  <>
                    <p style={{ color: "#10b981", fontWeight: 700, fontSize: "14px", marginBottom: "4px" }}>{fileLoaded.name}</p>
                    <p style={{ color: "#059669", fontSize: "12px" }}>{fileLoaded.words.toLocaleString()} words loaded · Click to change</p>
                  </>
                ) : (
                  <>
                    <p style={{ color: "#334155", fontWeight: 600, fontSize: "14px", marginBottom: "4px" }}>Drop your file here</p>
                    <p style={{ color: "#94a3b8", fontSize: "12px" }}>.TXT, .VTT or .PDF · or click to browse</p>
                  </>
                )}
              </label>
            )}

            {/* Paste text */}
            {inputMode === "paste" && (
              <div>
                <textarea
                  value={transcript}
                  onChange={e => { setTranscript(e.target.value); setFileLoaded(null); }}
                  placeholder="Paste your meeting transcript here..."
                  rows={10}
                  style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: `1px solid ${transcript ? "#10b981" : "#e2e8f0"}`, fontSize: "13px", color: "#334155", outline: "none", resize: "vertical", lineHeight: 1.7, background: "#f8fafc", boxSizing: "border-box", transition: "border-color 0.2s", fontFamily: "inherit" }}
                />
                {transcript && (
                  <p style={{ fontSize: "11px", color: "#10b981", marginTop: "6px", fontWeight: 600 }}>✓ {transcript.trim().split(/\s+/).length.toLocaleString()} words</p>
                )}
              </div>
            )}

            {/* Meeting name */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", display: "block", marginBottom: "8px" }}>Meeting Name <span style={{ color: "#94a3b8", fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(optional)</span></label>
              <input
                value={meetingName}
                onChange={e => setMeetingName(e.target.value)}
                placeholder="e.g. Q3 Product Planning — Oct 2024"
                style={{ width: "100%", padding: "11px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", fontSize: "14px", color: "#0f172a", outline: "none", background: "#f8fafc", boxSizing: "border-box", fontFamily: "inherit" }}
              />
            </div>

            <button
              onClick={handleStart}
              disabled={!transcript.trim() || fileLoaded?.loading}
              style={{ padding: "14px", borderRadius: "12px", border: "none", fontSize: "14px", fontWeight: 700, cursor: transcript.trim() && !fileLoaded?.loading ? "pointer" : "not-allowed", background: transcript.trim() && !fileLoaded?.loading ? "linear-gradient(135deg, #10b981, #059669)" : "#e2e8f0", color: transcript.trim() && !fileLoaded?.loading ? "#fff" : "#94a3b8", boxShadow: transcript.trim() && !fileLoaded?.loading ? "0 6px 20px rgba(16,185,129,0.3)" : "none", transition: "all 0.2s" }}
            >
              💬 Start Chatting
            </button>
          </div>
        </div>
      ) : (
        /* ── Chat screen ── */
        <div style={{ maxWidth: "760px", display: "flex", flexDirection: "column", height: "calc(100vh - 136px)" }}>
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexShrink: 0 }}>
            <div>
              <h1 style={{ fontSize: "22px", fontWeight: 800, color: "#0f172a", marginBottom: "2px" }}>💬 {meetingName || "Meeting"}</h1>
              <p style={{ color: "#64748b", fontSize: "12px" }}>{transcript.trim().split(/\s+/).length} words · Ask anything about this transcript</p>
            </div>
            <button onClick={handleReset} style={{ background: "#f1f5f9", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "9px 16px", fontSize: "12px", fontWeight: 600, color: "#64748b", cursor: "pointer" }}>↩ New Transcript</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: "16px", paddingRight: "4px", marginBottom: "16px" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                {/* Bubble */}
                <div style={{
                  maxWidth: "85%",
                  background: msg.role === "user" ? "linear-gradient(135deg, #10b981, #059669)" : "#ffffff",
                  color: msg.role === "user" ? "#fff" : "#334155",
                  borderRadius: msg.role === "user" ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
                  padding: "14px 18px",
                  fontSize: "14px",
                  lineHeight: 1.7,
                  border: msg.role === "assistant" ? "1px solid #e2e8f0" : "none",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
                  whiteSpace: "pre-wrap"
                }}>
                  {msg.role === "assistant" && (
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                      <div style={{ width: "22px", height: "22px", borderRadius: "6px", background: "linear-gradient(135deg, #10b981, #059669)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px" }}>🤖</div>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", textTransform: "uppercase", letterSpacing: "0.5px" }}>AI Assistant</span>
                    </div>
                  )}
                  {msg.text}
                </div>

                {/* Citations */}
                {msg.citations?.length > 0 && (
                  <div style={{ maxWidth: "85%", marginTop: "8px", display: "flex", flexDirection: "column", gap: "6px" }}>
                    <p style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.5px", marginLeft: "4px" }}>📎 Sources</p>
                    {msg.citations.map((c, ci) => (
                      <div key={ci} style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "10px", padding: "10px 14px", display: "flex", alignItems: "flex-start", gap: "10px" }}>
                        <span style={{ fontSize: "13px", marginTop: "1px", flexShrink: 0 }}>–</span>
                        <span style={{ fontSize: "13px", color: "#334155", lineHeight: 1.6 }}>
                          <span style={{ fontWeight: 700, color: "#059669" }}>{c.source_line}</span>
                          {c.timestamp && (
                            <span style={{ marginLeft: "8px", background: "rgba(16,185,129,0.12)", color: "#10b981", borderRadius: "6px", padding: "1px 7px", fontSize: "11px", fontWeight: 700, fontFamily: "monospace" }}>{c.timestamp}</span>
                          )}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div style={{ display: "flex", alignItems: "flex-start" }}>
                <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "18px 18px 18px 4px", padding: "14px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)", display: "flex", gap: "6px", alignItems: "center" }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#10b981", animation: "pulse 1.2s infinite", animationDelay: `${i * 0.2}s` }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Suggested questions — only show when just started */}
          {messages.length === 1 && (
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px", flexShrink: 0 }}>
              {suggestedQuestions.map((sq, i) => (
                <button key={i} onClick={() => { setQuestion(sq); inputRef.current?.focus(); }}
                  style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "999px", padding: "7px 14px", fontSize: "12px", fontWeight: 600, color: "#059669", cursor: "pointer", transition: "all 0.2s" }}>
                  {sq}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div style={{ display: "flex", gap: "10px", flexShrink: 0, background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "16px", padding: "10px 12px", boxShadow: "0 2px 8px rgba(0,0,0,0.05)" }}>
            <textarea
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question about the transcript... (Enter to send)"
              rows={1}
              style={{ flex: 1, border: "none", outline: "none", fontSize: "14px", color: "#334155", resize: "none", lineHeight: 1.6, background: "transparent", fontFamily: "inherit" }}
            />
            <button
              onClick={handleAsk}
              disabled={!question.trim() || loading}
              style={{ alignSelf: "flex-end", width: "38px", height: "38px", borderRadius: "10px", border: "none", background: question.trim() && !loading ? "linear-gradient(135deg, #10b981, #059669)" : "#e2e8f0", color: question.trim() && !loading ? "#fff" : "#94a3b8", cursor: question.trim() && !loading ? "pointer" : "not-allowed", fontSize: "16px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s", boxShadow: question.trim() && !loading ? "0 4px 12px rgba(16,185,129,0.3)" : "none" }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}
