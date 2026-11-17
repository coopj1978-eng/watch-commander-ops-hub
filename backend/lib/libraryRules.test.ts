import { describe, expect, it } from "vitest";
import { canReadSwitched, cleanGuide, cleanLink, cleanUrl } from "./libraryRules";

describe("canReadSwitched", () => {
  it("WC, CC and the admin always; a firefighter only with that page's switch on", () => {
    expect(canReadSwitched({ role: "WC" }, null, "guides")).toBe(true);
    expect(canReadSwitched({ role: "CC" }, {}, "links")).toBe(true);
    expect(canReadSwitched({ role: "FF", isAdmin: true }, {}, "guides")).toBe(true);
    expect(canReadSwitched({ role: "FF" }, { links: true }, "links")).toBe(true);
    expect(canReadSwitched({ role: "FF" }, { links: true }, "guides")).toBe(false);
    expect(canReadSwitched({ role: "FF" }, JSON.stringify({ guides: true }), "guides")).toBe(true);
    expect(canReadSwitched({ role: "RO" }, "nonsense", "guides")).toBe(false);
  });
});

describe("cleanUrl", () => {
  it("keeps http and https, including intranet names", () => {
    expect(cleanUrl(" https://example.org/a?b=1 ")).toBe("https://example.org/a?b=1");
    expect(cleanUrl("https://intranet/overview/")).toBe("https://intranet/overview/");
    expect(cleanUrl("http://example.org")).toBe("http://example.org/");
  });
  it("refuses scripts, other schemes and junk", () => {
    expect(cleanUrl("javascript:alert(1)")).toBeNull();
    expect(cleanUrl("data:text/html,x")).toBeNull();
    expect(cleanUrl("file:///etc/passwd")).toBeNull();
    expect(cleanUrl("example.org")).toBeNull();
    expect(cleanUrl("")).toBeNull();
  });
});

describe("cleanLink", () => {
  it("tidies and keeps the note", () => {
    expect(cleanLink({ section: " Systems ", title: " Rota  system ", url: "https://example.org", note: " Station computers only " })).toEqual({
      link: { section: "Systems", title: "Rota system", url: "https://example.org/", note: "Station computers only" },
    });
  });
  it("needs a heading, a name and a real address", () => {
    expect(cleanLink({ section: "", title: "x", url: "https://e.org" })).toEqual({ error: "Give it a heading to sit under." });
    expect(cleanLink({ section: "s", title: " ", url: "https://e.org" })).toEqual({ error: "Give the link a name." });
    expect(cleanLink({ section: "s", title: "x", url: "javascript:1" })).toEqual({ error: "The address needs to start with http:// or https://" });
  });
});

describe("cleanGuide", () => {
  it("keeps line breaks in the body, trims trailing spaces and extra blank lines", () => {
    const r = cleanGuide({ section: "Defects", title: "Raising a defect", summary: "  How to  log one ", body: "1. Sign in  \r\n2. New call\n\n\n\n> Note\n" });
    expect(r).toEqual({ guide: { section: "Defects", title: "Raising a defect", summary: "How to log one", body: "1. Sign in\n2. New call\n\n> Note" } });
  });
  it("an empty body is allowed; a title and heading are not optional", () => {
    expect("guide" in cleanGuide({ section: "s", title: "t", body: "" })).toBe(true);
    expect(cleanGuide({ section: "s", title: "", body: "x" })).toEqual({ error: "Give the guide a title." });
    expect(cleanGuide({ section: " ", title: "t", body: "x" })).toEqual({ error: "Give it a heading to sit under." });
  });
  it("refuses a body that's far too long", () => {
    expect(cleanGuide({ section: "s", title: "t", body: "x".repeat(20001) })).toEqual({ error: "That guide is too long. Split it into two." });
  });
});
