/**
 * Import Notion Personnel into Watch Commander Ops Hub
 *
 * Usage:
 *   1. Log into the app in your browser
 *   2. Open browser console (F12 → Console)
 *   3. Copy the JWT token from localStorage: localStorage.getItem("wc_token")
 *   4. Run: TOKEN=<your-token> npx tsx scripts/import-notion-personnel.ts
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
  console.error("ERROR: Set TOKEN env var. Get it from browser console: localStorage.getItem('wc_token')");
  process.exit(1);
}

// All 25 personnel from Notion Personnel database
const personnel = [
  // === AMBER WATCH ===
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

  // === WHITE WATCH ===
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

  // === BLUE WATCH ===
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

  // === RED WATCH ===
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

  // === GREEN WATCH ===
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

  // === NO WATCH ASSIGNED ===
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
];

async function main() {
  console.log(`\n🔥 Watch Commander Ops Hub — Notion Personnel Import`);
  console.log(`   API: ${API_URL}`);
  console.log(`   Personnel: ${personnel.length} records`);
  console.log(`   Mode: ${DRY_RUN ? "DRY RUN (no changes)" : "LIVE IMPORT"}\n`);

  // Summary by watch
  const watches: Record<string, number> = {};
  for (const p of personnel) {
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
        personnel,
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
