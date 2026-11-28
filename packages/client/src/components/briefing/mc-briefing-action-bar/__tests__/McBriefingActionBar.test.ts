// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, stopsOf } from "../../test-support.js";
import "../mc-briefing-action-bar.js";

afterEach(() => document.body.replaceChildren());

const model = {
  editLabel: "EDIT DECKS",
  openLabel: "OPEN ISSUE #2 ▸",
  canOpen: true,
  openGlyph: null,
  reason: null,
  watch: { label: "Let people watch this game", on: false },
};

describe("mc-briefing-action-bar", () => {
  it("Edit decks and Open issue are stops that raise their events, with the watch toggle beside them", async () => {
    const el = await mount("mc-briefing-action-bar", { model });
    const seen = briefingEvents(el);
    expect(stopsOf(el)).toEqual(["watch", "edit-decks", "open"]);
    press(find(el, '[data-stop="edit-decks"]')!);
    press(find(el, '[data-stop="open"]')!);
    press(find(el, "mc-briefing-watch-toggle")!);
    expect(seen).toEqual([{ type: "edit-decks" }, { type: "open" }, { type: "watch" }]);
  });

  it("while Open waits it is not a stop and presses nothing, and the reason stands where the toggle was", async () => {
    const el = await mount("mc-briefing-action-bar", {
      model: { ...model, canOpen: false, reason: "Answer this to open issue #2.", watch: null },
    });
    expect(stopsOf(el)).toEqual(["edit-decks"]);
    expect(find(el, ".reason")?.textContent).toBe("Answer this to open issue #2.");
    const seen = briefingEvents(el);
    const open = find(el, "mc-hint-button")!;
    press(open);
    expect(seen).toEqual([]);
  });

  it("on a phone the reason and the toggle are the strip, not the bar", async () => {
    const el = await mount("mc-briefing-action-bar", { model, phone: true });
    expect(find(el, "mc-briefing-watch-toggle")).toBeNull();
    expect(stopsOf(el)).toEqual(["edit-decks", "open"]);
  });
});
