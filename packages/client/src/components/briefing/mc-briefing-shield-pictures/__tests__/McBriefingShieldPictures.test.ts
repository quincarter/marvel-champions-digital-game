// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, stopsOf, wordsOf } from "../../test-support.js";
import "../mc-briefing-shield-pictures.js";

afterEach(() => document.body.replaceChildren());

const cards = [
  { cardId: "50001", name: "Chief Medical Officer", caption: "3 secrets", picture: { src: null, missing: "no scan" } },
  {
    cardId: "50002",
    name: "Chief Scientist",
    caption: "Attachment · 1 secret",
    picture: { src: null, missing: "no scan" },
  },
];

describe("mc-briefing-shield-pictures", () => {
  it("each picture is a stop named by the key base and its index, with its words under it", async () => {
    const el = await mount("mc-briefing-shield-pictures", { cards, keyBase: "shield-board" });
    expect(stopsOf(el)).toEqual(["shield-board-0", "shield-board-1"]);
    expect(wordsOf(el)).toContain("3 SECRETS");
    expect(wordsOf(el)).toContain("ATTACHMENT · 1 SECRET");
  });

  it("a press reads the card in Inspect", async () => {
    const el = await mount("mc-briefing-shield-pictures", { cards, keyBase: "shield-board" });
    const seen = briefingEvents(el);
    press(find(el, '[data-stop="shield-board-0"]')!);
    expect(seen).toEqual([{ type: "inspect", cardId: "50001", name: "Chief Medical Officer" }]);
  });
});
