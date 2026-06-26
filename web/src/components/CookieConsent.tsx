// web/src/components/CookieConsent.tsx
import { useState } from "react";
import { getStoredConsent, grantConsent, denyConsent, trackPageView } from "../lib/analytics";

export default function CookieConsent() {
  const [visible, setVisible] = useState(() => getStoredConsent() === null);
  if (!visible) return null;

  const accept = () => {
    grantConsent();
    trackPageView(window.location.pathname + window.location.search);
    setVisible(false);
  };
  const reject = () => {
    denyConsent();
    setVisible(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: "fixed",
        left: 16,
        right: 16,
        bottom: 16,
        zIndex: 1000,
        display: "flex",
        flexWrap: "wrap",
        alignItems: "center",
        gap: 16,
        maxWidth: 720,
        margin: "0 auto",
        padding: "14px 18px",
        background: "#0d0f15",
        border: "1px solid rgba(255,255,255,0.12)",
        borderRadius: 12,
        boxShadow: "0 12px 40px rgba(0,0,0,0.5)",
        fontFamily: "Barlow, system-ui, sans-serif",
        color: "#f3f4f2",
      }}
    >
      <p style={{ margin: 0, flex: "1 1 280px", fontSize: 14, lineHeight: 1.5 }}>
        Diamond uses cookies for anonymous analytics to understand how the app is used.{" "}
        <a href="/about" style={{ color: "#9aa0a6", textDecoration: "underline" }}>
          Learn more
        </a>
        .
      </p>
      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={reject} style={btn(false)}>
          Reject
        </button>
        <button onClick={accept} style={btn(true)}>
          Accept
        </button>
      </div>
    </div>
  );
}

function btn(primary: boolean): React.CSSProperties {
  return {
    cursor: "pointer",
    fontFamily: "Barlow, system-ui, sans-serif",
    fontSize: 14,
    fontWeight: 600,
    padding: "8px 16px",
    borderRadius: 8,
    border: primary ? "1px solid #f3f4f2" : "1px solid rgba(255,255,255,0.25)",
    background: primary ? "#f3f4f2" : "transparent",
    color: primary ? "#08090d" : "#f3f4f2",
  };
}
