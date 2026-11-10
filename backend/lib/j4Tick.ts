// Finishing a J4 check ticks the J4 line on the shift's task card (John, Nov
// 2026), so nobody ticks it twice — once in the J4 form and again on the board.
//
// Which lines count: a checklist item that starts "J4 check" ("J4 check –
// B10P1", "J4 checks"). Other lines that only mention J4 ("J4 trauma and first
// aid stock – order", "General checks – J4 / BA / pumps") are left alone:
// they're about more than the equipment check.

export interface TickItem {
  label: string;
  done: boolean;
  done_by?: string;
  done_by_name?: string;
  done_at?: string;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A line that is the J4 equipment check itself. */
export function isJ4CheckLine(label: string): boolean {
  return /^\s*j4\s+checks?\b/i.test(label);
}

/** The appliances a line names ("J4 check – B10P1" → ["B10P1"]); none = all of them. */
export function appliancesNamed(label: string, callSigns: string[]): string[] {
  const text = squash(label);
  return callSigns.filter((cs) => squash(cs).length > 0 && text.includes(squash(cs)));
}

/**
 * Tick every J4 line whose appliances have all been checked this shift.
 * A line naming no appliance waits for every appliance with a kit list.
 * Lines already ticked keep who ticked them.
 */
export function tickJ4Lines(
  checklist: TickItem[],
  i: {
    /** Every active appliance's call sign. */
    callSigns: string[];
    /** Appliances that have a kit list — the ones a J4 check can be done on. */
    withKit: string[];
    /** Appliances checked this shift, including the one just finished. */
    checked: string[];
    who: { id: string; name: string | null };
    now?: Date;
  },
): { checklist: TickItem[]; ticked: string[] } {
  const done = new Set(i.checked.map(squash));
  const ticked: string[] = [];
  const next = checklist.map((item) => {
    if (item.done || !isJ4CheckLine(item.label)) return item;
    const named = appliancesNamed(item.label, i.callSigns);
    const needs = named.length > 0 ? named : i.withKit;
    if (needs.length === 0 || !needs.every((cs) => done.has(squash(cs)))) return item;
    ticked.push(item.label);
    return {
      ...item,
      done: true,
      done_by: i.who.id,
      done_by_name: i.who.name ?? undefined,
      done_at: (i.now ?? new Date()).toISOString(),
    };
  });
  return { checklist: next, ticked };
}

/**
 * Where the card goes after a tick, as the board does it when you tick by
 * hand: the first tick starts it, the last one finishes it. Null = stay put.
 */
export function statusAfterTick(status: string, checklist: { done: boolean }[]): "InProgress" | "Done" | null {
  if (checklist.length === 0) return null;
  const all = checklist.every((c) => c.done);
  const any = checklist.some((c) => c.done);
  if (all && (status === "NotStarted" || status === "InProgress")) return "Done";
  if (any && !all && status === "NotStarted") return "InProgress";
  return null;
}
