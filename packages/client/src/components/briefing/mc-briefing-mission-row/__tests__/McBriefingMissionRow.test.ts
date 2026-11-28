// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, wordsOf } from "../../test-support.js";
import "../mc-briefing-mission-row.js";

afterEach(() => document.body.replaceChildren());

const row = {
  key: "mission",
  kind: "Mission drawn",
  name: "Reach the Vault",
  detail: "Place 2 threat.",
  cardId: "45001",
};

describe("mc-briefing-mission-row", () => {
  it("shows the kind, the name in capitals and the line, and its chip reads the card", async () => {
    const el = await mount("mc-briefing-mission-row", { row });
    expect(wordsOf(el)).toContain("MISSION DRAWN");
    expect(wordsOf(el)).toContain("REACH THE VAULT");
    expect(wordsOf(el)).toContain("Place 2 threat.");
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="mission-mission"]')!);
    expect(seen).toEqual([{ type: "inspect", cardId: "45001", name: "Reach the Vault" }]);
  });

  it("a row with no card has no chip", async () => {
    const el = await mount("mc-briefing-mission-row", { row: { ...row, cardId: null } });
    expect(find(el, "mc-briefing-inspect-chip")).toBeNull();
  });
});
