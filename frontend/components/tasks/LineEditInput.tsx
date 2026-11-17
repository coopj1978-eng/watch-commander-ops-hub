import { useEffect, useRef, useState } from "react";

interface Props {
  value: string;
  /** Called once, with the tidied wording, when Enter is pressed or the field is left. */
  onCommit: (next: string) => void;
  onCancel: () => void;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * A checklist line being reworded where it sits: Enter or tapping away
 * saves, Escape puts it back. Used on a task, the weekly routine and the
 * other scheduled checks, so all three behave the same.
 */
export default function LineEditInput({ value, onCommit, onCancel, ariaLabel = "Reword this line", className, style }: Props) {
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
      maxLength={200}
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
