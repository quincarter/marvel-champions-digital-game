
// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { briefingEvents, find, mount, press, wordsOf } from "../../test-support.js";
import "../mc-briefing-pick-card.js";

afterEach(() => document.body.replaceChildren());

const card = {
  caption: "Earns",
  earned: true,
  cardId: "01001",
  name: "Prepared Defenses",
  shape: "landscape",
  picture: { src: null, missing: "No scan" },
};

describe("mc-briefing-pick-card", () => {
  it("shows the caption in capitals and the card name, and a press on the picture inspects the card", async () => {
    const el = await mount("mc-briefing-pick-card", { card, stop: "call-scheme:Prepare Defenses:environment" });
    expect(wordsOf(el)).toContain("EARNS");
    expect(wordsOf(el)).toContain("Prepared Defenses");
    expect(find(el, ".label")?.classList.contains("heal")).toBe(true);
    const seen = briefingEvents(el);
    const thumb = find(el, "mc-briefing-card-thumb")!;
    expect(thumb.getAttribute("data-stop")).toBe("call-scheme:Prepare Defenses:environment");
    press(thumb);
    expect(seen).toEqual([{ type: "inspect", cardId: "01001", name: "Prepared Defenses" }]);
  });
});
