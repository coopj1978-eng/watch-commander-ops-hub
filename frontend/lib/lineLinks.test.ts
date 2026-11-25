import { describe, expect, it } from "vitest";
import { linkOf, linksForSave, linksFromChecklist, moveLineLink, readTypedLink, setLineLink } from "./lineLinks";

describe("a link on a tick line", () => {
  it("is found by the line's wording, whatever the capitals", () => {
    const links = setLineLink({}, "BA sets", "https://example.org/ba");
    expect(linkOf(links, "ba sets ")).toBe("https://example.org/ba");
    expect(linkOf(links, "Ladders")).toBeUndefined();
    expect(setLineLink(links, "BA SETS", null)).toEqual({});
  });

  it("follows the line when it's reworded", () => {
    const links = setLineLink({}, "BA sets", "https://example.org/ba");
    const moved = moveLineLink(links, "BA sets", "BA sets and cylinders");
    expect(linkOf(moved, "BA sets and cylinders")).toBe("https://example.org/ba");
    expect(linkOf(moved, "BA sets")).toBeUndefined();
    // a line with no link: nothing to move
    expect(moveLineLink({}, "Ladders", "Ladders and lines")).toEqual({});
  });

  it("is only sent for lines the card still has", () => {
    const links = { "ba sets": "https://example.org/ba", "gone": "https://example.org/x" };
    expect(linksForSave(links, ["BA sets", "Ladders"])).toEqual([{ label: "BA sets", url: "https://example.org/ba" }]);
  });

  it("is read back from a saved checklist", () => {
    expect(linksFromChecklist([{ label: "BA sets", url: "https://example.org/ba" }, { label: "Ladders" }]))
      .toEqual({ "ba sets": "https://example.org/ba" });
  });
});

describe("what's typed into the link box", () => {
  it("takes a web address, adding https:// when it's left off", () => {
    expect(readTypedLink("https://example.org/guide")).toEqual({ url: "https://example.org/guide" });
    expect(readTypedLink(" example.org/guide ")).toEqual({ url: "https://example.org/guide" });
  });
  it("takes nothing as 'no link'", () => {
    expect(readTypedLink("   ")).toEqual({ clear: true });
  });
  it("turns away what isn't a web address", () => {
    expect(readTypedLink("see the folder")).toEqual({ bad: true });
    expect(readTypedLink("javascript:alert(1)")).toEqual({ bad: true });
  });
});
