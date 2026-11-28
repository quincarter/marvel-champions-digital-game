// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, wordsOf } from "../../test-support.js";
import "../mc-briefing-pool-row.js";

afterEach(() => document.body.replaceChildren());

const row = {
  fieldId: "ally-1",
  name: "Black Cat",
  destination: "Put into play at setup.",
  destinationKind: "intoPlay",
  helps: true,
  card: { cardId: "01002", name: "Black Cat" },
  picture: { src: null, missing: "no scan" },
};

describe("mc-briefing-pool-row", () => {
  it("shows the card name in capitals, where it goes and a check for a card that helps", async () => {
    const el = await mount("mc-briefing-pool-row", { row });
    expect(wordsOf(el)).toContain("BLACK CAT");
    expect(wordsOf(el)).toContain("Put into play at setup.");
    expect(find(el, ".mark")?.textContent).toBe("✓");
    expect(find(el, "mc-briefing-framed-row")?.getAttribute("stripe")).toBe("heal");
  });

  it("marks a card against the team with a cross and a red stripe, and its picture inspects it", async () => {
    const el = await mount("mc-briefing-pool-row", { row: { ...row, helps: false } });
    expect(find(el, ".mark")?.textContent).toBe("✗");
    expect(find(el, "mc-briefing-framed-row")?.getAttribute("stripe")).toBe("red");
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="pool-card:ally-1"]')!);
    expect(seen).toEqual([{ type: "inspect", cardId: "01002", name: "Black Cat" }]);
  });
});
