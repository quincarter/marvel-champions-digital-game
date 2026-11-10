import { PLAYABLE_CARDS } from "@mc/content";
import { describe, expect, it } from "vitest";
import { PLAYABLE_ABILITIES } from "./playable/index.js";

/**
 * "A <hero> card" on a player card means a card of that identity's set, not a card titled <hero> (issue #640: Miles
 * Morales's "shuffle 1 Spider-Man card" offered the basic "Spider-Man" allies and none of his own cards). The Sinister
 * Motives deck list files his signature cards under "Spider-Man cards" and the Peter Parker ally under "Basic cards";
 * RRG 1.8 "Identity-Specific Card" (p. 23) calls them the cards that belong to an identity's set. Colossus, Hulkling,
 * Daredevil, Quicksilver and the rest already read it this way.
 *
 * So every ability on a card whose text says "<hero title> card(s)" must read the set: `identitySetOf`
 * (`{ identitySetOf: you }`) or `identitySetTitled` (`ofIdentitySetTitled`, `ofTeamUpSet`). A new card that names its
 * hero's cards fails here until it does. An exemption is listed by card id with the reason.
 */
const EXEMPT: ReadonlyMap<string, string> = new Map([
  // Avatar of Life's "more than 1 copy of any non-Adam Warlock card" is a deck-building rule, checked by
  // `validateDeck` (`IdentityDeckbuilding.maxCopiesPerTitle`, packages/engine/src/deck.ts) against the identity set.
  ["21031a", "deck-building rule in validateDeck"],
]);

type Face = { readonly text?: { readonly current?: string }; readonly abilities?: readonly { readonly id: string }[] };

const faces = (card: any): Face[] => [card, card.hero, card.alterEgo, card.flipSide].filter(Boolean);

const heroTitles = [
  ...new Set(
    (PLAYABLE_CARDS as readonly any[])
      .filter((card) => card.type === "hero_identity")
      .map((card) => card.hero?.faceName as string | undefined)
      .filter((name): name is string => Boolean(name)),
  ),
];

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const naming = heroTitles.map((title) => ({ title, pattern: new RegExp(`(^|[^\\w-])${escape(title)} cards?\\b`) }));

const readsTheSet = (definition: unknown): boolean => /"identitySet(Of|Titled)"/.test(JSON.stringify(definition));

describe('"a <hero> card" reads the identity set, never a title (issue #640)', () => {
  it("every ability on such a card filters by identity set", () => {
    const wrong: string[] = [];
    let found = 0;
    for (const card of PLAYABLE_CARDS as readonly any[]) {
      if (EXEMPT.has(card.id)) continue;
      for (const face of faces(card)) {
        const text = face.text?.current ?? "";
        const named = naming.filter(({ pattern }) => pattern.test(text)).map(({ title }) => title);
        if (named.length === 0) continue;
        found++;
        const refs = face.abilities ?? [];
        if (!refs.some((ref) => readsTheSet(PLAYABLE_ABILITIES[ref.id])))
          wrong.push(`${card.id} ${card.name} ("${named.join('", "')} card")`);
      }
    }
    expect(found).toBeGreaterThan(15);
    expect(wrong).toEqual([]);
  });
});
