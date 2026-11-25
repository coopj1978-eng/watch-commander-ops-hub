import { useEffect, useRef, useState } from "react";
import { ExternalLink, Link2 } from "lucide-react";
import { linkHost } from "@/lib/taskLinks";

interface Props {
  value: string;
  /** Called once, with the tidied wording, when Enter is pressed or the field is left. */
  onCommit: (next: string) => void;
  onCancel: () => void;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
  /** For the link box: a hint, a longer limit and the web-address keyboard. */
  placeholder?: string;
  maxLength?: number;
  inputMode?: "text" | "url";
}

/**
 * A checklist line being reworded where it sits: Enter or tapping away
 * saves, Escape puts it back. Used on a task, the weekly routine and the
 * other scheduled checks, so all three behave the same. The same box is
 * used for a line's link (see LineLinkButton).
 */
export default function LineEditInput({ value, onCommit, onCancel, ariaLabel = "Reword this line", className, style, placeholder, maxLength = 200, inputMode }: Props) {
  const [text, setText] = useState(value);
  const ref = useRef<HTMLInputElement>(null);
  const done = useRef(false);
  useEffect(() => { ref.current?.focus(); ref.current?.select(); }, []);

  const finish = (save: boolean) => {
    if (done.current) return;
    done.current = true;
    if (save) onCommit(text.replace(/\s+/g, " ").trim());
    else onCancel();
  };

  return (
    <input
      ref={ref}
      aria-label={ariaLabel}
      value={text}
      maxLength={maxLength}
      placeholder={placeholder}
      inputMode={inputMode}
      autoCapitalize={inputMode === "url" ? "none" : undefined}
      autoCorrect={inputMode === "url" ? "off" : undefined}
      spellCheck={inputMode === "url" ? false : undefined}
      enterKeyHint="done"
      onChange={(e) => setText(e.target.value)}
      onBlur={() => finish(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter") { e.preventDefault(); finish(true); }
        // Escape only cancels the rewording; it mustn't also close the window behind.
        if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); finish(false); }
      }}
      className={className}
      style={style}
    />
  );
}

/**
 * A tick line's wording when it has a link: it opens the page in a new tab.
 * It sits beside the tick box, not inside it, so the box still ticks.
 */
export function LineLinkText({ label, url, done, className, style }: { label: string; url: string; done?: boolean; className?: string; style?: React.CSSProperties }) {
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      title={`Opens ${linkHost(url)}`}
      onClick={(e) => e.stopPropagation()}
      className={`cal-focus ${className ?? ""}`}
      style={{
        flex: 1, minWidth: 0, lineHeight: 1.35, overflowWrap: "anywhere", borderRadius: 6,
        color: done ? "var(--cal-muted)" : "var(--cal-brand-text)",
        textDecoration: done ? "underline line-through" : "underline", textUnderlineOffset: 3,
        ...style,
      }}
    >
      {label}
      <ExternalLink aria-hidden="true" size={12} style={{ display: "inline", marginLeft: 5, verticalAlign: "-1px", opacity: 0.75 }} />
      <span className="sr-only"> (opens in a new tab)</span>
    </a>
  );
}

/** The hint in a line's link box. */
export const LINK_PLACEHOLDER = "Paste a web address — leave empty for no link";
/** Long enough for a SharePoint address. */
export const LINK_MAX = 2000;

/**
 * The small "link" button on a line being edited (John, 25 Nov 2026: the
 * tick stays tickable, the wording opens the link). Lit when the line has
 * one; pressing it opens the link box in place of the line.
 */
export function LineLinkButton({ label, url, onClick, size = 22 }: { label: string; url?: string; onClick: () => void; size?: number }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={url ? `Change the link on "${label}" (${linkHost(url)})` : `Add a link to "${label}"`}
      title={url ? `Opens ${linkHost(url)} — change or remove` : "Add a link"}
      className="cal-focus"
      style={{
        width: size, height: size, flex: "none", borderRadius: 6, border: "none", padding: 0, cursor: "pointer",
        display: "grid", placeItems: "center",
        background: url ? "var(--cal-brand-soft)" : "transparent",
        color: url ? "var(--cal-brand-text)" : "var(--cal-muted)",
      }}
    >
      <Link2 size={Math.round(size * 0.6)} strokeWidth={2} aria-hidden="true" />
    </button>
  );
}
