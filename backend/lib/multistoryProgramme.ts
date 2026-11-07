/**
 * The station's multi-storey programme moves along one column each January
 * (John, 7 Nov 2026). The sheet's columns were Red, Amber, Blue, Green, White in 2025
 * and are White, Red, Amber, Blue, Green in 2026: every watch moves one column to the
 * right and the last comes round to the front, so it repeats every five years.
 *
 * multistory_inspections holds the 2026 programme, and other years are worked out from it.
 * Shared with the plan page, so the screen and the inspections can't disagree.
 */
const PLAN_YEAR = 2026;
const COLUMNS_IN_PLAN_YEAR = ["White", "Red", "Amber", "Blue", "Green"];

function moveAlong<W extends string>(watch: W, years: number): W {
  const column = COLUMNS_IN_PLAN_YEAR.indexOf(watch);
  if (column < 0) return watch;
  const count = COLUMNS_IN_PLAN_YEAR.length;
  return COLUMNS_IN_PLAN_YEAR[(((column - years) % count) + count) % count] as W;
}

/** The watch doing this building and quarter in `year`, given the plan's watch. */
export function watchInYear<W extends string>(planWatch: W, year: number): W {
  return moveAlong(planWatch, year - PLAN_YEAR);
}

/** The reverse: what to store in the plan when `yearWatch` is chosen while viewing `year`. */
export function watchInPlan<W extends string>(yearWatch: W, year: number): W {
  return moveAlong(yearWatch, PLAN_YEAR - year);
}
