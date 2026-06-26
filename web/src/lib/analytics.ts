// GA4 + Consent Mode v2. The only module that touches window.gtag / dataLayer.
// No-op unless VITE_GA_ID is set.

const GA_ID = (import.meta.env.VITE_GA_ID ?? "").trim();
export const CONSENT_KEY = "diamond_cookie_consent";

type Consent = "granted" | "denied";

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

let initialized = false;

export function isAnalyticsEnabled(): boolean {
  return GA_ID.length > 0;
}

export function getStoredConsent(): Consent | null {
  const v = localStorage.getItem(CONSENT_KEY);
  return v === "granted" || v === "denied" ? v : null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function gtag(..._args: unknown[]): void {
  window.dataLayer = window.dataLayer ?? [];
  // Standard gtag shim: push the IArguments object so dataLayer entries behave
  // like the real gtag (array-like, spreadable). Must use `arguments`, not the
  // rest param, to match the gtag contract.
  // eslint-disable-next-line prefer-rest-params
  window.dataLayer.push(arguments);
}

export function initAnalytics(): void {
  if (!isAnalyticsEnabled() || initialized) return;
  initialized = true;

  window.dataLayer = window.dataLayer ?? [];
  window.gtag = gtag;

  // Consent Mode v2 — default everything to denied before any tracking.
  gtag("consent", "default", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });

  gtag("js", new Date());
  gtag("config", GA_ID, { send_page_view: false });

  // Inject the GA library.
  const s = document.createElement("script");
  s.async = true;
  s.src = `https://www.googletagmanager.com/gtag/js?id=${GA_ID}`;
  s.setAttribute("data-ga", "");
  document.head.appendChild(s);

  // Replay a previously stored choice.
  if (getStoredConsent() === "granted") applyGranted();
}

function applyGranted(): void {
  gtag("consent", "update", {
    ad_storage: "granted",
    analytics_storage: "granted",
    ad_user_data: "granted",
    ad_personalization: "granted",
  });
}

export function grantConsent(): void {
  localStorage.setItem(CONSENT_KEY, "granted");
  if (!isAnalyticsEnabled()) return;
  applyGranted();
}

export function denyConsent(): void {
  localStorage.setItem(CONSENT_KEY, "denied");
  if (!isAnalyticsEnabled()) return;
  gtag("consent", "update", {
    ad_storage: "denied",
    analytics_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  });
}

export function trackPageView(path: string): void {
  if (!isAnalyticsEnabled() || getStoredConsent() !== "granted") return;
  gtag("event", "page_view", { page_path: path });
}
