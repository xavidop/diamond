import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Track an element's width with a ResizeObserver.
 *
 * The mini viewer renders into a Document Picture-in-Picture window, where the
 * main document's `resize` events do not describe the portalled content — so
 * observing the element itself is the only reliable measurement.
 */
export function useElementWidth(): [(node: HTMLElement | null) => void, number] {
  const [width, setWidth] = useState(0);
  const observer = useRef<ResizeObserver | null>(null);

  const ref = useCallback((node: HTMLElement | null) => {
    observer.current?.disconnect();
    if (!node || typeof ResizeObserver === "undefined") return;
    observer.current = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width;
      if (typeof w === "number") setWidth(w);
    });
    observer.current.observe(node);
  }, []);

  useEffect(() => () => observer.current?.disconnect(), []);

  return [ref, width];
}
