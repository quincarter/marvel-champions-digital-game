import { PLAYABLE_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { PLAYABLE_ABILITIES } from "./index.js";

/**
 * A player card's optional interrupt or response is limited to hero form only when its text says "Hero Interrupt" or
 * "Hero Response" (RRG 1.8 "Hero Interrupt" / "Hero Response"). A plain "Interrupt" or "Response" scripted as a hero
 * one is never offered in alter-ego form, and the player sees no window at all: Black Widow 54003, Jack Flag 20011,
 * the Inhuman allies 50105b and 50106b, and Passion for Justice 34020 were.
 *
 * Identity cards are left out (a hero face's abilities are only in play in hero form), and so are the cards below
 * whose trigger can only happen in hero form anyway, so the gate changes nothing.
 */
const ONLY_IN_HERO_FORM_ANYWAY = new Set([
  "35016.warrior-skill-interrupt", // "When your hero attacks"
  "61035.shakedown-response", // "After you attack and exactly defeat a minion"
]);

describe("optional interrupts and responses on player cards", () => {
  it("are hero-form only when the card prints a Hero Interrupt or Hero Response", () => {
    const cards = new Map(PLAYABLE_CARDS.map((card) => [card.id as string, card]));
    const gatedWithoutText = Object.entries(PLAYABLE_ABILITIES).flatMap(([id, definition]) => {
      const trigger = definition?.trigger as { kind: string; forced?: boolean; form?: string } | undefined;
      if (!trigger || (trigger.kind !== "interrupt" && trigger.kind !== "response")) return [];
      if (trigger.forced || trigger.form !== "hero" || ONLY_IN_HERO_FORM_ANYWAY.has(id)) return [];
      const card = cards.get(id.slice(0, id.indexOf(".")));
      if (!card || card.type === "hero_identity") return [];
      const printed = (card as { text?: { printed?: string } }).text?.printed ?? "";
      return /Hero (Interrupt|Response)/.test(printed) ? [] : [id];
    });
    expect(gatedWithoutText).toEqual([]);
  });
});
