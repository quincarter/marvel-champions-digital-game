/**
 * `EffectSpec findCard.anywhere`: "search everywhere in or out of play for the specified card" (DesignHacker's Summon
 * keyword, community pack `yondu-dh`). Wider than Find on purpose: beyond what RRG 1.8 "Find" (p. 19) reaches, it also
 * looks at cards removed from the game, the victory display, the players' facedown dealt encounter cards, facedown
 * encounter cards in play and boost cards. Without the option, those stay out of reach.
 *
 * Synthetic cards throughout.
 */

import { describe, expect, it } from "vitest";
import type { AbilityDefinition, EngineDeps } from "./abilities.js";
import type { InstanceId } from "./ids.js";
import { activeEncounterDeckId, locateCard, mustInstance } from "./query.js";
import type { EffectSpec } from "./spec.js";
import type { GameState } from "./state.js";
import { depsOf, stubAbility } from "./testing/abilities.js";
import { stubEvent, stubMinion, stubUpgrade } from "./testing/fixtures.js";
import { TREACHERY } from "./testing/scenario.js";
import { copiesOf, gameAtFirstTurn, P1, playFree } from "./testing/wave3.js";

const def = (definition: AbilityDefinition) => definition;
const TAHLEI = stubUpgrade({ id: "tahlei", cost: 0 });
const THUG = stubMinion({ id: "thug", atk: 1, sch: 1, hp: 3 });

const event = (id: string, effects: readonly EffectSpec[]) => {
  const ability = stubAbility(`${id}.action`, def({ trigger: { kind: "action" }, effects }));
  return { card: stubEvent({ id, cost: 0, abilities: [ability.ref] }), ability };
};
const find = (name: string, anywhere: boolean, to: "hand" | "encounterSetAside" = "hand"): EffectSpec => ({
  kind: "findCard",
  query: { name },
  to,
  ...(anywhere ? { anywhere: true as const } : {}),
});
const SUMMON_TAHLEI = event("summon-tahlei", [find("tahlei", true)]);
const FIND_TAHLEI = event("find-tahlei", [find("tahlei", false)]);
const SUMMON_THUG = event("summon-thug", [find("thug", true, "encounterSetAside")]);
const FIND_THUG = event("find-thug", [find("thug", false, "encounterSetAside")]);
const EVENTS = [SUMMON_TAHLEI, FIND_TAHLEI, SUMMON_THUG, FIND_THUG];
const deps: EngineDeps = depsOf(...EVENTS.map((e) => e.ability));

function start(): GameState {
  return gameAtFirstTurn({
    cards: [TAHLEI, THUG, ...EVENTS.map((e) => e.card)],
    deps,
    encounter: [...copiesOf(TREACHERY.id, 29), THUG.id],
    deck: [TAHLEI.id, ...EVENTS.map((e) => e.card.id)],
  });
}
const tahleiOf = (state: GameState): InstanceId =>
  Object.values(state.instances).find((i) => i.cardId === TAHLEI.id)!.instanceId;

/** Tahlei moved out of the player's hand and deck into `zone` (surgery); "deck" puts it at the bottom of the deck. */
function tahleiIn(state: GameState, zone: "removedFromGame" | "victoryDisplay" | "deck"): GameState {
  const id = tahleiOf(state);
  const players = state.players.map((p) => ({
    ...p,
    hand: p.hand.filter((x) => x !== id),
    deck: [...p.deck.filter((x) => x !== id), ...(zone === "deck" ? [id] : [])],
  }));
  return zone === "deck" ? { ...state, players } : { ...state, players, [zone]: [...state[zone], id] };
}
/** The thug moved off the encounter deck, dealt facedown to the player (surgery). */
function thugDealt(state: GameState): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const piles = state.encounterDecks[deckId]!;
  const id = piles.deck.find((x) => state.instances[x]?.cardId === THUG.id)!;
  return {
    id,
    state: {
      ...state,
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: piles.deck.filter((x) => x !== id) } },
      players: state.players.map((p) => ({ ...p, dealtEncounter: [...p.dealtEncounter, id] })),
      instances: { ...state.instances, [id]: { ...mustInstance(state, id), faceup: false } },
    },
  };
}

describe("findCard.anywhere: 'search everywhere in or out of play'", () => {
  for (const zone of ["removedFromGame", "victoryDisplay"] as const) {
    it(`reaches a card in ${zone}, which a plain find does not`, () => {
      const state = tahleiIn(start(), zone);
      const id = tahleiOf(state);
      const plain = playFree(state, deps, FIND_TAHLEI.card.id);
      expect(locateCard(plain.state, id)?.kind).toBe(zone);
      const anywhere = playFree(state, deps, SUMMON_TAHLEI.card.id);
      expect(locateCard(anywhere.state, id)).toEqual({ kind: "hand", playerId: P1 });
    });
  }

  it("reaches a facedown encounter card dealt to a player, which a plain find does not", () => {
    const dealt = thugDealt(start());
    const plain = playFree(dealt.state, deps, FIND_THUG.card.id);
    expect(locateCard(plain.state, dealt.id)?.kind).toBe("dealtEncounter");
    const anywhere = playFree(dealt.state, deps, SUMMON_THUG.card.id);
    expect(locateCard(anywhere.state, dealt.id)).toEqual({ kind: "encounterSetAside" });
  });

  it("still takes a card in an open area first, and from a deck the way a find does", () => {
    const state = tahleiIn(start(), "deck");
    const id = tahleiOf(state);
    expect(locateCard(state, id)?.kind).toBe("deck");
    const anywhere = playFree(state, deps, SUMMON_TAHLEI.card.id);
    expect(locateCard(anywhere.state, id)).toEqual({ kind: "hand", playerId: P1 });
    expect(anywhere.events.some((e) => e.type === "cardFound" && e.instanceId === id && e.deckShuffled)).toBe(true);
  });

  it("with one copy in a discard pile and one removed from the game, takes the one in the discard pile", () => {
    const base = gameAtFirstTurn({
      cards: [TAHLEI, THUG, ...EVENTS.map((e) => e.card)],
      deps,
      encounter: [...copiesOf(TREACHERY.id, 29), THUG.id],
      deck: [TAHLEI.id, TAHLEI.id, ...EVENTS.map((e) => e.card.id)],
    });
    const [inDiscard, removed] = Object.values(base.instances)
      .filter((i) => i.cardId === TAHLEI.id)
      .map((i) => i.instanceId) as [InstanceId, InstanceId];
    // Surgery: one copy on the player's discard pile, the other removed from the game.
    const state: GameState = {
      ...base,
      players: base.players.map((p) => ({
        ...p,
        hand: p.hand.filter((x) => x !== inDiscard && x !== removed),
        deck: p.deck.filter((x) => x !== inDiscard && x !== removed),
        discard: p.playerId === P1 ? [inDiscard, ...p.discard] : p.discard,
      })),
      removedFromGame: [...base.removedFromGame, removed],
    };
    const anywhere = playFree(state, deps, SUMMON_TAHLEI.card.id);
    expect(locateCard(anywhere.state, inDiscard)).toEqual({ kind: "hand", playerId: P1 });
    expect(locateCard(anywhere.state, removed)?.kind).toBe("removedFromGame");
  });
});
