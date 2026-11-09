// The part of the screen you can actually see (Nov 2026, council phone polish).
// When a phone's keyboard opens, the browser keeps the page the same size and
// just covers the bottom of it, so a dialog centred on the page ends up with
// its text boxes and buttons under the keyboard. This keeps two CSS variables
// up to date — --vvh (visible height) and --vvt (how far the visible part is
// scrolled down) — that dialogs use to stay centred in, and no taller than,
// what's visible. It also scrolls a focused text box inside a dialog into view
// once the keyboard has opened.

export function watchVisualViewport(): void {
  const vv = window.visualViewport;
  if (!vv) return;
  const root = document.documentElement;
  const update = () => {
    root.style.setProperty("--vvh", `${vv.height}px`);
    root.style.setProperty("--vvt", `${vv.offsetTop}px`);
    // The keyboard is up: index.css caps every dialog to what's visible,
    // overriding a dialog's own height (85vh and the like).
    root.toggleAttribute("data-keyboard", window.innerHeight - vv.height > 120);
  };
  update();
  vv.addEventListener("resize", update);
  vv.addEventListener("scroll", update);

  document.addEventListener("focusin", (e) => {
    const el = e.target as HTMLElement | null;
    if (!el?.matches?.("input, textarea, select, [contenteditable='true']")) return;
    if (!el.closest("[role='dialog'], .vv-fit")) return;
    // After the keyboard's slide-up has resized the visible area.
    setTimeout(() => el.scrollIntoView({ block: "nearest" }), 350);
  });
}
