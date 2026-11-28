// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from "vitest";
import { find, mount, wordsOf } from "../../test-support.js";
import "../mc-briefing-role-build-card.js";

afterEach(() => document.body.replaceChildren());

const card = {
  id: "01001",
  label: "Drop Kick",
  name: "Drop Kick",
  aspect: { aspect: "aggression", label: "Aggression", fill: 0xc62828, ink: 0xffffff },
  cost: 2,
  recommended: true,
  reason: "Cheap: costs 2",
};

describe("mc-briefing-role-build-card", () => {
  it("asks whether to add the card to the hero deck, and says its cost, aspect and why it is recommended", async () => {
    const el = await mount("mc-briefing-role-build-card", {
      model: { card, picture: { src: null, missing: "no scan" }, heroName: "Colossus", noun: "event", phone: false },
    });
    const words = wordsOf(el);
    expect(words).toContain("ADD DROP KICK TO COLOSSUS");
    expect(words).toContain("Cost 2 · Aggression");
    expect(words).toContain("Recommended: Cheap: costs 2");
    expect(find(el, "mc-briefing-card-thumb")).not.toBeNull();
  });

  it("a card with no reason says nothing about a recommendation", async () => {
    const el = await mount("mc-briefing-role-build-card", {
      model: {
        card: { ...card, reason: null, recommended: false },
        picture: { src: null },
        heroName: "Colossus",
        noun: "upgrade",
        phone: true,
      },
    });
    expect(wordsOf(el)).not.toContain("Recommended");
  });
});
