// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, findAll, mount, press, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-modular.js";

afterEach(() => document.body.replaceChildren());

const tile = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: id,
  detail: "6 cards · side schemes",
  status: "open",
  statusLabel: "",
  available: true,
  ...over,
});

const view = {
  question: "Choose genre set 1 of 2.",
  explain: "Each set you choose is shuffled into the encounter deck.",
  whatIs: "A genre set is a themed pack.",
  rule: "Nothing is checked off yet.",
  pickNumber: 1,
  pickTotal: 2,
  tiles: [tile("bomb_scare"), tile("sinister", { status: "chosen", statusLabel: "CHOSEN · PICK 1" }), tile("old", { status: "checkedOff", statusLabel: "CHECKED OFF", available: false })],
};

describe("mc-briefing-modular", () => {
  it("an offered set is a stop that answers with its id; a checked-off set is dimmed, spelled out and takes no press", async () => {
    const el = await mount("mc-briefing-modular", { view });
    expect(stopsOf(el)).toEqual(["call-option:bomb_scare", "call-option:sinister"]);
    expect(wordsOf(el)).toContain("CHECKED OFF");
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="call-option:bomb_scare"]')!);
    expect(seen).toEqual([{ type: "answer", picked: ["bomb_scare"] }]);
    expect(findAll(el, "mc-briefing-option-tile")).toHaveLength(3);
  });

  it("states the question, its rule and what a genre set is", async () => {
    const el = await mount("mc-briefing-modular", { view });
    expect(wordsOf(el)).toContain("Choose genre set 1 of 2.");
    expect(wordsOf(el)).toContain("Nothing is checked off yet.");
    expect(wordsOf(el)).toContain("A genre set is a themed pack.");
  });
});
