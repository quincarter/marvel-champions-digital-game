// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import type { PressEvent } from "@mc/ui";
import { find, mount, press, wordsOf } from "../../test-support.js";
import "../mc-briefing-deck-row.js";

afterEach(() => document.body.replaceChildren());

describe("mc-briefing-deck-row", () => {
  it("is one focus stop whose press opens that seat deck", async () => {
    const el = await mount("mc-briefing-deck-row", {
      stop: "deck-seat-2",
      row: { seat: 2, title: "COLOSSUS · PROTECTION", count: "40", problem: null },
    });
    const seen: PressEvent["detail"][] = [];
    el.addEventListener("mc-pressed", (event) => seen.push((event as PressEvent).detail));
    press(el);
    expect(seen).toEqual([{ action: { type: "edit-decks", seat: 2 }, hold: false }]);
    expect(el.getAttribute("data-stop")).toBe("deck-seat-2");
    expect(wordsOf(el)).toBe("COLOSSUS · PROTECTION 40 ▸");
  });

  it("names a problem in words behind a bang, never colour alone", async () => {
    const el = await mount("mc-briefing-deck-row", {
      stop: "deck-seat-1",
      row: { seat: 1, title: "A", count: "39", problem: "needs 40 cards" },
    });
    expect(find(el, ".why")?.textContent).toBe("! needs 40 cards");
    expect(find(el, ".row")?.classList.contains("problem")).toBe(true);
  });
});
