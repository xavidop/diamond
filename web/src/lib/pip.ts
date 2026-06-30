export type DocumentPiP = {
  requestWindow(opts: { width: number; height: number }): Promise<Window>;
};

export function getDocPip(): DocumentPiP | undefined {
  if (typeof window === "undefined") return undefined;
  return (window as unknown as { documentPictureInPicture?: DocumentPiP })
    .documentPictureInPicture;
}

export function isDocumentPipSupported(): boolean {
  return !!getDocPip();
}

// Clone the main document's styles into the PiP window so Tailwind classes and
// theme tokens apply, then normalize the window's box model.
export function copyStyles(target: Window): void {
  for (const node of Array.from(
    document.head.querySelectorAll('style, link[rel="stylesheet"]')
  )) {
    target.document.head.appendChild(node.cloneNode(true));
  }
  // Constructed/adopted stylesheets have no <style>/<link> node — re-emit their rules.
  for (const sheet of Array.from(document.styleSheets)) {
    if (sheet.ownerNode && (sheet.ownerNode as Element).tagName) continue;
    try {
      const cssText = Array.from(sheet.cssRules)
        .map((r) => r.cssText)
        .join("\n");
      const style = target.document.createElement("style");
      style.textContent = cssText;
      target.document.head.appendChild(style);
    } catch {
      if (sheet.href) {
        const link = target.document.createElement("link");
        link.rel = "stylesheet";
        link.href = sheet.href;
        target.document.head.appendChild(link);
      }
    }
  }
  target.document.body.className = document.body.className;
  // Background is class-driven (html.light) rather than hardcoded, so a later
  // theme toggle only needs to re-sync the root class (see syncPipTheme).
  const reset = target.document.createElement("style");
  reset.textContent =
    "html,body{height:100%;margin:0}body{background:#0a0e14}html.light body{background:#e5e2db}";
  target.document.head.appendChild(reset);
  syncPipTheme(target);
}

// Re-apply the main document's theme classes (e.g. `light`, `cbsafe`) to an
// already-open PiP window. The reset stylesheet keys the background and the
// light-mode token overrides off these classes, so this is enough to flip the
// PiP window's theme live when the user toggles light/dark.
export function syncPipTheme(target: Window): void {
  target.document.documentElement.className = document.documentElement.className;
}
