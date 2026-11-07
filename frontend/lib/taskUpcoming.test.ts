import { describe, expect, it } from "vitest";
import type { Task } from "~backend/task/types";
import { buildUpcoming, UPCOMING_MAX, type CalEvent } from "./taskUpcoming";

const NOW = new Date(2026, 10, 7, 21, 0); // Sat 7 Nov 2026, 21:00

const task = (id: number, due: Date, extra: Partial<Task> = {}) =>
  ({ id, title: `Task ${id}`, status: "NotStarted", due_at: due, tags: [], category: "Other", ...extra }) as unknown as Task;
const event = (id: number, start: Date, station: boolean, allDay = false): CalEvent =>
  ({ id, title: `Event ${id}`, start, allDay, station });

describe("the Tasks page's Upcoming list", () => {
  it("lists Station events in their own grey, apart from Watch Calendar events", () => {
    const items = buildUpcoming([], [event(1, new Date(2026, 11, 1, 12), true), event(2, new Date(2026, 10, 9, 10), false)], NOW);
    expect(items.map((i) => [i.title, i.kind, i.tag])).toEqual([
      ["Event 2", "ev", "Watch Calendar"],
      ["Event 1", "station", "Station"],
    ]);
  });

  it("doesn't list a Station event twice when it already put a task on this watch's board", () => {
    const items = buildUpcoming(
      [task(10, new Date(2026, 10, 22, 12), { calendar_event_id: 5, title: "Visit" })],
      [event(5, new Date(2026, 10, 22, 12), true)],
      NOW,
    );
    expect(items.map((i) => i.key)).toEqual(["t10"]);
  });

  it("puts overdue tasks first, in red, and leaves out done tasks and past events", () => {
    const items = buildUpcoming(
      [task(1, new Date(2026, 10, 20)), task(2, new Date(2026, 10, 2)), task(3, new Date(2026, 10, 1), { status: "Done" })],
      [event(7, new Date(2026, 10, 6, 10), true)],
      NOW,
    );
    expect(items.map((i) => [i.key, i.kind])).toEqual([["t2", "over"], ["t1", "plain"]]);
    expect(items[0].tag).toBe("Task · Overdue 5d");
  });

  it("keeps an all-day event listed on its own day", () => {
    const items = buildUpcoming([], [event(8, new Date(2026, 10, 7), true, true)], NOW);
    expect(items.map((i) => i.when)).toEqual(["Today · all day"]);
  });

  it(`shows at most ${UPCOMING_MAX}`, () => {
    const events = Array.from({ length: 12 }, (_, i) => event(i + 1, new Date(2026, 10, 10 + i, 9), true));
    expect(buildUpcoming([], events, NOW)).toHaveLength(UPCOMING_MAX);
  });
});
