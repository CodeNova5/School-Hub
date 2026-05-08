import { useEffect } from "react";

// Dynamically load KaTeX (CSS + JS) from CDN and render any <code class="math">...</code>
// elements on the page. Call this hook from client components and pass a trigger
// (e.g., `questions` array) so rendering runs after content updates.
export function useKatexRender(trigger?: any) {
  useEffect(() => {
    if (typeof window === "undefined") return;

    let cancelled = false;

    async function loadKatex() {
      try {
        // Inject KaTeX CSS once
        if (!document.getElementById("katex-css")) {
          const link = document.createElement("link");
          link.id = "katex-css";
          link.rel = "stylesheet";
          link.href = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.css";
          document.head.appendChild(link);
        }

        // Load KaTeX script if not already present
        if (!(window as any).katex) {
          if (!document.getElementById("katex-js")) {
            await new Promise<void>((resolve, reject) => {
              const s = document.createElement("script");
              s.id = "katex-js";
              s.src = "https://cdn.jsdelivr.net/npm/katex@0.16.8/dist/katex.min.js";
              s.async = true;
              s.onload = () => resolve();
              s.onerror = () => reject(new Error("Failed to load KaTeX script"));
              document.head.appendChild(s);
            });
          } else {
            // if tag exists but katex not yet available, wait until it's loaded
            await new Promise<void>((resolve) => {
              const check = setInterval(() => {
                if ((window as any).katex) {
                  clearInterval(check);
                  resolve();
                }
              }, 50);
            });
          }
        }

        if (cancelled) return;
        renderAllKatex();
      } catch (err) {
        // don't break the app if CDN fails
        // eslint-disable-next-line no-console
        console.error("Failed to load KaTeX:", err);
      }
    }

    function stripDelimiters(s: string) {
      let t = s.trim();
      if (t.startsWith("$$") && t.endsWith("$$")) return { expr: t.slice(2, -2), display: true };
      if (t.startsWith("\\[") && t.endsWith("\\]")) return { expr: t.slice(2, -2), display: true };
      if (t.startsWith("\\(") && t.endsWith("\\)")) return { expr: t.slice(2, -2), display: false };
      if (t.startsWith("$") && t.endsWith("$")) return { expr: t.slice(1, -1), display: false };
      return { expr: t, display: false };
    }

    function renderAllKatex() {
      const katex = (window as any).katex;
      if (!katex) return;

      const nodes = Array.from(document.querySelectorAll("code.math")) as HTMLElement[];
      nodes.forEach((node) => {
        try {
          // Avoid re-rendering identical nodes
          if (node.dataset.katexRendered === "1") return;

          const raw = node.textContent || "";
          const { expr, display } = stripDelimiters(raw);

          // Create a temporary container and render into it
          const container = document.createElement("span");
          try {
            katex.render(expr, container, { throwOnError: false, displayMode: Boolean(display) });
            node.innerHTML = "";
            node.appendChild(container);
            node.dataset.katexRendered = "1";
            // keep accessible label
            node.setAttribute("aria-hidden", "false");
          } catch (e) {
            // fallback - leave original content
            // eslint-disable-next-line no-console
            console.error("KaTeX render error", e);
          }
        } catch (e) {
          // eslint-disable-next-line no-console
          console.error("KaTeX processing error", e);
        }
      });
    }

    loadKatex();

    // Also re-run render on DOM mutations affecting code.math nodes
    const observer = new MutationObserver(() => renderAllKatex());
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [trigger]);
}

export default useKatexRender;
