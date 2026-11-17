import { describe, expect, it } from "vitest";
import { bySection, hostOf, isInternal, parseGuide, parseInline, stepCount, textMatches } from "./guideMarkup";

describe("parseInline", () => {
  it("bold, a labelled link and a bare address", () => {
    expect(parseInline("Open **New Help Call** in [Property](https://example.org/p) or https://example.org/x.")).toEqual([
      { kind: "text", text: "Open " },
      { kind: "bold", text: "New Help Call" },
      { kind: "text", text: " in " },
      { kind: "link", text: "Property", href: "https://example.org/p" },
      { kind: "text", text: " or " },
      { kind: "link", text: "https://example.org/x", href: "https://example.org/x" },
      { kind: "text", text: "." },
    ]);
  });

  it("a mail address shows without mailto:", () => {
    expect(parseInline("Send to mailto:defects@example.org")).toEqual([
      { kind: "text", text: "Send to " },
      { kind: "link", text: "defects@example.org", href: "mailto:defects@example.org" },
    ]);
  });

  it("a script address is never a link", () => {
    expect(parseInline("[click](javascript:alert(1))")[0]).toEqual({ kind: "text", text: "click" });
    expect(parseInline("plain words")).toEqual([{ kind: "text", text: "plain words" }]);
  });
});

describe("parseGuide", () => {
  const body = [
    "To raise a defect, sign in first.",
    "",
    "## Steps",
    "1. Sign in",
    "2. New Help Call",
    "- [ ] Take the number",
    "- [ ]",
    "",
    "> Station computers only",
    "> Ask if stuck",
    "",
    "- Grass",
    "* Trees",
  ].join("\n");
  const blocks = parseGuide(body);

  it("paragraph, heading, steps, note, bullets", () => {
    expect(blocks.map((b) => b.kind)).toEqual(["para", "heading", "steps", "note", "bullets"]);
  });

  it("numbered lines and checkboxes run together as steps; empty checkboxes go", () => {
    const steps = blocks[2];
    expect(steps.kind === "steps" && steps.items.map((i) => i[0].kind === "text" && i[0].text)).toEqual(["Sign in", "New Help Call", "Take the number"]);
    expect(stepCount(body)).toBe(3);
  });

  it("note lines stay together; bullets take - and *", () => {
    const note = blocks[3];
    expect(note.kind === "note" && note.lines.length).toBe(2);
    const bullets = blocks[4];
    expect(bullets.kind === "bullets" && bullets.items.length).toBe(2);
  });

  it("an empty guide has no blocks", () => {
    expect(parseGuide("\n\n")).toEqual([]);
  });
});

describe("bySection", () => {
  it("sections in the order their first line sits, case-insensitive", () => {
    const g = bySection([
      { id: 3, section: "People", position: 4 },
      { id: 1, section: "Defects", position: 1 },
      { id: 2, section: "defects", position: 2 },
    ]);
    expect(g.map((s) => s.section)).toEqual(["Defects", "People"]);
    expect(g[0].lines.map((l) => l.id)).toEqual([1, 2]);
  });
});

describe("textMatches / hostOf / isInternal", () => {
  it("search ignores case and extra spaces", () => {
    expect(textMatches("ba  set", "Report a defective BA set")).toBe(true);
    expect(textMatches("", "anything")).toBe(true);
    expect(textMatches("hydrant", "Sickness", null)).toBe(false);
  });
  it("host and whether it only opens on the service network", () => {
    expect(hostOf("https://www.example.org/a")).toBe("example.org");
    expect(hostOf("nonsense")).toBe("");
    expect(isInternal("https://intranet/overview/")).toBe(true);
    expect(isInternal("https://rota.example.local/login")).toBe(true);
    expect(isInternal("https://example.sharepoint.com/sites/x")).toBe(false);
  });
});
