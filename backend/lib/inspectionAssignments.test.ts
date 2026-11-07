import { beforeEach, describe, expect, it, vi } from "vitest";

type Row = { plan_type: string; plan_id: number; label: string; watch: string; year: number; quarter: number | null };

const store = vi.hoisted(() => ({
  multistory: [] as unknown[],
  careHomes: [] as unknown[],
  operational: [] as unknown[],
  rows: [] as Row[],
}));

vi.mock("../db", () => ({
  default: {
    rawQueryAll: async (sql: string) => {
      if (sql.includes("multistory_inspections")) return store.multistory;
      if (sql.includes("care_home_validations")) return store.careHomes;
      if (sql.includes("operational_inspections")) return store.operational;
      throw new Error(`unexpected query: ${sql}`);
    },
    rawQueryRow: async (sql: string, ...args: unknown[]) => {
      if (sql.startsWith("SELECT id FROM inspection_assignments")) {
        return store.rows.some((r) => r.year === args[0]) ? { id: 1 } : null;
      }
      const plan_type = /VALUES \('(\w+)'/.exec(sql)![1];
      const [plan_id, label, watch, year, quarter] = args as [number, string, string, number, number?];
      const row: Row = { plan_type, plan_id, label, watch, year, quarter: quarter ?? null };
      const clash = store.rows.some(
        (r) => r.plan_type === plan_type && r.plan_id === plan_id && r.watch === watch && r.year === year && r.quarter === row.quarter
      );
      if (clash) return null;
      store.rows.push(row);
      return { id: store.rows.length };
    },
  },
}));

const { createAssignments, ensureYearAssignments } = await import("./inspectionAssignments");

const NEW_YEAR_2027 = new Date("2027-01-01T00:05:00Z");

beforeEach(() => {
  store.rows.length = 0;
  store.multistory = [
    { id: 1, address: "Block one", q1_watch: "White", q2_watch: "Green", q3_watch: "Blue", q4_watch: "Amber" },
  ];
  store.careHomes = [{ id: 1, address: "Home one" }];
  store.operational = [{ id: 1, address: "Site one", uprn: "", watch: "Red" }];
});

describe("a new year's inspections", () => {
  it("are made on 1 January with the programme moved along", async () => {
    const result = await ensureYearAssignments(NEW_YEAR_2027);

    expect(result).toEqual({ year: 2027, created: 10 });
    const multistory = store.rows.filter((r) => r.plan_type === "multistory");
    expect(multistory.map((r) => [r.quarter, r.watch])).toEqual([
      [1, "Green"],
      [2, "Blue"],
      [3, "Amber"],
      [4, "Red"],
    ]);
    expect(store.rows.every((r) => r.year === 2027)).toBe(true);
  });

  it("keep care homes on every watch and operational inspections on their own watch", async () => {
    await ensureYearAssignments(NEW_YEAR_2027);

    expect(store.rows.filter((r) => r.plan_type === "care_home").map((r) => r.watch).sort()).toEqual(
      ["Amber", "Blue", "Green", "Red", "White"]
    );
    expect(store.rows.filter((r) => r.plan_type === "operational").map((r) => r.watch)).toEqual(["Red"]);
  });

  it("are made on a later day if 1 January's run was missed", async () => {
    const result = await ensureYearAssignments(new Date("2027-01-04T00:05:00Z"));
    expect(result).toEqual({ year: 2027, created: 10 });
  });

  it("are left alone once the year has any, so plan changes still wait for Generate", async () => {
    await ensureYearAssignments(NEW_YEAR_2027);
    const before = store.rows.length;
    store.careHomes = [...store.careHomes, { id: 2, address: "Home two" }];

    const result = await ensureYearAssignments(new Date("2027-01-02T00:05:00Z"));

    expect(result).toEqual({ year: 2027, created: 0 });
    expect(store.rows.length).toBe(before);
  });

  it("aren't touched by the daily check when someone pressed Generate first", async () => {
    await createAssignments(2027);
    const result = await ensureYearAssignments(NEW_YEAR_2027);
    expect(result.created).toBe(0);
  });
});

describe("the Generate button's code", () => {
  it("skips what already exists and adds what's new", async () => {
    await createAssignments(2027);
    store.careHomes = [...store.careHomes, { id: 2, address: "Home two" }];

    expect(await createAssignments(2027)).toEqual({ created: 5, skipped: 10 });
  });

  it("makes only that quarter's multi-storey when given a quarter", async () => {
    expect(await createAssignments(2027, 2)).toEqual({ created: 1, skipped: 0 });
    expect(store.rows).toEqual([
      { plan_type: "multistory", plan_id: 1, label: "Block one", watch: "Blue", year: 2027, quarter: 2 },
    ]);
  });
});
