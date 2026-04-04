#!/usr/bin/env bun
/**
 * seed-watches.ts
 *
 * Seeds all 5 watches with test accounts:
 *   1 Watch Commander + 2 Crew Commanders + 5 Firefighters per watch
 *   = 40 accounts total, each with a full profile.
 *
 * All accounts share the password:  Password1!
 * Safe to re-run — existing accounts are skipped.
 *
 * ── Prerequisites ───────────────────────────────────────────────────────────
 *   cd scripts && bun install
 *
 * ── Usage (while `encore run` is active in another terminal) ────────────────
 *   DATABASE_URL=$(encore db conn-uri db) bun run seed-watches.ts
 *
 * ── Account email format ────────────────────────────────────────────────────
 *   Watch Commanders : wc.red@station.local
 *   Crew Commanders  : cc1.red@station.local   cc2.red@station.local
 *   Firefighters     : ff1.red@station.local … ff5.red@station.local
 *   Replace "red" with: white | green | blue | amber
 */

import postgres from "postgres";

// ── Connection ───────────────────────────────────────────────────────────────

const DB_URL = process.env.DATABASE_URL;
if (!DB_URL) {
  console.error(`
❌  DATABASE_URL is not set.

To get your local Encore database URL, run:
    encore db conn-uri db

Then rerun this script:
    DATABASE_URL=$(encore db conn-uri db) bun run scripts/seed-watches.ts
`);
  process.exit(1);
}

const sql = postgres(DB_URL, { ssl: false });

// ── Password ─────────────────────────────────────────────────────────────────
// Pre-computed bcrypt hash for "Password1!" with cost=10.
// Compatible with the bcrypt library used in the backend auth system.
// Regenerate with: node -e "const b=require('bcrypt'); console.log(b.hashSync('Password1!',10))"
const HASH = "$2b$10$a1/PZ.wU1GHByTjUK7TFuebnJxQmFWCrzNRby4kI8dI9MULDRdaAa";

// ── Types ────────────────────────────────────────────────────────────────────

type Person = {
  id: string;
  email: string;
  name: string;
  role: "WC" | "CC" | "FF";
  watch: string;
  rank: string;
  // Profile fields
  svc: string;        // service number
  hire: string;       // hire date YYYY-MM-DD
  phone: string;
  ec_name: string;    // emergency contact name
  ec_phone: string;   // emergency contact phone
  skills: string[];
  certs: string[];
  lgv: boolean;
  erd: boolean;
  prps: boolean;
  ba: boolean;
  notes: string | null;
  last11: string;     // last 1:1 date YYYY-MM-DD
  next11: string;     // next 1:1 date YYYY-MM-DD
};

const STATION = "Springburn";

// ── People ───────────────────────────────────────────────────────────────────

const PEOPLE: Person[] = [

  // ════════════════════════════════════════════════════════════════════════════
  // RED WATCH
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "wc_red", email: "wc.red@station.local", name: "Duncan Fraser",
    role: "WC", watch: "Red", rank: "Watch Commander",
    svc: "SF-R2007-001", hire: "2007-04-12", phone: "07700 900001",
    ec_name: "Helen Fraser", ec_phone: "07700 900002",
    skills: ["Incident Command", "Management"],
    certs: ["Gold Command", "Incident Command Level 4"],
    lgv: false, erd: false, prps: false, ba: false,
    notes: null,
    last11: "2025-10-01", next11: "2025-12-01",
  },
  {
    id: "cc_red_1", email: "cc1.red@station.local", name: "Yvonne McKinnon",
    role: "CC", watch: "Red", rank: "Crew Commander",
    svc: "SF-R2011-002", hire: "2011-09-05", phone: "07700 900003",
    ec_name: "Peter McKinnon", ec_phone: "07700 900004",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-10", next11: "2025-12-10",
  },
  {
    id: "cc_red_2", email: "cc2.red@station.local", name: "Gavin Weir",
    role: "CC", watch: "Red", rank: "Crew Commander",
    svc: "SF-R2013-003", hire: "2013-03-18", phone: "07700 900005",
    ec_name: "Amy Weir", ec_phone: "07700 900006",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-12", next11: "2025-12-12",
  },
  {
    id: "ff_red_1", email: "ff1.red@station.local", name: "Steven Donaldson",
    role: "FF", watch: "Red", rank: "Firefighter",
    svc: "SF-R2018-004", hire: "2018-06-01", phone: "07700 900007",
    ec_name: "Kate Donaldson", ec_phone: "07700 900008",
    skills: ["BA", "Driver - LGV"],
    certs: ["BA Wearer", "LGV Licence"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-15", next11: "2025-12-15",
  },
  {
    id: "ff_red_2", email: "ff2.red@station.local", name: "Catriona MacLeod",
    role: "FF", watch: "Red", rank: "Firefighter",
    svc: "SF-R2019-005", hire: "2019-11-14", phone: "07700 900009",
    ec_name: "Alasdair MacLeod", ec_phone: "07700 900010",
    skills: ["BA", "First Aid"],
    certs: ["BA Wearer", "First Aid Level 3"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-01", next11: "2026-01-01",
  },
  {
    id: "ff_red_3", email: "ff3.red@station.local", name: "Jamie Robertson",
    role: "FF", watch: "Red", rank: "Leading Firefighter",
    svc: "SF-R2015-006", hire: "2015-02-28", phone: "07700 900011",
    ec_name: "Susan Robertson", ec_phone: "07700 900012",
    skills: ["BA", "Driver - ERD", "First Aid"],
    certs: ["BA Team Leader", "ERD Licence", "First Aid Level 3"],
    lgv: false, erd: true, prps: false, ba: true,
    notes: "Acting up Crew Commander when required",
    last11: "2025-09-20", next11: "2025-11-20",
  },
  {
    id: "ff_red_4", email: "ff4.red@station.local", name: "Roisin Daly",
    role: "FF", watch: "Red", rank: "Firefighter",
    svc: "SF-R2021-007", hire: "2021-08-23", phone: "07700 900013",
    ec_name: "Brendan Daly", ec_phone: "07700 900014",
    skills: ["BA", "PRPS"],
    certs: ["BA Wearer", "PRPS Certified"],
    lgv: false, erd: false, prps: true, ba: true,
    notes: null,
    last11: "2025-11-05", next11: "2026-01-05",
  },
  {
    id: "ff_red_5", email: "ff5.red@station.local", name: "Craig Sutherland",
    role: "FF", watch: "Red", rank: "Firefighter",
    svc: "SF-R2022-008", hire: "2022-04-04", phone: "07700 900015",
    ec_name: "Fay Sutherland", ec_phone: "07700 900016",
    skills: ["BA"],
    certs: ["BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: "Awaiting LGV assessment",
    last11: "2025-11-10", next11: "2026-01-10",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // WHITE WATCH
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "wc_white", email: "wc.white@station.local", name: "Linda Hargreaves",
    role: "WC", watch: "White", rank: "Watch Commander",
    svc: "SF-W2005-009", hire: "2005-07-11", phone: "07700 900017",
    ec_name: "Tom Hargreaves", ec_phone: "07700 900018",
    skills: ["Incident Command", "Management"],
    certs: ["Gold Command", "Incident Command Level 4"],
    lgv: false, erd: false, prps: false, ba: false,
    notes: null,
    last11: "2025-10-03", next11: "2025-12-03",
  },
  {
    id: "cc_white_1", email: "cc1.white@station.local", name: "Neil Patterson",
    role: "CC", watch: "White", rank: "Crew Commander",
    svc: "SF-W2010-010", hire: "2010-01-17", phone: "07700 900019",
    ec_name: "Julie Patterson", ec_phone: "07700 900020",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-08", next11: "2025-12-08",
  },
  {
    id: "cc_white_2", email: "cc2.white@station.local", name: "Fiona MacPherson",
    role: "CC", watch: "White", rank: "Crew Commander",
    svc: "SF-W2012-011", hire: "2012-05-22", phone: "07700 900021",
    ec_name: "Angus MacPherson", ec_phone: "07700 900022",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-14", next11: "2025-12-14",
  },
  {
    id: "ff_white_1", email: "ff1.white@station.local", name: "Mark Gibson",
    role: "FF", watch: "White", rank: "Firefighter",
    svc: "SF-W2017-012", hire: "2017-09-04", phone: "07700 900023",
    ec_name: "Claire Gibson", ec_phone: "07700 900024",
    skills: ["BA", "Driver - LGV"],
    certs: ["BA Wearer", "LGV Licence"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-20", next11: "2025-12-20",
  },
  {
    id: "ff_white_2", email: "ff2.white@station.local", name: "Siobhan Murray",
    role: "FF", watch: "White", rank: "Leading Firefighter",
    svc: "SF-W2014-013", hire: "2014-11-30", phone: "07700 900025",
    ec_name: "Declan Murray", ec_phone: "07700 900026",
    skills: ["BA", "First Aid", "PRPS"],
    certs: ["BA Team Leader", "First Aid Level 3", "PRPS Certified"],
    lgv: false, erd: false, prps: true, ba: true,
    notes: "PRPS watch lead",
    last11: "2025-09-25", next11: "2025-11-25",
  },
  {
    id: "ff_white_3", email: "ff3.white@station.local", name: "Andy Crawford",
    role: "FF", watch: "White", rank: "Firefighter",
    svc: "SF-W2019-014", hire: "2019-03-07", phone: "07700 900027",
    ec_name: "Gail Crawford", ec_phone: "07700 900028",
    skills: ["BA"],
    certs: ["BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-02", next11: "2026-01-02",
  },
  {
    id: "ff_white_4", email: "ff4.white@station.local", name: "Tracey Sinclair",
    role: "FF", watch: "White", rank: "Firefighter",
    svc: "SF-W2020-015", hire: "2020-07-13", phone: "07700 900029",
    ec_name: "John Sinclair", ec_phone: "07700 900030",
    skills: ["BA", "Driver - LGV"],
    certs: ["BA Wearer", "LGV Licence"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-28", next11: "2025-12-28",
  },
  {
    id: "ff_white_5", email: "ff5.white@station.local", name: "Ross Fleming",
    role: "FF", watch: "White", rank: "Firefighter",
    svc: "SF-W2021-016", hire: "2021-01-11", phone: "07700 900031",
    ec_name: "Anne Fleming", ec_phone: "07700 900032",
    skills: ["BA", "Hazmat"],
    certs: ["BA Wearer", "Hazmat Operations"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-06", next11: "2026-01-06",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // GREEN WATCH
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "wc_green", email: "wc.green@station.local", name: "Paul Edmondson",
    role: "WC", watch: "Green", rank: "Watch Commander",
    svc: "SF-G2009-017", hire: "2009-02-16", phone: "07700 900033",
    ec_name: "Diane Edmondson", ec_phone: "07700 900034",
    skills: ["Incident Command", "Management"],
    certs: ["Gold Command", "Incident Command Level 4"],
    lgv: false, erd: false, prps: false, ba: false,
    notes: null,
    last11: "2025-10-05", next11: "2025-12-05",
  },
  {
    id: "cc_green_1", email: "cc1.green@station.local", name: "Angela Petrie",
    role: "CC", watch: "Green", rank: "Crew Commander",
    svc: "SF-G2012-018", hire: "2012-08-08", phone: "07700 900035",
    ec_name: "Robert Petrie", ec_phone: "07700 900036",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-11", next11: "2025-12-11",
  },
  {
    id: "cc_green_2", email: "cc2.green@station.local", name: "Brian Lamont",
    role: "CC", watch: "Green", rank: "Crew Commander",
    svc: "SF-G2014-019", hire: "2014-06-19", phone: "07700 900037",
    ec_name: "Patricia Lamont", ec_phone: "07700 900038",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-16", next11: "2025-12-16",
  },
  {
    id: "ff_green_1", email: "ff1.green@station.local", name: "Tony Hassan",
    role: "FF", watch: "Green", rank: "Firefighter",
    svc: "SF-G2019-020", hire: "2019-05-20", phone: "07700 900039",
    ec_name: "Sara Hassan", ec_phone: "07700 900040",
    skills: ["BA", "First Aid"],
    certs: ["BA Wearer", "First Aid Level 3"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-22", next11: "2025-12-22",
  },
  {
    id: "ff_green_2", email: "ff2.green@station.local", name: "Nicola Kerr",
    role: "FF", watch: "Green", rank: "Leading Firefighter",
    svc: "SF-G2015-021", hire: "2015-10-09", phone: "07700 900041",
    ec_name: "Ian Kerr", ec_phone: "07700 900042",
    skills: ["BA", "Driver - ERD"],
    certs: ["BA Team Leader", "ERD Licence"],
    lgv: false, erd: true, prps: false, ba: true,
    notes: null,
    last11: "2025-09-30", next11: "2025-11-30",
  },
  {
    id: "ff_green_3", email: "ff3.green@station.local", name: "David Muir",
    role: "FF", watch: "Green", rank: "Firefighter",
    svc: "SF-G2020-022", hire: "2020-02-03", phone: "07700 900043",
    ec_name: "Sandra Muir", ec_phone: "07700 900044",
    skills: ["BA"],
    certs: ["BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-03", next11: "2026-01-03",
  },
  {
    id: "ff_green_4", email: "ff4.green@station.local", name: "Fiona Campbell",
    role: "FF", watch: "Green", rank: "Firefighter",
    svc: "SF-G2021-023", hire: "2021-06-15", phone: "07700 900045",
    ec_name: "Douglas Campbell", ec_phone: "07700 900046",
    skills: ["BA", "PRPS"],
    certs: ["BA Wearer", "PRPS Certified"],
    lgv: false, erd: false, prps: true, ba: true,
    notes: null,
    last11: "2025-11-07", next11: "2026-01-07",
  },
  {
    id: "ff_green_5", email: "ff5.green@station.local", name: "Kyle Morrison",
    role: "FF", watch: "Green", rank: "Firefighter",
    svc: "SF-G2022-024", hire: "2022-09-26", phone: "07700 900047",
    ec_name: "Elaine Morrison", ec_phone: "07700 900048",
    skills: ["BA", "Driver - LGV"],
    certs: ["BA Wearer", "LGV Licence"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-09", next11: "2026-01-09",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // BLUE WATCH
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "wc_blue", email: "wc.blue@station.local", name: "Sarah Mitchell",
    role: "WC", watch: "Blue", rank: "Watch Commander",
    svc: "SF-B2008-025", hire: "2008-03-15", phone: "07700 900049",
    ec_name: "James Mitchell", ec_phone: "07700 900050",
    skills: ["Incident Command", "Management"],
    certs: ["Gold Command", "Incident Command Level 4"],
    lgv: false, erd: false, prps: false, ba: false,
    notes: null,
    last11: "2025-10-07", next11: "2025-12-07",
  },
  {
    id: "cc_blue_1", email: "cc1.blue@station.local", name: "James Rodriguez",
    role: "CC", watch: "Blue", rank: "Crew Commander",
    svc: "SF-B2013-026", hire: "2013-11-25", phone: "07700 900051",
    ec_name: "Maria Rodriguez", ec_phone: "07700 900052",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-09", next11: "2025-12-09",
  },
  {
    id: "cc_blue_2", email: "cc2.blue@station.local", name: "Emma Thompson",
    role: "CC", watch: "Blue", rank: "Crew Commander",
    svc: "SF-B2015-027", hire: "2015-04-30", phone: "07700 900053",
    ec_name: "David Thompson", ec_phone: "07700 900054",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-13", next11: "2025-12-13",
  },
  {
    id: "ff_blue_1", email: "ff1.blue@station.local", name: "Michael Chen",
    role: "FF", watch: "Blue", rank: "Firefighter",
    svc: "SF-B2018-028", hire: "2018-03-15", phone: "07700 900055",
    ec_name: "Lisa Chen", ec_phone: "07700 900056",
    skills: ["BA", "Driver - LGV", "First Aid"],
    certs: ["BA Wearer", "LGV Licence", "First Aid Level 3"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-15", next11: "2025-12-15",
  },
  {
    id: "ff_blue_2", email: "ff2.blue@station.local", name: "Lisa Anderson",
    role: "FF", watch: "Blue", rank: "Firefighter",
    svc: "SF-B2019-029", hire: "2019-06-01", phone: "07700 900057",
    ec_name: "Mark Anderson", ec_phone: "07700 900058",
    skills: ["BA", "PRPS", "Rope Rescue"],
    certs: ["BA Wearer", "PRPS Certified", "Technical Rescue"],
    lgv: false, erd: false, prps: true, ba: true,
    notes: null,
    last11: "2025-10-20", next11: "2025-12-20",
  },
  {
    id: "ff_blue_3", email: "ff3.blue@station.local", name: "Rachel Green",
    role: "FF", watch: "Blue", rank: "Leading Firefighter",
    svc: "SF-B2016-030", hire: "2016-08-22", phone: "07700 900059",
    ec_name: "John Green", ec_phone: "07700 900060",
    skills: ["BA", "Driver - ERD", "First Aid"],
    certs: ["BA Team Leader", "ERD Licence", "First Aid Level 3"],
    lgv: false, erd: true, prps: false, ba: true,
    notes: null,
    last11: "2025-09-15", next11: "2025-11-15",
  },
  {
    id: "ff_blue_4", email: "ff4.blue@station.local", name: "Tom Wilson",
    role: "FF", watch: "Blue", rank: "Firefighter",
    svc: "SF-B2021-031", hire: "2021-04-05", phone: "07700 900061",
    ec_name: "Karen Wilson", ec_phone: "07700 900062",
    skills: ["BA", "Swift Water"],
    certs: ["BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-10", next11: "2026-01-10",
  },
  {
    id: "ff_blue_5", email: "ff5.blue@station.local", name: "Ahmed Hassan",
    role: "FF", watch: "Blue", rank: "Firefighter",
    svc: "SF-B2018-032", hire: "2018-07-22", phone: "07700 900063",
    ec_name: "Fatima Hassan", ec_phone: "07700 900064",
    skills: ["BA", "First Aid", "Rope Rescue"],
    certs: ["BA Wearer", "First Aid Level 3", "Technical Rescue"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-18", next11: "2025-12-18",
  },

  // ════════════════════════════════════════════════════════════════════════════
  // AMBER WATCH
  // ════════════════════════════════════════════════════════════════════════════
  {
    id: "wc_amber", email: "wc.amber@station.local", name: "Callum Buchanan",
    role: "WC", watch: "Amber", rank: "Watch Commander",
    svc: "SF-A2006-033", hire: "2006-10-30", phone: "07700 900065",
    ec_name: "Moira Buchanan", ec_phone: "07700 900066",
    skills: ["Incident Command", "Management"],
    certs: ["Gold Command", "Incident Command Level 4"],
    lgv: false, erd: false, prps: false, ba: false,
    notes: null,
    last11: "2025-10-06", next11: "2025-12-06",
  },
  {
    id: "cc_amber_1", email: "cc1.amber@station.local", name: "Karen Stevenson",
    role: "CC", watch: "Amber", rank: "Crew Commander",
    svc: "SF-A2011-034", hire: "2011-12-01", phone: "07700 900067",
    ec_name: "Alan Stevenson", ec_phone: "07700 900068",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-11", next11: "2025-12-11",
  },
  {
    id: "cc_amber_2", email: "cc2.amber@station.local", name: "Martin Doyle",
    role: "CC", watch: "Amber", rank: "Crew Commander",
    svc: "SF-A2013-035", hire: "2013-07-14", phone: "07700 900069",
    ec_name: "Siobhan Doyle", ec_phone: "07700 900070",
    skills: ["First Aid", "Management", "BA"],
    certs: ["First Aid Level 3", "Crew Commander Qual", "BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-17", next11: "2025-12-17",
  },
  {
    id: "ff_amber_1", email: "ff1.amber@station.local", name: "Ryan Mackay",
    role: "FF", watch: "Amber", rank: "Firefighter",
    svc: "SF-A2019-036", hire: "2019-02-18", phone: "07700 900071",
    ec_name: "Julie Mackay", ec_phone: "07700 900072",
    skills: ["BA", "Driver - LGV"],
    certs: ["BA Wearer", "LGV Licence"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-23", next11: "2025-12-23",
  },
  {
    id: "ff_amber_2", email: "ff2.amber@station.local", name: "Laura Forbes",
    role: "FF", watch: "Amber", rank: "Leading Firefighter",
    svc: "SF-A2016-037", hire: "2016-05-06", phone: "07700 900073",
    ec_name: "Chris Forbes", ec_phone: "07700 900074",
    skills: ["BA", "First Aid", "PRPS"],
    certs: ["BA Team Leader", "First Aid Level 3", "PRPS Certified"],
    lgv: false, erd: false, prps: true, ba: true,
    notes: null,
    last11: "2025-09-28", next11: "2025-11-28",
  },
  {
    id: "ff_amber_3", email: "ff3.amber@station.local", name: "Declan O'Hara",
    role: "FF", watch: "Amber", rank: "Firefighter",
    svc: "SF-A2021-038", hire: "2021-10-04", phone: "07700 900075",
    ec_name: "Niamh O'Hara", ec_phone: "07700 900076",
    skills: ["BA"],
    certs: ["BA Wearer"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-04", next11: "2026-01-04",
  },
  {
    id: "ff_amber_4", email: "ff4.amber@station.local", name: "Gillian McAllister",
    role: "FF", watch: "Amber", rank: "Firefighter",
    svc: "SF-A2020-039", hire: "2020-03-09", phone: "07700 900077",
    ec_name: "Stuart McAllister", ec_phone: "07700 900078",
    skills: ["BA", "Driver - LGV"],
    certs: ["BA Wearer", "LGV Licence"],
    lgv: true, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-10-30", next11: "2025-12-30",
  },
  {
    id: "ff_amber_5", email: "ff5.amber@station.local", name: "Scott Drummond",
    role: "FF", watch: "Amber", rank: "Firefighter",
    svc: "SF-A2022-040", hire: "2022-07-27", phone: "07700 900079",
    ec_name: "Rachel Drummond", ec_phone: "07700 900080",
    skills: ["BA", "Hazmat"],
    certs: ["BA Wearer", "Hazmat Operations"],
    lgv: false, erd: false, prps: false, ba: true,
    notes: null,
    last11: "2025-11-11", next11: "2026-01-11",
  },
];

// ── Run ──────────────────────────────────────────────────────────────────────

console.log(`
🚒  Watch Commander — Multi-Watch Seed
   ${PEOPLE.length} accounts across 5 watches (Red · White · Green · Blue · Amber)
   Password for all: Password1!
`);

let created = 0;
let skipped = 0;

for (const p of PEOPLE) {
  // Check if user already exists — skip if so (idempotent)
  const existing = await sql`SELECT id FROM users WHERE id = ${p.id}`;
  if (existing.length > 0) {
    console.log(`⏭  ${p.name.padEnd(22)} (${p.watch.padEnd(5)} · ${p.role}) — already exists`);
    skipped++;
    continue;
  }

  // Insert user
  await sql`
    INSERT INTO users (
      id, email, name, role, watch_unit, rank,
      is_active, password_hash, created_at, updated_at
    ) VALUES (
      ${p.id}, ${p.email}, ${p.name}, ${p.role}, ${p.watch}, ${p.rank},
      true, ${HASH}, NOW(), NOW()
    )
  `;

  // Insert linked profile
  await sql`
    INSERT INTO firefighter_profiles (
      user_id, service_number, station, shift, rank, hire_date, phone,
      emergency_contact_name, emergency_contact_phone,
      skills, certifications,
      driver_lgv, driver_erd, prps, ba,
      notes, last_one_to_one_date, next_one_to_one_date,
      created_at, updated_at
    ) VALUES (
      ${p.id}, ${p.svc}, ${STATION}, ${p.watch + " Watch"}, ${p.rank},
      ${p.hire}::date, ${p.phone}, ${p.ec_name}, ${p.ec_phone},
      ${p.skills}, ${p.certs},
      ${p.lgv}, ${p.erd}, ${p.prps}, ${p.ba},
      ${p.notes}, ${p.last11}::date, ${p.next11}::date,
      NOW(), NOW()
    )
  `;

  console.log(`✓  ${p.name.padEnd(22)} (${p.watch.padEnd(5)} · ${p.role})`);
  created++;
}

console.log(`
${"─".repeat(52)}
✅  Done — ${created} created, ${skipped} skipped.
`);

if (created > 0) {
  console.log(`Login at: http://localhost:3000`);
  console.log(`
  Watch       Role  Email
  ─────────────────────────────────────────────────
  Red         WC    wc.red@station.local
  Red         CC    cc1.red@station.local
  Red         FF    ff1.red@station.local
  (replace "red" with white / green / blue / amber)
  (cc1/cc2 for crew commanders, ff1–ff5 for FFs)

  Password: Password1!
`);
}

await sql.end();
