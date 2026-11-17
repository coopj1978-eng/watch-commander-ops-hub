import { useState } from "react";
import { Check, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseGuide, type Inline } from "@/lib/guideMarkup";

// A how-to guide's steps, drawn from its plain-text marks (lib/guideMarkup).
// Steps can be ticked as you work through them — on this screen only, nothing
// is saved — so you don't lose your place half way down a procedure.

function Text({ parts }: { parts: Inline[] }) {
  return (
    <>
      {parts.map((p, i) =>
        p.kind === "bold" ? <strong key={i} className="font-semibold text-foreground">{p.text}</strong>
          : p.kind === "link" ? (
            <a
              key={i}
              href={p.href}
              target={p.href.startsWith("mailto:") ? undefined : "_blank"}
              rel="noopener noreferrer"
              className="break-words font-medium text-brand underline decoration-brand/30 underline-offset-2 hover:decoration-brand"
            >
              {p.text}
            </a>
          )
            : <span key={i}>{p.text}</span>,
      )}
    </>
  );
}

export function GuideBody({ body }: { body: string }) {
  const blocks = parseGuide(body);
  const [done, setDone] = useState<Set<string>>(new Set());
  const toggle = (key: string) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });

  if (blocks.length === 0) return <p className="text-sm text-muted-foreground">Nothing written for this guide yet.</p>;

  return (
    <div className="space-y-4 text-[15px] leading-relaxed text-foreground/90">
      {blocks.map((b, bi) => {
        if (b.kind === "heading") {
          return <h2 key={bi} className="pt-3 text-base font-semibold text-foreground first:pt-0"><Text parts={b.text} /></h2>;
        }
        if (b.kind === "steps") {
          return (
            <ol key={bi} className="space-y-1.5">
              {b.items.map((item, i) => {
                const key = `${bi}-${i}`;
                const ticked = done.has(key);
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={ticked}
                      onClick={() => toggle(key)}
                      className="group flex w-full items-start gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-muted/60"
                    >
                      <span
                        className={cn(
                          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full border text-xs font-semibold tabular-nums transition-colors",
                          ticked ? "border-foreground bg-foreground text-background" : "border-border text-muted-foreground group-hover:border-foreground/40",
                        )}
                      >
                        {ticked ? <Check className="h-3.5 w-3.5" /> : i + 1}
                      </span>
                      <span className={cn("min-w-0 break-words", ticked && "text-muted-foreground line-through decoration-muted-foreground/40")}>
                        <Text parts={item} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          );
        }
        if (b.kind === "bullets") {
          return (
            <ul key={bi} className="space-y-1.5 pl-2">
              {b.items.map((item, i) => (
                <li key={i} className="flex gap-3">
                  <span aria-hidden className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/50" />
                  <span className="min-w-0 break-words"><Text parts={item} /></span>
                </li>
              ))}
            </ul>
          );
        }
        if (b.kind === "note") {
          return (
            <div key={bi} className="flex gap-3 rounded-xl border border-border/70 bg-muted/40 px-3.5 py-3 text-sm">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 space-y-1">
                {b.lines.map((l, i) => <p key={i} className="break-words"><Text parts={l} /></p>)}
              </div>
            </div>
          );
        }
        return (
          <p key={bi} className="break-words">
            {b.lines.map((l, i) => <span key={i}>{i > 0 && <br />}<Text parts={l} /></span>)}
          </p>
        );
      })}
    </div>
  );
}
