import { describe, expect, it } from "vitest";
import { formatTaskLink, linkHost, parseTaskLink, taskLinks, tidyUrl } from "./taskLinks";

describe("tidyUrl", () => {
  it("keeps a web address and adds https:// when it was left off", () => {
    expect(tidyUrl("https://example.org/a?b=1")).toBe("https://example.org/a?b=1");
    expect(tidyUrl("  example.org/page ")).toBe("https://example.org/page");
  });
  it("refuses anything that isn't a web link", () => {
    expect(tidyUrl("javascript:alert(1)")).toBeNull();
    expect(tidyUrl("mailto:someone@example.org")).toBeNull();
    expect(tidyUrl("not a link")).toBeNull();
    expect(tidyUrl("hello")).toBeNull();
    expect(tidyUrl("")).toBeNull();
  });
});

describe("task links", () => {
  it("stores a name and address together, and reads them back", () => {
    const stored = formatTaskLink("https://example.org/ra", "  Risk   assessment ");
    expect(stored).toBe("Risk assessment\nhttps://example.org/ra");
    expect(parseTaskLink(stored)).toEqual({ url: "https://example.org/ra", label: "Risk assessment", named: true });
  });
  it("shows the site when there's no name", () => {
    expect(formatTaskLink("https://www.example.org/x")).toBe("https://www.example.org/x");
    expect(parseTaskLink("https://www.example.org/x")).toEqual({ url: "https://www.example.org/x", label: "example.org", named: false });
    expect(linkHost("https://www.example.org/x")).toBe("example.org");
  });
  it("skips attachments that aren't links, keeping each link's place", () => {
    expect(taskLinks(["photo.jpg", "https://example.org"]).map((l) => l.index)).toEqual([1]);
    expect(taskLinks(undefined)).toEqual([]);
  });
});
