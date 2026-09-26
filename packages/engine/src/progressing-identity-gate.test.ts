/**
 * docs/phase7-wave5.md §1.4: a progressing identity (the Ironheart insert, "New Rules: Progressing Identity Cards")
 * is data only until the swap is built (§3.23). Seating one version as a plain identity would play a different game,
 * so `createGame` refuses it and `validateDeck` reports it unsupported; a deck naming a later version is told that a
 * deck names the first. Synthetic cards only.
 */
import { cardId, type DeckContents, type HeroIdentityCard } from "@mc/content";
import { describe, expect, it } from "vitest";
import { validateDeck } from "./deck.js";
import { createGame, type GameSetupConfig } from "./setup.js";
import { stubIdentity } from "./testing/fixtures.js";
import { DEFAULT_CARDS, DEFAULT_DECK, HERO, MAIN_SCHEME, VILLAIN } from "./testing/scenario.js";

const VERSIONS = [cardId("iron-v1"), cardId("iron-v2"), cardId("iron-v3")] as const;
const version = (n: 1 | 2 | 3): HeroIdentityCard => ({
  ...stubIdentity({
    id: `iron-v${n}`,
    hp: 10,
    atk: 2,
    thw: n,
    def: 3,
    rec: 3,
    heroHandSize: 3 + n,
    alterEgoHandSize: 6,
  }),
  progressingIdentity: { versions: VERSIONS },
});
const V1 = version(1);
const V2 = version(2);

describe("a progressing identity is refused until §3.23 (docs/phase7-wave5.md §1.4)", () => {
  const base: GameSetupConfig = {
    seed: 1,
    cards: [...DEFAULT_CARDS, V1, V2],
    villainCardId: VILLAIN.id,
    mainSchemeCardId: MAIN_SCHEME.id,
    encounterDeck: [],
    includeIdentitySets: false,
    players: [{ identityCardId: HERO.id, deck: DEFAULT_DECK }],
  };

  it("createGame will not seat any version", () => {
    expect(createGame(base).ok).toBe(true);
    const result = createGame({ ...base, players: [{ identityCardId: V1.id, deck: DEFAULT_DECK }] });
    expect(result.ok ? null : result.error.message).toMatch(/progressing identity/);
  });

  it("validateDeck reports the first version unsupported, and a later version as not the one a deck names", () => {
    const problems = (identity: HeroIdentityCard) => {
      const deck: DeckContents = { identityCardId: identity.id, aspects: ["leadership"], cards: [] };
      const verdict = validateDeck(deck, [V1, V2]);
      return verdict.ok ? [] : verdict.problems.filter((p) => p.code === "unsupported_identity").map((p) => p.message);
    };
    expect(problems(V1)).toEqual([expect.stringMatching(/cannot play yet/)]);
    expect(problems(V2)).toEqual([expect.stringMatching(/a deck names its first version/)]);
  });
});
