// "Your seat" on the crewing board (Nov 2026, the council's FF-first review,
// condition 8): the one line a firefighter reads first — which pump and seat,
// detached and where, off and why, or not riding — from the board itself plus
// their own bookings (GET /crewing/my-shifts).

import type { crewing } from "@/client";
import { offReason } from "./myNextShifts";

type MyShift = crewing.MyShift;

/** Where this board has you. */
export type BoardSeat =
  | { kind: "pump"; appliance: string; label: string }
  | { kind: "detached" }
  | null;

export interface MySeatLine {
  tone: "riding" | "detached" | "off" | "not" | "unset";
  title: string;
  detail?: string;
}

export function mySeatLine({ seat, boardSet, mine, ownWatch }: {
  seat: BoardSeat;
  /** Anyone on the board yet (either pump or detached). */
  boardSet: boolean;
  /** Your own shift from my-shifts, when it's this one. */
  mine?: MyShift;
  /** The board is your own watch's. */
  ownWatch: boolean;
}): MySeatLine | null {
  const extra = mine?.state === "extra" ? (mine.why ?? "Extra shift") : null;
  const covering = mine?.state === "extra" && mine.with_name ? ` · covering ${mine.with_name}` : "";

  if (seat?.kind === "pump") {
    return {
      tone: "riding",
      title: `You're on ${seat.appliance.toUpperCase()} · ${seat.label}`,
      detail: extra ? `Extra shift · ${extra}${covering}` : undefined,
    };
  }
  if (seat?.kind === "detached" || mine?.state === "detached") {
    return {
      tone: "detached",
      title: mine?.detached_to ? `You're detached to ${mine.detached_to}` : "You're detached to another station",
      detail: "Not riding here this shift",
    };
  }
  if (mine?.state === "off") {
    return {
      tone: "off",
      title: "You're off this shift",
      detail: [offReason(mine), mine.with_name && `${mine.with_name} covering`].filter(Boolean).join(" · "),
    };
  }
  // Someone else's watch, and you're not in for an extra: nothing to say.
  if (!ownWatch && !extra) return null;
  if (!boardSet) {
    return {
      tone: "unset",
      title: "Crewing isn't set yet",
      detail: extra ? `You're in for an extra · ${extra}${covering}` : "Check back nearer the start of the shift.",
    };
  }
  return {
    tone: "not",
    title: "You're not riding this shift",
    detail: extra
      ? `You're in for an extra (${extra}) but not on the board yet.`
      : "Check with your Watch Commander if that's wrong.",
  };
}
