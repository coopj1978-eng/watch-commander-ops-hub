import { useRef, type CSSProperties, type PointerEvent as ReactPointerEvent } from "react";

/**
 * Swipe a bottom sheet down to close it (Nov 2026). Every sheet had a grab
 * handle at the top that did nothing; on a phone people flick a sheet away.
 *
 *   const swipe = useSwipeToClose(() => setOpen(false));
 *   <Dialog.Content ref={swipe.sheet}> <SheetHandle swipe={swipe} /> … </Dialog.Content>
 *
 * Only the handle strip starts a drag, so scrolling the sheet's own contents
 * and tapping its buttons are untouched. The sheet follows the finger; let
 * go past a third of the way (or with a quick flick) and it slides off and
 * closes, otherwise it springs back. With a mouse it works the same; with a
 * keyboard nothing changes (Escape and the X still close it).
 */
export function useSwipeToClose(onClose: () => void) {
  const sheet = useRef<HTMLElement | null>(null);
  const drag = useRef<{ y: number; at: number; dy: number } | null>(null);

  const move = (dy: number, glide: boolean) => {
    const el = sheet.current;
    if (!el) return;
    el.style.transition = glide ? "transform 180ms cubic-bezier(.2,.8,.2,1)" : "none";
    el.style.transform = dy > 0 ? `translateY(${dy}px)` : "";
  };

  const handle = {
    onPointerDown(e: ReactPointerEvent<HTMLElement>) {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      drag.current = { y: e.clientY, at: performance.now(), dy: 0 };
      e.currentTarget.setPointerCapture?.(e.pointerId);
    },
    onPointerMove(e: ReactPointerEvent<HTMLElement>) {
      const d = drag.current;
      if (!d) return;
      d.dy = Math.max(0, e.clientY - d.y);
      move(d.dy, false);
    },
    onPointerUp() {
      const d = drag.current;
      drag.current = null;
      if (!d) return;
      const height = sheet.current?.offsetHeight ?? 400;
      const speed = d.dy / Math.max(1, performance.now() - d.at); // px per ms
      if (d.dy > Math.min(160, height / 3) || (d.dy > 24 && speed > 0.6)) {
        move(height + 40, true);
        window.setTimeout(onClose, 160);
      } else {
        move(0, true);
      }
    },
    onPointerCancel() {
      drag.current = null;
      move(0, true);
    },
  };

  return { sheet, handle };
}

export type SwipeToClose = ReturnType<typeof useSwipeToClose>;

/**
 * The grab handle at the top of a sheet: the little bar to look at, a
 * full-width strip 28px tall to take hold of.
 */
export function SheetHandle({ swipe, color = "color-mix(in oklab, var(--muted-foreground) 25%, transparent)", style }: {
  swipe: SwipeToClose;
  /** The bar's colour (sheets on a photo or a dark cover pass their own). */
  color?: string;
  style?: CSSProperties;
}) {
  return (
    <div
      {...swipe.handle}
      aria-hidden="true"
      style={{ display: "flex", justifyContent: "center", alignItems: "center", height: 28, margin: "-8px 0 4px", touchAction: "none", cursor: "grab", flex: "none", ...style }}
    >
      <span style={{ width: 40, height: 5, borderRadius: 3, background: color }} />
    </div>
  );
}
