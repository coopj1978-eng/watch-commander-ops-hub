/**
 * For a pop-up or bottom sheet's `onOpenAutoFocus`.
 *
 * On a touch screen a pop-up opens with nothing picked: putting the cursor in
 * its first box throws up the keyboard — or, for a date box on an iPhone, the
 * whole date picker — over the form before it's been read, and on a sheet
 * whose first control is the X it draws a blue box round the X (both seen on
 * an iPhone screen, 22 Nov 2026). The pop-up itself takes the focus instead,
 * so a screen reader still lands in it. A mouse-and-keyboard computer is
 * unchanged: the first control is focused, ready to use.
 */
export function focusPopupItselfOnTouch(e: Event): void {
  if (e.defaultPrevented) return;
  if (typeof window === "undefined" || !window.matchMedia?.("(pointer: coarse)").matches) return;
  e.preventDefault();
  (e.currentTarget as HTMLElement | null)?.focus?.({ preventScroll: true });
}
