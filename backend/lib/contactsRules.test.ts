import { describe, expect, it } from "vitest";
import { canReadContacts, cleanContact } from "./contactsRules";

describe("cleanContact", () => {
  it("tidies spacing and joins several numbers with ' / '", () => {
    const r = cleanContact({ section: "  Control  and staffing ", name: " Control ", numbers: "3999,3711 ;  01505 000000", detail: " ", note: "" });
    expect(r).toEqual({ contact: { section: "Control and staffing", name: "Control", detail: null, numbers: "3999 / 3711 / 01505 000000", note: null } });
  });

  it("keeps what it's for and the note", () => {
    const r = cleanContact({ section: "People", name: "A Person", detail: "Property manager", numbers: "07000 000000", note: "Office hours" });
    expect("contact" in r && r.contact).toMatchObject({ detail: "Property manager", note: "Office hours" });
  });

  it("needs a heading, a name and a number with digits", () => {
    expect(cleanContact({ section: "", name: "X", numbers: "1" })).toEqual({ error: "Give it a heading to sit under." });
    expect(cleanContact({ section: "S", name: " ", numbers: "1" })).toEqual({ error: "Say who or what the number is for." });
    expect(cleanContact({ section: "S", name: "X", numbers: " / " })).toEqual({ error: "Add a number." });
    expect(cleanContact({ section: "S", name: "X", numbers: "ask at the office" })).toEqual({ error: "The number needs some digits in it." });
  });
});

describe("canReadContacts", () => {
  it("WC, CC and the admin always can", () => {
    expect(canReadContacts({ role: "WC" }, null)).toBe(true);
    expect(canReadContacts({ role: "CC" }, {})).toBe(true);
    expect(canReadContacts({ role: "FF", isAdmin: true }, {})).toBe(true);
  });

  it("a firefighter only when the switch is on", () => {
    expect(canReadContacts({ role: "FF" }, { contacts: true })).toBe(true);
    expect(canReadContacts({ role: "FF" }, { contacts: false })).toBe(false);
    expect(canReadContacts({ role: "FF" }, { calendar: true })).toBe(false);
    expect(canReadContacts({ role: "RO" }, null)).toBe(false);
  });

  it("reads switches saved as text", () => {
    expect(canReadContacts({ role: "FF" }, JSON.stringify({ contacts: true }))).toBe(true);
    expect(canReadContacts({ role: "FF" }, "not json")).toBe(false);
  });
});
