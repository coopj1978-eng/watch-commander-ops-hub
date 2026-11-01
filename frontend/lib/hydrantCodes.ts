// The codes on the SFRS hydrant route sheets (the key printed on every sheet).
// A tick records the usual result — 1 Fully functional, 1 Tested — and the
// crew only changes the codes when something's wrong.

export const INSPECTION_CODES: Record<number, string> = {
  1: "Fully functional",
  2: "Unable to inspect – assistance required",
  3: "Unable to inspect – Scottish Water meter fitted",
  4: "Unable to inspect – car parked over hydrant",
  5: "Unable to locate hydrant",
  6: "New hydrant – adopted",
  7: "Unsatisfactory (dry / low water pressure)",
  8: "Unsatisfactory (trip hazard)",
  9: "Unsatisfactory (jammed lid)",
  10: "Unsatisfactory (seized spindle)",
  11: "Unsatisfactory (misaligned)",
  12: "Unsatisfactory (leaking)",
  13: "Unsatisfactory (other)",
};

export const ACTION_CODES: Record<number, string> = {
  1: "Tested",
  2: "Cleaned",
  3: "H1 raised",
  4: "Timber lid fitted",
  5: "New metal lid fitted",
  6: "In-house repair",
  7: "Plate fitted",
  8: "Painted",
  9: "Capped",
};

/** Codes that ask for a comment on the sheet. */
export const NEEDS_COMMENT = [8, 13];

export const isUnable = (codes: number[]) => codes.some((c) => c >= 2 && c <= 5);
export const isDefect = (codes: number[]) => codes.some((c) => c >= 7 && c <= 13);
