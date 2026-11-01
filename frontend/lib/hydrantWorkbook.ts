import { strFromU8, unzipSync } from "fflate";
import type { hydrants } from "@/client";

// Reads the SFRS hydrant route workbooks ("COG Hydrant Records (21-30).xlsx"
// etc.) in the browser: one sheet per route ("S.P 27", "SP.2.A"), the
// hydrant list in columns A–K under each "HYD NO" header, the last crew's
// comment in column X. An .xlsx is a zip of XML, so this needs only unzip.

const GONE = new Set(["abandoned", "removed", "remaoved", "no longer in use"]);
const COL = { hyd: "A", ref: "B", street: "D", location: "F", main: "H", surface: "I", marker: "J", dist: "K", comment: "X" } as const;

function xml(files: Record<string, Uint8Array>, path: string): Document | null {
  const f = files[path];
  return f ? new DOMParser().parseFromString(strFromU8(f), "application/xml") : null;
}

// Namespace-aware where the DOM supports it; plain tag names otherwise (the
// workbooks use the default namespace, so both find the same elements).
const byTag = (n: Document | Element, tag: string) => {
  const ns = n.getElementsByTagNameNS("*", tag);
  return Array.from(ns.length ? ns : n.getElementsByTagName(tag));
};
const text = (n: Element) => byTag(n, "t").map((t) => t.textContent ?? "").join("");

/** "S.P 27" → "27", "SP.2.A" → "2A", "SP.3.A+AA" → "3A+AA", "S.P 21B" → "21B"; null if it isn't a route sheet. */
export function routeFromSheet(name: string): string | null {
  const m = /^S\.?\s*P[\s.]*(\d+)[\s.]*(.*)$/i.exec(name.trim());
  return m ? m[1] + m[2].replace(/[^A-Za-z+]/g, "").toUpperCase() : null;
}

export function readHydrantWorkbook(buf: ArrayBuffer): hydrants.ImportHydrant[] {
  const files = unzipSync(new Uint8Array(buf));
  const book = xml(files, "xl/workbook.xml");
  const rels = xml(files, "xl/_rels/workbook.xml.rels");
  if (!book || !rels) throw new Error("This isn't an Excel workbook");
  const shared = byTag(xml(files, "xl/sharedStrings.xml") ?? new Document(), "si").map(text);
  const target = new Map(byTag(rels, "Relationship").map((r) => [r.getAttribute("Id"), r.getAttribute("Target") ?? ""]));

  const out: hydrants.ImportHydrant[] = [];
  for (const sheet of byTag(book, "sheet")) {
    const route = routeFromSheet(sheet.getAttribute("name") ?? "");
    const rid = sheet.getAttribute("r:id") ?? sheet.getAttributeNS("http://schemas.openxmlformats.org/officeDocument/2006/relationships", "id");
    const path = (target.get(rid) ?? "").replace(/^\/?(xl\/)?/, "xl/");
    const doc = route ? xml(files, path) : null;
    if (!route || !doc) continue;

    for (const row of byTag(doc, "row")) {
      const cells: Record<string, string> = {};
      for (const c of byTag(row, "c")) {
        const col = (c.getAttribute("r") ?? "").replace(/\d+/g, "");
        const t = c.getAttribute("t");
        const v = byTag(c, "v")[0]?.textContent ?? "";
        cells[col] = (t === "s" ? shared[Number(v)] ?? "" : t === "inlineStr" ? text(c) : v).trim();
      }
      const seq = Number(cells[COL.hyd]);
      if (cells[COL.hyd] === "" || !Number.isInteger(seq) || seq < 0 || !cells[COL.street]) continue; // 31A starts at 0
      const ref = cells[COL.ref] || null;
      const deadRef = !!ref && GONE.has(ref.toLowerCase());
      const deadNote = GONE.has((cells[COL.comment] ?? "").toLowerCase());
      const opt = (k: keyof typeof COL) => (cells[COL[k]] && cells[COL[k]] !== "None" ? cells[COL[k]] : null);
      out.push({
        route, seq, ref: deadRef ? null : ref, street: cells[COL.street],
        location: opt("location"), main_size: opt("main"), surface: opt("surface"), marker: opt("marker"), dist: opt("dist"),
        in_use: !deadRef && !deadNote,
      });
    }
  }
  return out;
}

/** Every hydrant from several workbooks, each route + number once (some sheets repeat a page). */
export async function readHydrantWorkbooks(files: File[]): Promise<hydrants.ImportHydrant[]> {
  const seen = new Set<string>();
  const all: hydrants.ImportHydrant[] = [];
  for (const f of files) {
    for (const h of readHydrantWorkbook(await f.arrayBuffer())) {
      const k = `${h.route}#${h.seq}`;
      if (seen.has(k)) continue;
      seen.add(k);
      all.push(h);
    }
  }
  return all;
}
