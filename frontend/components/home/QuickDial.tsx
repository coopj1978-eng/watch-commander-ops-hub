import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Phone } from "lucide-react";
import backend from "@/lib/backend";
import { groupContacts, splitNumbers, type ContactLine } from "@/lib/contacts";

// The top of the station's Contacts page, on Home (Nov 2026). It replaces the
// old "Duty contacts" card, which kept its own list in the browser and was
// empty for everyone. The first lines of the Contacts page show here, so
// whatever a Watch Commander puts at the top is one tap away.

const SHOWN = 6;

export function QuickDial() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => (await backend.contacts.list()).contacts as ContactLine[],
    retry: false,
  });
  if (isError) return null;

  const lines = groupContacts(data ?? []).flatMap((s) => s.lines).slice(0, SHOWN);

  return (
    <section aria-label="Contacts" className="rounded-2xl border border-border/70 bg-card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Contacts</h2>
        <Link to="/contacts" className="text-xs text-muted-foreground hover:text-foreground">
          {data ? `All ${data.length} →` : "All →"}
        </Link>
      </div>

      {isLoading ? (
        <ul className="mt-3 space-y-2" aria-hidden>
          {[...Array(4)].map((_, i) => <li key={i} className="h-9 animate-pulse rounded-lg bg-muted" />)}
        </ul>
      ) : lines.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">
          No numbers yet. <Link to="/contacts" className="font-medium text-brand hover:underline">Add the station's numbers</Link>
        </p>
      ) : (
        <ul className="mt-2 divide-y divide-border/60">
          {lines.map((line) => {
            const numbers = splitNumbers(line.numbers);
            // The number to show: one a phone can call if there is one, else the first.
            const n = numbers.find((x) => x.tel) ?? numbers[0];
            return (
              <li key={line.id} className="flex items-center justify-between gap-3 py-1.5">
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{line.name}</span>
                  {line.detail && <span className="block truncate text-xs text-muted-foreground">{line.detail}</span>}
                </span>
                {n?.tel ? (
                  <a
                    href={`tel:${n.tel}`}
                    aria-label={`Call ${line.name} on ${n.text}`}
                    className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-lg border border-brand/30 bg-brand/5 px-2.5 text-xs font-semibold tabular-nums text-brand transition-colors hover:bg-brand/10"
                  >
                    <Phone className="h-3 w-3 shrink-0" />
                    {n.text}
                  </a>
                ) : n ? (
                  <span className="shrink-0 rounded-lg border px-2.5 py-1.5 text-xs font-medium tabular-nums">{n.text}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
