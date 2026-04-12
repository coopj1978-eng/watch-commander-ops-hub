/**
 * Import Notion Personnel into Watch Commander Ops Hub
 *
 * Usage:
 *   1. Log into the app in your browser
 *   2. Open browser dev tools (F12 → Console tab)
 *   3. Type:  localStorage.getItem('auth_token')
 *   4. Copy the token string that appears
 *   5. Run:  TOKEN=<your-token> npx tsx scripts/import-notion-personnel.ts
 *
 * Or run against local dev:
 *   TOKEN=<your-token> API_URL=http://localhost:4000 npx tsx scripts/import-notion-personnel.ts
 *
 * Add DRY_RUN=1 to test without actually creating records.
 */

const API_URL = process.env.API_URL || "https://staging-watch-commander-ops-hub-8spi.encr.app";
const TOKEN = process.env.TOKEN;
const DRY_RUN = process.env.DRY_RUN === "1";

if (!TOKEN) {
  console.error("ERROR: Set TOKEN env var.");
  console.error("");
  console.error("To get your token:");
  console.error("  1. Log into Watch Commander in your browser");
  console.error("  2. Press F12 to open dev tools");
  console.error("  3. Go to Console tab");
  console.error("  4. Type:  localStorage.getItem('auth_token')");
  console.error("  5. Copy the string (without quotes)");
  console.error("");
  console.error("Then run:  TOKEN=<paste-here> npx tsx scripts/import-notion-personnel.ts");
  process.exit(1);
}

// All 45 personnel from Notion Personnel database
const personnel = [
  // ============================================================
  // AMBER WATCH (7)
  // ============================================================
  {
    name: "WC Martin Glancy",
    email: "",
    phone: "07999574601",
    staff_number: "4003000",
    rank: "Watch Commander",
    watch: "Amber",
    skills: ["Banks Person", "Mass Decon", "TTR", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "CC Ross Archiebald",
    email: "ross.hastie@firescotland.gov.uk",
    phone: "07584242101",
    staff_number: "4010275",
    rank: "Crew Commander",
    watch: "Amber",
    skills: ["Banks Person", "TTR"],
    drivers_pathway: [],
    competent: "Yes",
  },
  {
    name: "CC Ross Bain",
    email: "",
    phone: "07854946863",
    staff_number: "4003386",
    rank: "Crew Commander",
    watch: "Amber",
    skills: ["Banks Person", "TTR", "LGV", "Mass Decon", "PRPS Trained", "Hooklift"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "CC Bryan Thomson",
    email: "",
    phone: "07926641724",
    staff_number: "4009913",
    rank: "Crew Commander",
    watch: "Amber",
    skills: ["Banks Person", "LGV", "Mass Decon", "TTR", "PRPS Trained"],
    drivers_pathway: ["Driver"],
    competent: "Yes",
  },
  {
    name: "FF Stuart Watt",
    email: "",
    phone: "07876593030",
    staff_number: "4001839",
    rank: "Fire Fighter",
    watch: "Amber",
    skills: ["LGV", "Banks Person", "Mass Decon", "Mass Decon Instructor", "Hooklift"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Gavin Fleming",
    email: "",
    phone: "07585414948",
    staff_number: "4008649",
    rank: "Fire Fighter",
    watch: "Amber",
    skills: ["LGV", "Mass Decon", "Mass Decon Instructor", "Hooklift"],
    drivers_pathway: ["Blue Lights Completed"],
    competent: undefined,
  },
  {
    name: "FF Daniel Hazlett",
    email: "",
    phone: "07496851403",
    staff_number: "4010617",
    rank: "Fire Fighter",
    watch: "Amber",
    skills: ["Banks Person", "Mass Decon Instructor"],
    drivers_pathway: [],
    competent: undefined,
  },

  // ============================================================
  // WHITE WATCH (9)
  // ============================================================
  {
    name: "CC Kevin Gallagher",
    email: "Kevin.Gallagher@firescotland.gov.uk",
    phone: "07428099655",
    staff_number: "4011160",
    rank: "Crew Commander",
    watch: "White",
    skills: ["PRPS Trained", "LGV", "Comp CC", "RTCI", "ICAT Intermediate", "Mass Decon"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "CC Kev Coulter",
    email: "",
    phone: "07849930898",
    staff_number: "4002600",
    rank: "Crew Commander",
    watch: "White",
    skills: ["Banks Person", "TTR", "Mass Decon", "Mass Decon Instructor", "PPRPS Instructor", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "CC John Cooper",
    email: "",
    phone: "07511391555",
    staff_number: "4003182",
    rank: "Crew Commander",
    watch: "White",
    skills: ["Banks Person", "LGV", "Mass Decon", "TTR", "Mass Decon Instructor", "PPRPS Instructor", "Hooklift", "PRPS Trained"],
    drivers_pathway: [],
    competent: "Yes",
  },
  {
    name: "FF Harriet Jakeman",
    email: "",
    phone: "07540345546",
    staff_number: "4013209",
    rank: "Fire Fighter",
    watch: "White",
    skills: ["LGV", "Comp", "Banks Person", "Hooklift", "Mass Decon"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Sam Gilmour",
    email: "sam.gilmour@firescotland.gov.uk",
    phone: "07460113895",
    staff_number: "4010850",
    rank: "Fire Fighter",
    watch: "White",
    skills: ["Banks Person", "Mass Decon", "LGV"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Douglas Stewart",
    email: "Douglas.Stewart2@firescotland.gov.uk",
    phone: "07568753797",
    staff_number: "4010294",
    rank: "Fire Fighter",
    watch: "White",
    skills: ["Banks Person", "LGV", "Mass Decon", "PRPS Trained", "Hooklift"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Ken Condonhealy",
    email: "",
    phone: "07484304058",
    staff_number: "4012022",
    rank: "FF in Progress",
    watch: "White",
    skills: ["Banks Person", "Mass Decon", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Chems Eddine Rebika",
    email: "",
    phone: "07771347592",
    staff_number: "4010625",
    rank: "Fire Fighter",
    watch: "White",
    skills: ["Comp", "Mass Decon"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Sam Degg",
    email: "",
    phone: "07445313912",
    staff_number: "4012086",
    rank: "FF in Progress",
    watch: "White",
    skills: ["Banks Person", "Mass Decon", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },

  // ============================================================
  // BLUE WATCH (7)
  // ============================================================
  {
    name: "WC Brian McPhee",
    email: "",
    phone: "07961838212",
    staff_number: "4002357",
    rank: "Watch Commander",
    watch: "Blue",
    skills: ["TTR", "Mass Decon", "Banks Person", "PRPS Trained"],
    drivers_pathway: ["None"],
    competent: "Yes",
  },
  {
    name: "CC Colin McParland",
    email: "",
    phone: "07539275692",
    staff_number: "4009034",
    rank: "Crew Commander",
    watch: "Blue",
    skills: ["Banks Person", "Mass Decon", "TTR", "PRPS Trained", "Comp", "Comp CC"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Iain Lowson",
    email: "",
    phone: "07587603333",
    staff_number: "4003043",
    rank: "Fire Fighter",
    watch: "Blue",
    skills: ["LGV", "Mass Decon", "Banks Person", "PRPS Trained", "Hooklift"],
    drivers_pathway: [],
    competent: "Yes",
  },
  {
    name: "FF Jordan Horner",
    email: "jordan.horner@firescotland.gov.uk",
    phone: "07411862747",
    staff_number: "4003393",
    rank: "Fire Fighter",
    watch: "Blue",
    skills: ["Banks Person", "LGV", "Mass Decon", "TTR", "PRPS Trained", "Hooklift"],
    drivers_pathway: ["LGV Passed"],
    competent: "Yes",
  },
  {
    name: "FF Chris Wilson",
    email: "",
    phone: "07846769324",
    staff_number: "4010503",
    rank: "Fire Fighter",
    watch: "Blue",
    skills: ["Banks Person", "Mass Decon", "PRPS Trained"],
    drivers_pathway: ["Medical Requested"],
    competent: "Yes",
  },
  {
    name: "FF Iain Wilson",
    email: "Iain.wilson@firescotland.gov.uk",
    phone: "07846769324",
    staff_number: "4011820",
    rank: "FF in Progress",
    watch: "Blue",
    skills: ["Mass Decon", "PRPS Trained", "Banks Person"],
    drivers_pathway: [],
    competent: "No",
  },
  {
    name: "FF Ewan Sime",
    email: "Ewan.Sime@Firescotland.gov.uk",
    phone: "07845701094",
    staff_number: "4012067",
    rank: "FF in Progress",
    watch: "Blue",
    skills: ["Mass Decon", "PRPS Trained", "Banks Person"],
    drivers_pathway: ["None"],
    competent: "No",
  },

  // ============================================================
  // RED WATCH (6)
  // ============================================================
  {
    name: "WC David Willaims",
    email: "",
    phone: "07876193578",
    staff_number: "4003335",
    rank: "Watch Commander",
    watch: "Red",
    skills: ["Banks Person", "Comp"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Craig Smith",
    email: "",
    phone: "07403119543",
    staff_number: "4003025",
    rank: "Fire Fighter",
    watch: "Red",
    skills: ["Banks Person", "LGV", "Mass Decon", "Hooklift"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Gordon Mackay",
    email: "",
    phone: "07984755077",
    staff_number: "4002079",
    rank: "Fire Fighter",
    watch: "Red",
    skills: ["Banks Person", "LGV", "Mass Decon", "PRPS Trained", "Hooklift"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Brian McDonald",
    email: "",
    phone: "07588285060",
    staff_number: "4002049",
    rank: "Fire Fighter",
    watch: "Red",
    skills: ["Mass Decon", "Banks Person", "LGV"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Jonathan Temple",
    email: "",
    phone: "07809195570",
    staff_number: "4010498",
    rank: "Fire Fighter",
    watch: "Red",
    skills: ["Banks Person", "Mass Decon"],
    drivers_pathway: [],
    competent: "Yes",
  },
  {
    name: "FF Jamie McEwan",
    email: "",
    phone: "07488294477",
    staff_number: "4002573",
    rank: "Fire Fighter",
    watch: "Red",
    skills: ["Banks Person", "Mass Decon", "Comp", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Ethan Brown",
    email: "",
    phone: "",
    staff_number: "4013176",
    rank: "FF in Progress",
    watch: "Red",
    skills: ["Mass Decon"],
    drivers_pathway: [],
    competent: undefined,
  },

  // ============================================================
  // GREEN WATCH (6)
  // ============================================================
  {
    name: "CC Donna James",
    email: "donna.james@firescotland.gov.uk",
    phone: "07969262259",
    staff_number: "4003259",
    rank: "Watch Commander",
    watch: "Green",
    skills: ["Banks Person", "Mass Decon", "TTR", "PRPS Trained"],
    drivers_pathway: ["None"],
    competent: "Yes",
  },
  {
    name: "FF John Dickson",
    email: "",
    phone: "07557117212",
    staff_number: "4009411",
    rank: "Fire Fighter",
    watch: "Green",
    skills: ["Banks Person", "LGV", "Mass Decon", "PRPS Trained", "Hooklift", "Comp"],
    drivers_pathway: ["Blue Lights Completed"],
    competent: undefined,
  },
  {
    name: "FF Gerry McAlpine",
    email: "",
    phone: "07545763739",
    staff_number: "4003067",
    rank: "Fire Fighter",
    watch: "Green",
    skills: ["Banks Person", "Mass Decon", "PRPS Trained"],
    drivers_pathway: ["None"],
    competent: "Yes",
  },
  {
    name: "FF Robert Hall",
    email: "",
    phone: "",
    staff_number: "",
    rank: "Fire Fighter",
    watch: "Green",
    skills: ["LGV", "Hooklift", "Banks Person", "Comp"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Connell Kelly",
    email: "",
    phone: "07837490725",
    staff_number: "4011378",
    rank: "Fire Fighter",
    watch: "Green",
    skills: ["Banks Person", "Mass Decon", "PRPS Trained", "Comp"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Chris Campbell",
    email: "",
    phone: "07718330538",
    staff_number: "4009617",
    rank: "Fire Fighter",
    watch: "Green",
    skills: ["Banks Person", "Mass Decon", "PRPS Trained", "Comp"],
    drivers_pathway: [],
    competent: undefined,
  },

  // ============================================================
  // UNASSIGNED WATCH (10)
  // ============================================================
  {
    name: "WC Iain Hannah",
    email: "",
    phone: "07764488081",
    staff_number: "4001941",
    rank: "Watch Commander",
    watch: "",
    skills: ["Banks Person", "Mass Decon", "TTR", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "WM John Mclaughlin",
    email: "",
    phone: "07730006442",
    staff_number: "4002340",
    rank: "Watch Commander",
    watch: "",
    skills: ["Banks Person", "Mass Decon", "TTR", "Mass Decon Instructor", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "WC Gary Canning",
    email: "",
    phone: "07912974276",
    staff_number: "4002844",
    rank: "Watch Commander",
    watch: "",
    skills: ["Banks Person", "Mass Decon", "TTR", "Mass Decon Instructor", "PPRPS Instructor", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "Kevin McCaig",
    email: "",
    phone: "07527000270",
    staff_number: "4003271",
    rank: "Watch Commander",
    watch: "",
    skills: ["Banks Person", "LGV", "Mass Decon", "TTR", "Mass Decon Instructor", "PPRPS Instructor", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "CC Paul Duncan",
    email: "Paul.duncan@firescotland.gov.uk",
    phone: "07986845270",
    staff_number: "4003033",
    rank: "Watch Commander",
    watch: "",
    skills: ["LGV", "Mass Decon", "Hooklift", "PRPS Trained", "Mass Decon Instructor", "Banks Person"],
    drivers_pathway: [],
    competent: "Yes",
  },
  {
    name: "CC Barry Wood",
    email: "",
    phone: "07712420733",
    staff_number: "4003188",
    rank: "Crew Commander",
    watch: "",
    skills: ["Banks Person", "LGV", "Mass Decon", "TTR", "PRPS Trained", "Hooklift"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "CC Andrew Miller",
    email: "",
    phone: "07921505037",
    staff_number: "4008237",
    rank: "Crew Commander",
    watch: "",
    skills: ["Banks Person", "Mass Decon", "TTR", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF Paul Blackwood",
    email: "",
    phone: "07415419901",
    staff_number: "4009402",
    rank: "Crew Commander",
    watch: "",
    skills: ["LGV", "Mass Decon", "Banks Person", "TTR", "PRPS Trained", "Hooklift"],
    drivers_pathway: [],
    competent: undefined,
  },
  {
    name: "FF David Binning",
    email: "",
    phone: "07465978045",
    staff_number: "4010691",
    rank: "Fire Fighter",
    watch: "",
    skills: ["Mass Decon", "PRPS Trained"],
    drivers_pathway: ["None"],
    competent: "Yes",
  },
  {
    name: "FF Jamie McEwan",
    email: "",
    phone: "07488294477",
    staff_number: "4002573",
    rank: "Fire Fighter",
    watch: "Red",
    skills: ["Banks Person", "Mass Decon", "Comp", "PRPS Trained"],
    drivers_pathway: [],
    competent: undefined,
  },
];

// Deduplicate by staff_number (in case any duplicates)
const seen = new Set<string>();
const dedupedPersonnel = personnel.filter(p => {
  const key = p.staff_number || p.name;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
});

async function main() {
  console.log(`\n🔥 Watch Commander Ops Hub — Notion Personnel Import`);
  console.log(`   API: ${API_URL}`);
  console.log(`   Personnel: ${dedupedPersonnel.length} records`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE IMPORT"}\n`);

  // Summary by watch
  const watches: Record<string, number> = {};
  for (const p of dedupedPersonnel) {
    const w = p.watch || "Unassigned";
    watches[w] = (watches[w] || 0) + 1;
  }
  console.log("   By watch:", Object.entries(watches).map(([k, v]) => `${k}: ${v}`).join(", "));
  console.log();

  try {
    const res = await fetch(`${API_URL}/import/notion-personnel`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${TOKEN}`,
      },
      body: JSON.stringify({
        personnel: dedupedPersonnel,
        dry_run: DRY_RUN,
        station: "Pollok",
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`❌ API error ${res.status}: ${err}`);
      process.exit(1);
    }

    const result = await res.json();

    console.log(`\n✅ Import complete!`);
    console.log(`   Created: ${result.created}`);
    console.log(`   Skipped: ${result.skipped}`);
    console.log(`   Errors:  ${result.errors?.length || 0}\n`);

    if (result.details) {
      console.log("Details:");
      for (const d of result.details) {
        const icon = d.status === "created" ? "✅" :
                     d.status.startsWith("skipped") ? "⏭️" :
                     d.status.startsWith("error") ? "❌" : "🔍";
        console.log(`  ${icon} ${d.name} — ${d.status}${d.user_id ? ` (${d.user_id})` : ""}`);
      }
    }

    if (result.errors?.length > 0) {
      console.log("\nErrors:");
      for (const e of result.errors) {
        console.log(`  ❌ ${e}`);
      }
    }

  } catch (err: any) {
    console.error(`❌ Failed to connect: ${err.message}`);
    process.exit(1);
  }
}

main();
