import { useLocation, Link } from "react-router-dom";

const navItems = [
  { path: "/", icon: "🎵", label: "Audio Upload", desc: "Upload & transcribe" },
  { path: "/video-audio", icon: "🎬", label: "Video Upload", desc: "Extract & analyze" },
  { path: "/live", icon: "🔴", label: "Live Meeting", desc: "Record & transcribe" },
];

export default function Layout({ children }) {
  const { pathname } = useLocation();

  return (
    <div style={{ display: "flex", minHeight: "100vh", fontFamily: "'Inter','Segoe UI',sans-serif", background: "#f0f4f8" }}>

      {/* Sidebar */}
      <aside style={{
        width: "240px", flexShrink: 0,
        background: "linear-gradient(180deg, #0f172a 0%, #1e293b 100%)",
        display: "flex", flexDirection: "column",
        position: "fixed", top: 0, left: 0, height: "100vh", zIndex: 50,
        boxShadow: "4px 0 24px rgba(0,0,0,0.15)"
      }}>
        {/* Logo */}
        <div style={{ padding: "28px 20px 24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "42px", height: "42px", borderRadius: "12px",
              background: "linear-gradient(135deg, #10b981, #059669)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "20px", boxShadow: "0 4px 16px rgba(16,185,129,0.4)", flexShrink: 0
            }}>🎙️</div>
            <div>
              <div style={{ fontWeight: 800, fontSize: "16px", color: "#ffffff", letterSpacing: "-0.3px" }}>MeetingAI</div>
              <div style={{ fontSize: "10px", color: "#64748b", fontWeight: 500, marginTop: "1px" }}>AI Meeting Assistant</div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #334155, transparent)", margin: "0 20px" }} />

        {/* Nav */}
        <nav style={{ padding: "20px 12px", flex: 1 }}>
          <p style={{ fontSize: "9px", fontWeight: 700, color: "#475569", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "12px", paddingLeft: "10px" }}>Navigation</p>
          {navItems.map((item) => {
            const active = pathname === item.path;
            return (
              <Link key={item.path} to={item.path} style={{
                display: "flex", alignItems: "center", gap: "12px",
                padding: "12px 14px", borderRadius: "12px", marginBottom: "6px",
                textDecoration: "none", transition: "all 0.2s",
                background: active ? "linear-gradient(135deg, rgba(16,185,129,0.2), rgba(5,150,105,0.1))" : "transparent",
                border: active ? "1px solid rgba(16,185,129,0.3)" : "1px solid transparent",
                boxShadow: active ? "0 4px 16px rgba(16,185,129,0.15)" : "none",
              }}>
                <div style={{
                  width: "34px", height: "34px", borderRadius: "9px", flexShrink: 0,
                  background: active ? "linear-gradient(135deg, #10b981, #059669)" : "rgba(255,255,255,0.05)",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "15px", boxShadow: active ? "0 4px 10px rgba(16,185,129,0.35)" : "none"
                }}>{item.icon}</div>
                <div>
                  <div style={{ fontSize: "13px", fontWeight: active ? 700 : 500, color: active ? "#ffffff" : "#94a3b8" }}>{item.label}</div>
                  <div style={{ fontSize: "10px", color: active ? "#6ee7b7" : "#475569", marginTop: "1px" }}>{item.desc}</div>
                </div>
                {active && <div style={{ marginLeft: "auto", width: "6px", height: "6px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981" }} />}
              </Link>
            );
          })}
        </nav>

        {/* Divider */}
        <div style={{ height: "1px", background: "linear-gradient(90deg, transparent, #334155, transparent)", margin: "0 20px" }} />

        {/* Status */}
        <div style={{ padding: "20px" }}>
          <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid #1e293b", borderRadius: "12px", padding: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 8px #10b981", animation: "pulse 2s infinite" }} />
              <span style={{ fontSize: "11px", color: "#10b981", fontWeight: 700 }}>All Systems Online</span>
            </div>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ marginLeft: "240px", flex: 1, minHeight: "100vh" }}>
        {/* Top bar */}
        <div style={{
          height: "64px", background: "#ffffff",
          borderBottom: "1px solid #e2e8f0",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 36px", position: "sticky", top: 0, zIndex: 40,
          boxShadow: "0 1px 8px rgba(0,0,0,0.05)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
            <div style={{ width: "3px", height: "28px", borderRadius: "999px", background: "linear-gradient(180deg, #10b981, #059669)" }} />
            <div>
              <p style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a", letterSpacing: "-0.3px" }}>
                {navItems.find(n => n.path === pathname)?.label || "Dashboard"}
              </p>
              <p style={{ fontSize: "11px", color: "#94a3b8" }}>
                {navItems.find(n => n.path === pathname)?.desc || "AI-powered meeting highlights"}
              </p>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: "999px", padding: "6px 14px", display: "flex", alignItems: "center", gap: "7px" }}>
              <div style={{ width: "7px", height: "7px", borderRadius: "50%", background: "#10b981", boxShadow: "0 0 6px #10b981" }} />
              <span style={{ fontSize: "12px", color: "#10b981", fontWeight: 600 }}>Online</span>
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
        body { background: #f0f4f8; }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.3; } }
        @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.12); } }
        @keyframes slideUp { from { opacity:0; transform: translateY(12px); } to { opacity:1; transform: translateY(0); } }
        @keyframes wave { 0%,100% { transform: scaleY(1); opacity:0.5; } 50% { transform: scaleY(2.5); opacity:1; } }
        a:hover { opacity: 0.85; }
      `}</style>
    </div>
  );
}
