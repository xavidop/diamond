// web/src/lib/sanitizeHtml.ts
//
// A small, dependency-free sanitizer for ESPN story HTML so it can be rendered
// in-app. It whitelists a safe subset of tags/attributes, unwraps unknown
// elements (e.g. ESPN's custom <alsosee>) keeping their text, drops dangerous
// elements outright, and forces external links to open safely.

const DROP = new Set([
  "SCRIPT", "STYLE", "IFRAME", "OBJECT", "EMBED", "LINK", "META",
  "NOSCRIPT", "FORM", "INPUT", "BUTTON", "SVG", "VIDEO", "AUDIO",
]);

const ALLOWED = new Set([
  "P", "A", "B", "STRONG", "I", "EM", "U", "S", "BR", "HR",
  "UL", "OL", "LI", "H1", "H2", "H3", "H4", "H5", "H6",
  "BLOCKQUOTE", "FIGURE", "FIGCAPTION", "IMG", "SPAN", "DIV",
]);

function safeUrl(value: string): boolean {
  const v = value.trim().toLowerCase();
  if (v.startsWith("javascript:") || v.startsWith("data:") || v.startsWith("vbscript:")) {
    return false;
  }
  return true;
}

function cleanChildren(node: Element) {
  for (const el of Array.from(node.children)) {
    const tag = el.tagName;
    if (DROP.has(tag)) {
      el.remove();
      continue;
    }
    // Clean descendants first so unwrapping preserves already-safe content.
    cleanChildren(el);

    for (const attr of Array.from(el.attributes)) {
      const name = attr.name.toLowerCase();
      const keep =
        (tag === "A" && name === "href" && safeUrl(attr.value)) ||
        (tag === "IMG" && name === "src" && safeUrl(attr.value)) ||
        (tag === "IMG" && (name === "alt" || name === "title"));
      if (!keep) el.removeAttribute(attr.name);
    }

    if (tag === "A") {
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener noreferrer");
    }

    if (!ALLOWED.has(tag)) {
      // Unwrap: replace the element with its (already-cleaned) children.
      const parent = el.parentNode;
      if (parent) {
        while (el.firstChild) parent.insertBefore(el.firstChild, el);
        parent.removeChild(el);
      }
    }
  }
}

/** Sanitize ESPN story HTML into a safe subset. Returns "" outside the DOM. */
export function sanitizeStoryHtml(html: string): string {
  if (!html || typeof window === "undefined" || typeof DOMParser === "undefined") {
    return "";
  }
  const doc = new DOMParser().parseFromString(html, "text/html");
  cleanChildren(doc.body);
  return doc.body.innerHTML.trim();
}
