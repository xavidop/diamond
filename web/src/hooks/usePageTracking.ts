import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { trackPageView } from "../lib/analytics";

// Sends a consent-gated page_view on every client-side route change.
// Must be rendered inside <BrowserRouter>.
export function usePageTracking() {
  const location = useLocation();
  useEffect(() => {
    trackPageView(location.pathname + location.search);
  }, [location.pathname, location.search]);
}
