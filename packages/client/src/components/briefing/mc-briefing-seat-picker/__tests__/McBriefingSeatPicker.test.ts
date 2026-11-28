// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, stopsOf } from "../../test-support.js";
import "../mc-briefing-seat-picker.js";

afterEach(() => document.body.replaceChildren());

const model = {
  title: "Edit which deck?",
  seats: [
    { seat: 1, label: "Colossus (seat 1)" },
    { seat: 2, label: "Wasp (seat 2)" },
  ],
  cancel: "Cancel",
};

describe("mc-briefing-seat-picker", () => {
  it("a seat button opens that seat deck, and its buttons are the only stops", async () => {
    const el = await mount("mc-briefing-seat-picker", { model });
    expect(stopsOf(el)).toEqual(["pick-seat-1", "pick-seat-2", "pick-cancel"]);
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="pick-seat-2"]')!);
    expect(seen).toEqual([{ type: "edit-decks", seat: 2 }]);
  });

  it("Cancel and a tap on the scrim both close it", async () => {
    const el = await mount("mc-briefing-seat-picker", { model });
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="pick-cancel"]')!);
    press(find(el, ".scrim")!);
    expect(seen).toEqual([{ type: "close-seat-picker" }, { type: "close-seat-picker" }]);
  });
});
