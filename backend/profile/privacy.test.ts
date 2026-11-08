import { describe, expect, it } from "vitest";
import { contactsFor } from "./privacy";

const profile = { user_id: "jo", phone: "07000 000000", emergency_contact_name: "Sam", emergency_contact_phone: "07111 111111", rank: "FF" };

describe("contacts on a profile", () => {
  it("are kept for the person themselves and for a WC/CC", () => {
    expect(contactsFor(profile, { userID: "jo", isManager: false }).phone).toBe("07000 000000");
    expect(contactsFor(profile, { userID: "boss", isManager: true }).emergency_contact_phone).toBe("07111 111111");
  });

  it("are taken off for a colleague", () => {
    const seen = contactsFor(profile, { userID: "colleague", isManager: false });
    expect(seen).toEqual({ user_id: "jo", rank: "FF" });
  });
});
