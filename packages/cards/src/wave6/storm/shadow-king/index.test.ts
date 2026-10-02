import {
  applyCommand,
  cardsInPlay,
  categoriesOf,
  traitsOf,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { trait } from "@mc/content";
import { describe, expect, it } from "vitest";
import { validateDefinition } from "../../../dsl/validate.js";
import {
  endTurn,
  firstLegal,
  inst,
  instancesOf,
  P1,
  patchInstance,
  settle,
  stackEncounterDeck,
} from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand, withForm } from "../../../testing/staging.js";
import { WAVE6_DEPS } from "../../index.js";
import { stormGame } from "../storm/support.js";
import { SHADOW_KING_ABILITIES } from "./index.js";

const ADVANCE = "01186";
const CONTROLLED = trait("CONTROLLED");
const SHADOW_KING = "36036";
const RULER = "36037";
const POSSESSED = "36038";
const ASTRAL_ATTACK = "36039";
const HAVOK = "36014";
const MIRAGE = "36015";

const game = () => stormGame("rhino", { modularSetIds: ["shadow_king"] });
const piles = (state: GameState) => Object.values(state.encounterDecks)[0]!;
const inPlay = (state: GameState, code: string): InstanceId[] =>
  instancesOf(state, code).filter((id) => cardsInPlay(state).includes(id));
const resolved = (events: readonly { type: string }[]) =>
  events.flatMap((e) => (e.type === "abilityResolved" ? [(e as unknown as { abilityId: string }).abilityId] : []));
/** The villain stunned and confused (it skips its attack or scheme and draws no boost), so `top` is the next card dealt. */
const reveal = (state: GameState, ...top: string[]) => {
  const villain = state.activeVillainId!;
  const confused = patchInstance(state, villain, {
    statuses: { ...inst(state, villain).statuses, confused: 1, stunned: 1 },
  });
  return driveEventsPicking(WAVE6_DEPS, stackEncounterDeck(confused, ...top), firstLegal, endTurn(P1));
};
/** Tops the hand up to `n` cards from the deck, so a test can pay for what it plays. */
const fillHand = (state: GameState, n: number): GameState => ({
  ...state,
  players: state.players.map((p) => {
    if (p.playerId !== P1 || p.hand.length >= n) return p;
    const take = p.deck.slice(0, n - p.hand.length);
    return { ...p, hand: [...p.hand, ...take], deck: p.deck.slice(take.length) };
  }),
});
const withAllies = (base: GameState) => {
  const state = fillHand(base, 12);
  const havok = playFromHand(WAVE6_DEPS, state, HAVOK, 4);
  const mirage = playFromHand(WAVE6_DEPS, havok.state, MIRAGE, 3);
  return { state: mirage.state, havok: havok.id, mirage: mirage.id };
};
/** Possessed revealed onto Havok (the lowest THW). */
const possessedGame = () => {
  const { state, havok, mirage } = withAllies(game());
  return { ...reveal(state, POSSESSED), havok, mirage };
};
/** Test-only surgery: a card out of play into the encounter discard pile (the host is re-synced as the engine does). */
const discardFromPlay = (state: GameState, id: InstanceId): GameState => {
  const host = Object.values(state.instances).find((i) => i.attachments.includes(id))!;
  const deckId = Object.keys(state.encounterDecks)[0]!;
  const pile = state.encounterDecks[deckId]!;
  return {
    ...state,
    encounterDecks: { ...state.encounterDecks, [deckId]: { ...pile, discard: [...pile.discard, id] } },
    instances: {
      ...state.instances,
      [host.instanceId]: { ...host, attachments: host.attachments.filter((a) => a !== id), treatedAs: null },
    },
  };
};
const attached = (state: GameState, host: InstanceId) =>
  inst(state, host).attachments.filter((id) => state.instances[id]!.cardId === POSSESSED);

describe("The Shadow King modular set (36036-36039)", () => {
  it("registers exactly the refs the card data names, all valid", () => {
    expect(Object.keys(SHADOW_KING_ABILITIES).sort()).toEqual([
      "36036.the-shadow-king-constant",
      "36036.when-revealed",
      "36037.boost",
      "36037.when-defeated",
      "36038.possessed-constant",
      "36038.when-revealed",
      "36039.boost",
      "36039.when-revealed",
    ]);
    for (const definition of Object.values(SHADOW_KING_ABILITIES)) expect(validateDefinition(definition)).toEqual([]);
  });

  describe("Possessed (36038)", () => {
    it("36038.when-revealed: attaches to the ally with the lowest THW, which becomes a CONTROLLED minion engaged with its controller", () => {
      const { state, havok, mirage } = possessedGame();
      expect(attached(state, havok)).toHaveLength(1);
      expect(attached(state, mirage)).toHaveLength(0);
      expect(categoriesOf(state, havok)).toContain("minion");
      expect(traitsOf(state, havok)).toContain(CONTROLLED);
      expect(inst(state, havok).engagedWith).toBe(P1);
    });

    it("36038.possessed-constant: SCH equals the ally's printed THW (Havok 1)", () => {
      const { state, havok } = possessedGame();
      expect(inst(state, havok).treatedAs?.kind).toBe("minion");
      expect(inst(state, havok).treatedAs).toMatchObject({ schFromThw: true });
    });

    it("36038.when-revealed: a second copy skips the ally that already has Possessed", () => {
      const { state, havok, mirage } = withAllies(game());
      const first = reveal(state, POSSESSED).state;
      const second = reveal(first, POSSESSED).state;
      expect(attached(second, havok)).toHaveLength(1);
      expect(attached(second, mirage)).toHaveLength(1);
    });

    it("36038.when-revealed: with no ally to possess, it gains surge instead", () => {
      const { state } = reveal(game(), POSSESSED, ADVANCE);
      expect(inPlay(state, POSSESSED)).toHaveLength(0);
      expect(piles(state).discard.some((i) => state.instances[i]!.cardId === ADVANCE)).toBe(true);
    });
  });

  describe("The Shadow King (36036)", () => {
    it("36036.when-revealed: searches the encounter deck for a Possessed and reveals it onto an ally", () => {
      const { state, havok } = withAllies(game());
      const { state: after, events } = reveal(state, SHADOW_KING);
      expect(resolved(events)).toContain("36036.when-revealed");
      expect(attached(after, havok)).toHaveLength(1);
      expect(inPlay(after, SHADOW_KING)).toHaveLength(1);
    });

    it("36036.when-revealed: finds Possessed in the discard pile when the deck has none", () => {
      const { state, havok } = withAllies(game());
      const inDeck = piles(state).deck.filter((i) => state.instances[i]!.cardId === POSSESSED);
      const moved = {
        ...state,
        encounterDecks: {
          ...state.encounterDecks,
          [Object.keys(state.encounterDecks)[0]!]: {
            deck: piles(state).deck.filter((i) => !inDeck.includes(i)),
            discard: [...piles(state).discard, ...inDeck],
          },
        },
      };
      const { state: after } = reveal(moved, SHADOW_KING);
      expect(attached(after, havok)).toHaveLength(1);
    });

    it("36036.the-shadow-king-constant: cannot take damage while a Controlled minion is in play", () => {
      const { state } = withAllies(game());
      const { state: withKing } = reveal(state, SHADOW_KING);
      const [king] = inPlay(withKing, SHADOW_KING);
      const attack = (s: GameState) => {
        const hero = withForm(s, { heroForm: 0 });
        const id = hero.players[0]!.identity.instanceId;
        return applyCommand(
          patchInstance(hero, id, { exhausted: false }),
          { type: "basicAttack", playerId: P1, attackerInstanceId: id, targetInstanceId: king! },
          WAVE6_DEPS,
        );
      };
      // He cannot take damage, so a basic attack cannot target him (RRG 1.8 "Target", p. 43; ruling Mar 19, 2026 (2)).
      const refused = attack(withKing);
      expect(refused.ok).toBe(false);
      if (!refused.ok) expect(refused.error.code).toBe("no_valid_target");
      // Without a Controlled minion in play the same attack lands.
      const [possessed] = inPlay(withKing, POSSESSED);
      const freed = discardFromPlay(withKing, possessed!);
      const landed = attack(freed);
      expect(landed.ok).toBe(true);
      if (landed.ok)
        expect(inst(settle(landed.state, firstLegal, undefined, WAVE6_DEPS), king!).damage).toBeGreaterThan(0);
    });
  });

  describe("Ruler of the Astral Plane (36037)", () => {
    it("36037.when-defeated: discards one copy of Possessed from play", () => {
      const { state, havok, mirage } = withAllies(game());
      const two = reveal(reveal(state, POSSESSED).state, POSSESSED).state;
      expect(attached(two, havok)).toHaveLength(1);
      expect(attached(two, mirage)).toHaveLength(1);
      const scheme = encounterCardInVillainArea(two, RULER, 1);
      const { state: after, events } = driveEventsPicking(
        WAVE6_DEPS,
        patchInstance(withForm(scheme.state, { heroForm: 0 }), scheme.state.players[0]!.identity.instanceId, {
          exhausted: false,
        }),
        firstLegal,
        {
          type: "basicThwart",
          playerId: P1,
          thwarterInstanceId: scheme.state.players[0]!.identity.instanceId,
          schemeInstanceId: scheme.id,
        } as never,
      );
      expect(resolved(events)).toContain("36037.when-defeated");
      expect(inPlay(after, POSSESSED)).toHaveLength(1);
      // The ally whose Possessed went is an ally again; the other stays a Controlled minion.
      const freed = [havok, mirage].filter((id) => !categoriesOf(after, id).includes("minion"));
      expect(freed).toHaveLength(1);
      expect(categoriesOf(after, freed[0]!)).toContain("ally");
    });

    it("36037.boost: revealed from the boost if you are engaged with a Controlled minion", () => {
      expect(SHADOW_KING_ABILITIES["36037.boost"]?.trigger).toEqual({ kind: "boost" });
    });
  });

  describe("Astral Attack (36039)", () => {
    it("36039.when-revealed: each Controlled minion activates against you, engaged or not (one extra attack each)", () => {
      const { state, havok, mirage } = withAllies(withForm(game(), { heroForm: 0 }));
      const two = reveal(reveal(state, POSSESSED).state, POSSESSED).state;
      const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
        events.filter((e) => e.type === "attackResolved" && e.enemyInstanceId === id).length;
      const base = reveal(two, ADVANCE).events;
      const { events } = reveal(two, ASTRAL_ATTACK);
      expect(resolved(events)).toContain("36039.when-revealed");
      expect(attacksBy(events, havok)).toBe(attacksBy(base, havok) + 1);
      expect(attacksBy(events, mirage)).toBe(attacksBy(base, mirage) + 1);
    });

    it("36039.when-revealed: with no Controlled minion it gains surge", () => {
      const { state } = reveal(game(), ASTRAL_ATTACK, ADVANCE);
      expect(piles(state).discard.some((i) => state.instances[i]!.cardId === ADVANCE)).toBe(true);
    });
  });

  it("scenario: with the set as the modular, its cards are in the encounter deck", () => {
    const state = game();
    for (const code of [SHADOW_KING, RULER, POSSESSED, ASTRAL_ATTACK])
      expect(instancesOf(state, code).length).toBeGreaterThan(0);
    expect(instancesOf(state, POSSESSED)).toHaveLength(2);
  });
});
