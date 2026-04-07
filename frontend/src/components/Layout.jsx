import { useLocation, Link } from "react-router-dom";

const navItems = [
  { path: "/", icon: "🎵", label: "Audio Upload", desc: "Upload & transcribe" },
  { path: "/video-audio", icon: "🎬", label: "Video Upload", desc: "Extract & analyze" },
  { path: "/live", icon: "🔴", label: "Live Meeting", desc: "Record & transcribe" },
  { path: "/transcript", icon: "📄", label: "Transcript Upload", desc: "Extract decisions & tasks" },
  { path: "/chat", icon: "💬", label: "Ask Transcript", desc: "Chat with your meetings" },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif", background: "#F0F7FF" }}>

      {/* Sidebar */}
      <aside style={{
        width: "248px", flexShrink: 0,
        background: "linear-gradient(180deg, #001F3F 0%, #003366 100%)",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 50,
        boxShadow: "4px 0 24px rgba(0,31,63,0.25)"
      }}>
        {/* Logo */}
        <div style={{ padding: "28px 20px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "44px", height: "44px", borderRadius: "12px",
              background: "linear-gradient(135deg, #006BBB, #30A0E0)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", boxShadow: "0 4px 16px rgba(0,107,187,0.5)", flexShrink: 0
            }}>🎙️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "16px", color: "#FFFFFF", letterSpacing: "-0.3px" }}>MeetingAI</div>
              <div style={{ fontSize: "10px", color: "#7EB8D8", fontWeight: 500, marginTop: "2px" }}>AI Meeting Assistant</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #30A0E0, transparent)", margin: "0 20px", opacity: 0.4 }} />

        {/* Nav */}
        <nav style={{ padding: "18px 12px", flex: 1 }}>
          <p style={{ fontSize: "9px", fontWeight: 700, color: "#7EB8D8", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px", paddingLeft: "10px" }}>Navigation</p>
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <Link key={item.path} to={item.path} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "11px 14px", borderRadius: "12px", marginBottom: "5px",
                textDecoration: "none", transition: "all 0.2s",
                background: active ? "linear-gradient(135deg, rgba(0,107,187,0.35), rgba(48,160,224,0.2))" : "transparent",
                border: active ? "1px solid rgba(48,160,224,0.5)" : "1px solid transparent",
                boxShadow: active ? "0 4px 16px rgba(0,107,187,0.2)" : "none",
              }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
                  background: active ? "linear-gradient(135deg, #006BBB, #30A0E0)" : "rgba(255,255,255,0.07)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", boxShadow: active ? "0 4px 10px rgba(0,107,187,0.4)" : "none"
                }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: active ? 700 : 500, color: active ? "#FFFFFF" : "#A8CFEA" }}>{item.label}</div>
                  <div style={{ fontSize: "10px", color: active ? "#FFC872" : "#4A7A9B", marginTop: "1px" }}>{item.desc}</div>
                </div>
                {active && <div style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "#FFC872", boxShadow: "0 0 8px #FFC872" }} />}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #30A0E0, transparent)", margin: "0 20px", opacity: 0.4 }} />

        {/* Status */}
        <div style={{ padding: "18px 20px" }}>
          <div style={{ background: "rgba(0,107,187,0.15)", border: "1px solid rgba(48,160,224,0.3)", borderRadius: "12px", padding: "12px 14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#FFC872", boxShadow: "0 0 8px #FFC872", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: "11px", color: "#FFC872", fontWeight: 700 }}>All Systems Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: "248px", flex: 1, minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{
          height: "64px", background: "#FFFFFF",
          borderBottom: "2px solid #E8F4FD",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 36px", position: "sticky", top: 0, zIndex: 40,
          boxShadow: "0 2px 12px rgba(0,107,187,0.08)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "4px", height: "28px", borderRadius: "999px", background: "linear-gradient(180deg, #006BBB, #30A0E0)" }} />
            <div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "#001F3F", letterSpacing: "-0.3px" }}>
                {navItems.find(n => n.path === pathname)?.label || "Dashboard"}
              </p>
              <p style={{ fontSize: "11px", color: "#5A8FA8", fontWeight: 500 }}>
                {navItems.find(n => n.path === pathname)?.desc || "AI-powered meeting highlights"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "rgba(0,107,187,0.08)", border: "1px solid rgba(0,107,187,0.2)", borderRadius: "999px", padding: "6px 16px", display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#006BBB", boxShadow: "0 0 6px #30A0E0" }} />
              <span style={{ fontSize: "12px", color: "#006BBB", fontWeight: 700 }}>Online</span>
            </div>
          </div>
        </div>

        {/* Page content */}
        <div style={{ padding: "36px" }}>
          {children}
        </div>
      </main>

      <style>{`
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #F0F7FF; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes slideUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        @keyframes wave { 0%,100% { transform: scaleY(1); opacity:0.5; } 50% { transform: scaleY(2.5); opacity:1; } }
        a:hover { opacity: 0.9; }
        input, textarea, button { font-family: 'Inter','Segoe UI',sans-serif; }
      `}</style>
    </div>
  );
}
