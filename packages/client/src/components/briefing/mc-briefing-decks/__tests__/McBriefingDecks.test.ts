// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, findAll, mount, press, wordsOf } from "../../test-support.js";
import "../mc-briefing-decks.js";

afterEach(() => document.body.replaceChildren());

const model = {
  rows: [
    { seat: 1, title: "COLOSSUS · PRO", count: "40", problem: null },
    { seat: 2, title: "WASP · LEA", count: "40 + 2 pinned", problem: "needs 1 more card" },
  ],
  note: "Rewards do not count toward the deck size.",
  waiting: null,
};

describe("mc-briefing-decks", () => {
  it("a deck row raises edit-decks for its seat", async () => {
    const el = await mount("mc-briefing-decks", { model });
    const seen = briefingEvents(el);
    const rows = findAll(el, "mc-briefing-deck-row");
    expect(rows.map((row) => row.getAttribute("data-stop"))).toEqual(["deck-seat-1", "deck-seat-2"]);
    press(rows[1]!);
    expect(seen).toEqual([{ type: "edit-decks", seat: 2 }]);
    expect(wordsOf(el)).toContain("DECKS");
    expect(find(el, ".note")?.textContent).toBe("Rewards do not count toward the deck size.");
  });

  it("lists no deck while the issue waits on a call", async () => {
    const el = await mount("mc-briefing-decks", { model: { ...model, waiting: "Answer the call to see the decks." } });
    expect(findAll(el, "mc-briefing-deck-row")).toHaveLength(0);
    expect(wordsOf(el)).toContain("Answer the call to see the decks.");
  });
});
