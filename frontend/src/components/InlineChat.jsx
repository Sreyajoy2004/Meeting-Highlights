import API_BASE from "../config";
import { useState, useRef, useEffect } from "react";

export default function InlineChat({ transcript, meetingName }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const messagesRef = useRef([]);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    messagesRef.current = messages;
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleOpen = () => {
    setOpen(true);
    if (messages.length === 0) {
      setMessages([{
        role: "assistant",
        text: `Hi! Ask me anything about "${meetingName || "this meeting"}" transcript.`,
        citations: []
      }]);
    }
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleAsk = async () => {
    if (!question.trim() || loading) return;
    const q = question.trim();
    setQuestion("");
    setMessages(prev => [...prev, { role: "user", text: q }]);
    setLoading(true);

    const history = messagesRef.current
      .slice(1)
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

  return (
    <>
      {/* Floating chat button — clean blue with chat SVG icon */}
      <button
        onClick={handleOpen}
        title="Ask about this transcript"
        style={{
          position: "fixed", bottom: "28px", right: "28px", zIndex: 900,
          width: "52px", height: "52px", borderRadius: "14px", border: "none",
          background: "#006BBB",
          color: "#fff", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,107,187,0.4)",
          display: "flex", alignItems: "center", justifyContent: "center",
          transition: "background 0.2s, transform 0.2s",
        }}
        onMouseEnter={e => { e.currentTarget.style.background = "#30A0E0"; e.currentTarget.style.transform = "scale(1.06)"; }}
        onMouseLeave={e => { e.currentTarget.style.background = "#006BBB"; e.currentTarget.style.transform = "scale(1)"; }}
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white"/>
          <circle cx="8" cy="11" r="1.2" fill="#006BBB"/>
          <circle cx="12" cy="11" r="1.2" fill="#006BBB"/>
          <circle cx="16" cy="11" r="1.2" fill="#006BBB"/>
        </svg>
      </button>

      {/* Chat panel */}
      {open && (
        <div style={{
          position: "fixed", bottom: "92px", right: "28px", zIndex: 901,
          width: "380px", height: "520px", background: "#ffffff",
          borderRadius: "16px", boxShadow: "0 12px 40px rgba(0,31,63,0.18)",
          border: "1px solid #D6EAF8", display: "flex", flexDirection: "column",
          overflow: "hidden"
        }}>
          {/* Header */}
          <div style={{ padding: "14px 18px", background: "linear-gradient(135deg, #006BBB, #30A0E0)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "32px", height: "32px", borderRadius: "8px", background: "rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M20 2H4C2.9 2 2 2.9 2 4V22L6 18H20C21.1 18 22 17.1 22 16V4C22 2.9 21.1 2 20 2Z" fill="white"/>
                </svg>
              </div>
              <div>
                <p style={{ fontSize: "13px", fontWeight: 700, color: "#fff", margin: 0 }}>Ask about this transcript</p>
                <p style={{ fontSize: "10px", color: "rgba(255,255,255,0.8)", margin: 0 }}>{meetingName || "Meeting"}</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} style={{ background: "rgba(255,255,255,0.2)", border: "none", borderRadius: "8px", color: "#fff", width: "28px", height: "28px", cursor: "pointer", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>✕</button>
          </div>

          {/* Messages */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px", display: "flex", flexDirection: "column", gap: "12px", background: "#F5FAFF" }}>
            {messages.map((msg, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: msg.role === "user" ? "flex-end" : "flex-start" }}>
                <div style={{
                  maxWidth: "88%", padding: "10px 14px", fontSize: "13px", lineHeight: 1.6, whiteSpace: "pre-wrap",
                  borderRadius: msg.role === "user" ? "14px 14px 4px 14px" : "14px 14px 14px 4px",
                  background: msg.role === "user" ? "linear-gradient(135deg, #006BBB, #30A0E0)" : "#ffffff",
                  color: msg.role === "user" ? "#fff" : "#1A3A52",
                  border: msg.role === "assistant" ? "1px solid #D6EAF8" : "none",
                  boxShadow: "0 1px 4px rgba(0,31,63,0.08)"
                }}>
                  {msg.text}
                </div>
                {/* Citations */}
                {msg.citations?.length > 0 && (
                  <div style={{ maxWidth: "88%", marginTop: "6px", display: "flex", flexDirection: "column", gap: "4px" }}>
                    <p style={{ fontSize: "10px", fontWeight: 700, color: "#5A8FA8", textTransform: "uppercase", letterSpacing: "0.5px", margin: "0 0 2px 2px" }}>📎 Sources</p>
                    {msg.citations.map((c, ci) => (
                      <div key={ci} style={{ background: "#EBF5FF", border: "1px solid #C8E6F8", borderRadius: "8px", padding: "7px 10px" }}>
                        <span style={{ fontSize: "11px", color: "#1A3A52", lineHeight: 1.5 }}>
                          <span style={{ fontWeight: 700, color: "#006BBB" }}>{c.source_line}</span>
                          {c.timestamp && <span style={{ marginLeft: "6px", background: "rgba(0,107,187,0.1)", color: "#006BBB", borderRadius: "4px", padding: "1px 5px", fontSize: "10px", fontWeight: 700, fontFamily: "monospace" }}>{c.timestamp}</span>}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: "5px", padding: "10px 14px", background: "#ffffff", borderRadius: "14px 14px 14px 4px", width: "fit-content", border: "1px solid #D6EAF8" }}>
                {[0, 1, 2].map(i => <div key={i} style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#006BBB", animation: "pulse 1.2s infinite", animationDelay: `${i * 0.2}s` }} />)}
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div style={{ padding: "10px 12px", borderTop: "1px solid #D6EAF8", display: "flex", gap: "8px", alignItems: "flex-end", background: "#ffffff" }}>
            <textarea
              ref={inputRef}
              value={question}
              onChange={e => setQuestion(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask a question... (Enter to send)"
              rows={1}
              style={{ flex: 1, border: "1px solid #D6EAF8", borderRadius: "10px", padding: "9px 12px", fontSize: "13px", color: "#1A3A52", resize: "none", outline: "none", lineHeight: 1.5, fontFamily: "inherit", background: "#F5FAFF" }}
            />
            <button
              onClick={handleAsk}
              disabled={!question.trim() || loading}
              style={{ width: "34px", height: "34px", borderRadius: "10px", border: "none", background: question.trim() && !loading ? "#006BBB" : "#D6EAF8", color: question.trim() && !loading ? "#fff" : "#5A8FA8", cursor: question.trim() && !loading ? "pointer" : "not-allowed", fontSize: "14px", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.2s" }}
            >
              ➤
            </button>
          </div>
        </div>
      )}
    </>
  );
}
