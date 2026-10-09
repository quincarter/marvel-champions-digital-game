/**
 * `TargetQuery.sharesTraitWithHeroOf` (docs/phase7-wave8.md §3.44): MC45 p. 20, "When playing expert campaign, the ally
 * you choose during Setup must share a trait with your hero." Campaign setup resolves while every identity is on its
 * alter-ego side (RRG 1.8 Appendix II step 1, p. 50), and `sharesTraitWith: identityOf(…)` reads the side that is up,
 * so it compares against the alter-ego's traits there. This field reads the hero side's printed traits whichever side
 * is up. Synthetic cards: the engine names no card.
 */
import { trait, type CardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import type { Command } from "./commands.js";
import { playerId, type InstanceId } from "./ids.js";
import { mustPlayer } from "./query.js";
import { matchesQuery, type EffectContext } from "./select.js";
import type { TargetQuery } from "./spec.js";
import type { GameState } from "./state.js";
import { stubAlly, stubIdentity } from "./testing/fixtures.js";
import { newGame, run } from "./testing/scenario.js";

const p1 = playerId("p1");
const p2 = playerId("p2");
const AVENGER = trait("AVENGER");
const XMEN = trait("X-MEN");
const GENIUS = trait("GENIUS");

const base = stubIdentity({
  id: "avenger-hero",
  hp: 10,
  atk: 2,
  thw: 2,
  def: 2,
  rec: 3,
  heroHandSize: 5,
  alterEgoHandSize: 6,
  heroTraits: [AVENGER],
});
/** Hero side [AVENGER], alter-ego side [GENIUS]. */
const IDENTITY = { ...base, alterEgo: { ...base.alterEgo, traits: [GENIUS] } };

const AVENGER_ALLY = stubAlly({ id: "avenger-ally", cost: 2, atk: 1, thw: 1, hp: 2, traits: [AVENGER] });
const XMEN_ALLY = stubAlly({ id: "xmen-ally", cost: 2, atk: 1, thw: 1, hp: 2, traits: [XMEN] });
const GENIUS_ALLY = stubAlly({ id: "genius-ally", cost: 2, atk: 1, thw: 1, hp: 2, traits: [GENIUS] });
const TRAITLESS_ALLY = stubAlly({ id: "traitless-ally", cost: 2, atk: 1, thw: 1, hp: 2 });
const ALLIES = [AVENGER_ALLY, XMEN_ALLY, GENIUS_ALLY, TRAITLESS_ALLY];

const copies = (id: CardId, n: number): readonly CardId[] => Array.from({ length: n }, () => id);
const game = (players = 1): GameState =>
  newGame({
    identity: IDENTITY,
    players,
    extraCards: ALLIES,
    deck: ALLIES.flatMap((ally) => copies(ally.id, 5)),
  });

const contextFor = (player = p1): EffectContext => ({
  selfInstanceId: null,
  controllerId: player,
  event: null,
  bindings: {},
  scopedPlayerId: player,
});

/** The card ids among `player`'s deck and hand that `query` matches, each once. */
function matched(state: GameState, query: TargetQuery, player = p1): readonly string[] {
  const owner = mustPlayer(state, player);
  const ids: readonly InstanceId[] = [...owner.deck, ...owner.hand];
  return [
    ...new Set(
      ids
        .filter((id) => matchesQuery(state, id, query, contextFor(player)))
        .map((id) => state.instances[id]!.cardId as string),
    ),
  ].sort();
}

const HERO_SIDE: TargetQuery = { categories: ["ally"], sharesTraitWithHeroOf: { kind: "controller" } };
const SIDE_THAT_IS_UP: TargetQuery = {
  categories: ["ally"],
  sharesTraitWith: { kind: "identityOf", player: { kind: "controller" } },
};
const toHero: Command = { type: "changeForm", playerId: p1 };

describe("TargetQuery.sharesTraitWithHeroOf (MC45 p. 20; docs/phase7-wave8.md §3.44)", () => {
  it("in alter-ego form it reads the hero side's traits: the [AVENGER] ally and no other", () => {
    const state = game();
    expect(mustPlayer(state, p1).identity.form).toBe("alterEgo");
    expect(matched(state, HERO_SIDE)).toEqual([AVENGER_ALLY.id]);
  });

  it("the gap it closes: `sharesTraitWith: identityOf(…)` reads the side that is up, the alter-ego's [GENIUS]", () => {
    expect(matched(game(), SIDE_THAT_IS_UP)).toEqual([GENIUS_ALLY.id]);
  });

  it("in hero form the two agree", () => {
    const state = run(game(), toHero);
    expect(mustPlayer(state, p1).identity.form).toBe("hero");
    expect(matched(state, HERO_SIDE)).toEqual([AVENGER_ALLY.id]);
    expect(matched(state, SIDE_THAT_IS_UP)).toEqual([AVENGER_ALLY.id]);
  });

  it("a card with no trait, and a card whose traits the hero does not have, never match", () => {
    const cards = matched(game(), HERO_SIDE);
    expect(cards).not.toContain(TRAITLESS_ALLY.id);
    expect(cards).not.toContain(XMEN_ALLY.id);
    expect(cards).not.toContain(GENIUS_ALLY.id);
  });

  it("each player's own hero is read: 'that player' inside a per-player loop", () => {
    const state = game(2);
    const scoped: TargetQuery = { categories: ["ally"], sharesTraitWithHeroOf: { kind: "scoped" } };
    expect(matched(state, scoped, p1)).toEqual([AVENGER_ALLY.id]);
    expect(matched(state, scoped, p2)).toEqual([AVENGER_ALLY.id]);
  });

  it("a hero with no traits shares none", () => {
    const traitless = { ...IDENTITY, hero: { ...IDENTITY.hero, traits: [] } };
    const state = newGame({
      identity: traitless,
      extraCards: ALLIES,
      deck: ALLIES.flatMap((ally) => copies(ally.id, 5)),
    });
    expect(matched(state, HERO_SIDE)).toEqual([]);
  });
});
