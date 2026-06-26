import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { CONSENT_KEY } from "./analytics";

// Helper: (re)import the module fresh so module-level GA_ID re-reads stubbed env.
async function loadModule() {
  vi.resetModules();
  return await import("./analytics");
}

function dataLayer(): unknown[] {
  return (window as unknown as { dataLayer?: unknown[] }).dataLayer ?? [];
}

function entries(): unknown[][] {
  // gtag pushes an `arguments` object; normalize to arrays for assertions.
  return dataLayer().map((e) => Array.from(e as ArrayLike<unknown>));
}

beforeEach(() => {
  localStorage.clear();
  delete (window as unknown as { dataLayer?: unknown[] }).dataLayer;
  delete (window as unknown as { gtag?: unknown }).gtag;
  document.querySelectorAll('script[data-ga]').forEach((s) => s.remove());
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("analytics (disabled)", () => {
  it("is a no-op when VITE_GA_ID is unset", async () => {
    vi.stubEnv("VITE_GA_ID", "");
    const a = await loadModule();
    expect(a.isAnalyticsEnabled()).toBe(false);
    a.initAnalytics();
    expect(document.querySelector("script[data-ga]")).toBeNull();
    expect(dataLayer()).toEqual([]);
  });
});

describe("analytics (enabled)", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_GA_ID", "G-TEST123");
  });

  it("injects gtag.js and sets consent default to denied", async () => {
    const a = await loadModule();
    expect(a.isAnalyticsEnabled()).toBe(true);
    a.initAnalytics();
    expect(document.querySelector("script[data-ga]")).not.toBeNull();
    const def = entries().find((e) => e[0] === "consent" && e[1] === "default");
    expect(def).toBeTruthy();
    expect((def![2] as Record<string, string>).analytics_storage).toBe("denied");
  });

  it("grantConsent stores granted and pushes a consent update granting analytics", async () => {
    const a = await loadModule();
    a.initAnalytics();
    a.grantConsent();
    expect(a.getStoredConsent()).toBe("granted");
    const upd = entries().filter((e) => e[0] === "consent" && e[1] === "update").pop();
    expect((upd![2] as Record<string, string>).analytics_storage).toBe("granted");
  });

  it("denyConsent stores denied", async () => {
    const a = await loadModule();
    a.initAnalytics();
    a.denyConsent();
    expect(a.getStoredConsent()).toBe("denied");
  });

  it("replays a stored granted consent on init", async () => {
    localStorage.setItem(CONSENT_KEY, "granted");
    const a = await loadModule();
    a.initAnalytics();
    const upd = entries().find((e) => e[0] === "consent" && e[1] === "update");
    expect((upd![2] as Record<string, string>).analytics_storage).toBe("granted");
  });

  it("trackPageView only emits page_view when consent granted", async () => {
    const a = await loadModule();
    a.initAnalytics();
    a.trackPageView("/teams");
    expect(entries().find((e) => e[0] === "event" && e[1] === "page_view")).toBeUndefined();
    a.grantConsent();
    a.trackPageView("/teams");
    const pv = entries().find((e) => e[0] === "event" && e[1] === "page_view");
    expect((pv![2] as Record<string, string>).page_path).toBe("/teams");
  });
});
