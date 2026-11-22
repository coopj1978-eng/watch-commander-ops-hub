import { useEffect } from "react";
import { useLocation, useNavigationType } from "react-router-dom";

/**
 * A page you go to opens at its top. Without this the browser keeps the old
 * scroll position, so tapping Calendar after scrolling down Home opened the
 * calendar half-way down (seen on a real iPhone screen, 22 Nov 2026).
 *
 * Going Back is left alone — the browser puts you where you were — and so is
 * a change of tab or filter on the same page (only the path counts).
 */
export function useScrollToTopOnNavigate(): void {
  const { pathname } = useLocation();
  const type = useNavigationType();
  useEffect(() => {
    if (type !== "POP") window.scrollTo(0, 0);
  }, [pathname, type]);
}
