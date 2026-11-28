// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, stopsOf, wordsOf } from "../../../../components/briefing/test-support.js";
import "../mc-briefing-page.js";

afterEach(() => document.body.replaceChildren());

const base = {
  phone: false,
  topBar: {
    backLabel: "◂ Issues",
    title: "Briefing · Issue #2",
    right: "",
    backGlyph: null,
    titleDrop: 0,
    titleMaxRight: 0,
  },
  art: { picture: null, paneGround: "#3b3d42" },
  plan: { hasPool: false, seatCall: false, callOwnsScroll: false },
  speaker: { portrait: { picture: null, initial: "n" }, speaker: null, text: "Welcome back." },
  pool: null,
  handled: { rows: [{ key: "a", status: "done", title: "Villain set", detail: "" }], waiting: null },
  decks: {
    rows: [{ seat: 1, title: "COLOSSUS · PRO", count: "40", problem: null }],
    note: "Rewards do not count.",
    waiting: null,
  },
  sections: { scheme: null, mission: null, shield: null, easier: { on: false }, modes: [] },
  call: null,
  composing: null,
  actionBar: {
    editLabel: "EDIT DECKS",
    openLabel: "OPEN ISSUE #2 ▸",
    canOpen: true,
    openGlyph: null,
    reason: null,
    watch: { label: "Let people watch this game", on: false },
  },
  strip: null,
  error: null,
  seatPicker: null,
};

describe("mc-briefing-page", () => {
  it("composes the wide layout: the story and Handled for you on the left, the decks and the easier start on the right", async () => {
    const el = await mount("mc-briefing-page", { model: base });
    const stops = stopsOf(el);
    for (const key of ["back", "deck-seat-1", "easier-start", "edit-decks", "open", "watch"])
      expect(stops, key).toContain(key);
    expect(wordsOf(el)).toContain("HANDLED FOR YOU");
    expect(wordsOf(el)).toContain("Welcome back.");
    expect(find(el, ".columns")).not.toBeNull();
  });

  it("a phone is one scrolling page with the strip above the bar, and the bar has no toggle", async () => {
    const el = await mount("mc-briefing-page", {
      model: { ...base, phone: true, strip: { reason: "", watch: { label: "Let people watch this game", on: false } } },
    });
    expect(find(el, ".page")).not.toBeNull();
    expect(find(el, ".columns")).toBeNull();
    const stops = stopsOf(el);
    expect(stops.filter((key) => key === "watch")).toHaveLength(1);
  });

  it("every control raises one mc-briefing the scene hears", async () => {
    const el = await mount("mc-briefing-page", { model: base });
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="back"]')!);
    press(find(el, '[data-stop="deck-seat-1"]')!);
    press(find(el, '[data-stop="easier-start"]')!);
    press(find(el, '[data-stop="open"]')!);
    expect(seen).toEqual([
      { type: "back" },
      { type: "edit-decks", seat: 1 },
      { type: "toggle-easier" },
      { type: "open" },
    ]);
  });

  it("while a call scrolls itself the phone has no Decks panel", async () => {
    const el = await mount("mc-briefing-page", {
      model: { ...base, phone: true, plan: { hasPool: false, seatCall: true, callOwnsScroll: true } },
    });
    expect(stopsOf(el)).not.toContain("deck-seat-1");
  });

  it("the chooser is the page overlay while the model has one", async () => {
    const el = await mount("mc-briefing-page", {
      model: {
        ...base,
        seatPicker: { title: "Edit which deck?", seats: [{ seat: 1, label: "Colossus" }], cancel: "Cancel" },
      },
    });
    expect(stopsOf(el)).toContain("pick-seat-1");
  });
});
