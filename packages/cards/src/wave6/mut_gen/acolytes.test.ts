import {
  activeEncounterDeck,
  activeVillain,
  cardsInPlay,
  hasKeyword,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { ACOLYTES_ABILITIES } from "./acolytes.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  mainThreat,
  P1,
  patchInstance,
  runWith,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { defeatWithAttack, driveEventsPicking } from "../../testing/staging.js";
import { engageMinion } from "./project-wideawake-testing.js";
import { acolytesGame, inEncounterPiles, inPlay } from "./acolytes-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
/** Magneto's own Forced Responses (they magnet-gather and reveal cards) are out of the way of what these tests count. */
const MAGNETO_OWN = ["32138.", "32139.magneto", "32140.magneto", "32141b.", "32142b.", "32143b."];
const deps: EngineDeps = {
  ...WAVE6_DEPS,
  abilities: Object.fromEntries(
    Object.entries(WAVE6_DEPS.abilities).filter(([id]) => !MAGNETO_OWN.some((prefix) => id.startsWith(prefix))),
  ),
};
const FABIAN = "32159";
const AMELIA = "32160";
const SENYAKA = "32161";
const DELGADO = "32162";
const UNUSCIONE = "32163";
const ZEAL = "32164";
const FILLER = "01186";
const NO_BOOST = "01187";
/** Zero-boost-icon cards the deck holds, one per boost card drawn ahead of the card under test (no copy twice over). */
const ZERO_BOOST = ["01186", "01186", "01187", "01187", "32153", "32153", "32154", "32154"] as const;

/** Hero form with the Acolyte `codes` engaged with P1 by surgery (no reveal, so no teamwork). */
const withAcolytes = (...codes: string[]) => {
  let state = run(acolytesGame(), toHero(P1));
  const ids: InstanceId[] = [];
  for (const code of codes) {
    const engaged = engageMinion(state, code, P1);
    state = engaged.state;
    ids.push(engaged.id);
  }
  return { state, ids };
};
const attacksBy = (events: readonly GameEvent[], id: InstanceId) =>
  of(events, "attackResolved").filter((e) => e.enemyInstanceId === id);
/**
 * One villain phase from the end of P1's turn (hero form): the villain's boost card is the first filler (an engaged
 * minion's activation draws none here), then `reveal` is the encounter card dealt; a teamwork activation's boost card
 * and anything else drawn after it are fillers too.
 */
const villainPhase = (state: GameState, reveal: string) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...ZERO_BOOST.slice(0, 1), reveal, ...ZERO_BOOST.slice(1, 3)),
    firstLegal,
    { type: "endTurn", playerId: P1 },
  );
const hero = (state: GameState) => identityOf(state, P1);
const villainId = (state: GameState): InstanceId => activeVillain(state)!.instanceId;
/** A defeat by a real attack: the minion's damage is set to its hit points first (tough removed so the attack lands). */
const defeat = (state: GameState, id: InstanceId) =>
  defeatWithAttack(deps, patchInstance(state, id, { statuses: { ...inst(state, id).statuses, tough: 0 } }), id);

describe("registry", () => {
  it("registers every ability ref of the Acolytes set", () => {
    expect(Object.keys(ACOLYTES_ABILITIES).sort()).toEqual(
      [
        "32159.when-defeated",
        "32160.when-defeated",
        "32161.senyaka-constant",
        "32161.when-defeated",
        "32162.when-defeated",
        "32163.when-defeated",
        "32164.when-revealed",
        "32165.the-acolytes-constant",
        "32165.boost",
      ].sort(),
    );
  });

  it("the set's seven cards are in the Magneto game from data", () => {
    const state = acolytesGame();
    for (const code of [FABIAN, AMELIA, SENYAKA, DELGADO, UNUSCIONE, ZEAL, "32165"])
      expect(inEncounterPiles(state, code).length + inPlay(state, code).length, code).toBeGreaterThanOrEqual(1);
  });
});

describe("Teamwork (ACOLYTE)", () => {
  it("a revealed Acolyte with another Acolyte in play activates alone, against the player it engaged", () => {
    const { state: staged, ids } = withAcolytes(AMELIA);
    const [amelia] = ids;
    const { state, events } = villainPhase(staged, UNUSCIONE);
    const [unuscione] = inPlay(state, UNUSCIONE);
    expect(unuscione).toBeDefined();
    expect(inst(state, unuscione!).engagedWith).toBe(P1);
    expect(hasKeyword(state, unuscione!, "teamwork", deps)).toBe(true);
    // One attack by the new minion (teamwork); Amelia's single attack is her own ordinary activation (Q1).
    expect(attacksBy(events, unuscione!)).toHaveLength(1);
    expect(attacksBy(events, amelia!)).toHaveLength(1);
    expect(of(events, "attackResolved").map((e) => e.enemyInstanceId)).toEqual(
      expect.arrayContaining([villainId(state), amelia, unuscione]),
    );
  });

  it("the teamwork activation comes after the ordinary activations, as the card is revealed", () => {
    const { state: staged, ids } = withAcolytes(AMELIA);
    const { events, state } = villainPhase(staged, UNUSCIONE);
    const order = of(events, "attackResolved").map((e) => e.enemyInstanceId);
    expect(order.indexOf(ids[0]!)).toBeLessThan(order.indexOf(inPlay(state, UNUSCIONE)[0]!));
  });

  it("with no other Acolyte in play, the new one does not activate", () => {
    const state = run(acolytesGame(), toHero(P1));
    const { state: after, events } = villainPhase(state, UNUSCIONE);
    const [unuscione] = inPlay(after, UNUSCIONE);
    expect(unuscione).toBeDefined();
    expect(attacksBy(events, unuscione!)).toHaveLength(0);
  });

  it("with two Acolytes already in play, only the third activates by teamwork", () => {
    const { state: staged, ids } = withAcolytes(AMELIA, DELGADO);
    const { state, events } = villainPhase(staged, SENYAKA);
    const [senyaka] = inPlay(state, SENYAKA);
    expect(attacksBy(events, senyaka!)).toHaveLength(1);
    // Each of the two was activated once, in the villain phase's ordinary activations, and not again.
    for (const id of ids) expect(attacksBy(events, id)).toHaveLength(1);
  });
});

describe("Fabian Cortez (32159)", () => {
  it("When Defeated: the defeating player discards until an Acolyte minion, who enters engaged with them", () => {
    const { state: staged, ids } = withAcolytes(FABIAN);
    const stacked = stackEncounterDeck(staged, FILLER, NO_BOOST, DELGADO);
    const after = defeat(stacked, ids[0]!);
    const [delgado] = inPlay(after, DELGADO);
    expect(delgado).toBeDefined();
    expect(inst(after, delgado!).engagedWith).toBe(P1);
    expect(activeEncounterDeck(after).discard.map((id) => codeOf(after, id))).toEqual(
      expect.arrayContaining([FILLER, NO_BOOST]),
    );
  });

  it("FAQ #159 (p. 64): Fabian is gone as the found minion enters, so its teamwork does not activate it", () => {
    const { state: staged, ids } = withAcolytes(FABIAN);
    const stacked = stackEncounterDeck(staged, DELGADO);
    const { state, events } = driveEventsPicking(deps, patchInstance(stacked, ids[0]!, { damage: 999 }), firstLegal, {
      type: "basicAttack",
      playerId: P1,
      attackerInstanceId: hero(stacked),
      targetInstanceId: ids[0]!,
    });
    const [delgado] = inPlay(state, DELGADO);
    expect(delgado).toBeDefined();
    expect(cardsInPlay(state)).not.toContain(ids[0]);
    expect(attacksBy(events, delgado!)).toHaveLength(0);
  });
});

describe("Amelia Voght (32160)", () => {
  it("When Defeated: the defeating player is confused", () => {
    const { state, ids } = withAcolytes(AMELIA);
    const after = defeat(state, ids[0]!);
    expect(inst(after, hero(after)).statuses.confused).toBe(1);
    expect(mainThreat(after)).toBe(mainThreat(state));
  });

  it("When Defeated: already confused, place 2 threat on the main scheme instead of a second status card", () => {
    const { state, ids } = withAcolytes(AMELIA);
    const confused = patchInstance(state, hero(state), {
      statuses: { ...inst(state, hero(state)).statuses, confused: 1 },
    });
    // Confused: the defeating basic attack is a thwart-less attack, but attacking is legal; confusion only affects thwarts.
    const after = defeat(confused, ids[0]!);
    expect(mainThreat(after)).toBe(mainThreat(confused) + 2);
    expect(inst(after, hero(after)).statuses.confused).toBe(1);
  });
});

describe("Senyaka (32161)", () => {
  it("his attacks gain piercing: they discard every tough status card and the damage lands (Magneto's do not)", () => {
    const { state: engaged, ids } = withAcolytes(SENYAKA);
    // Two tough cards: Magneto's attack (first, no piercing) uses one up; Senyaka's piercing attack discards the other.
    const toughHero = patchInstance(engaged, hero(engaged), {
      statuses: { ...inst(engaged, hero(engaged)).statuses, tough: 2 },
    });
    const { state, events } = villainPhase(toughHero, "32146");
    expect(attacksBy(events, ids[0]!)).toHaveLength(1);
    const damage = of(events, "damageDealt").filter((e) => e.targetInstanceId === hero(state));
    expect(damage.some((e) => e.sourceInstanceId === villainId(state))).toBe(false);
    expect(damage.some((e) => e.sourceInstanceId === ids[0] && e.amount === 3)).toBe(true);
    expect(inst(state, hero(state)).statuses.tough).toBe(0);
  });

  it("When Defeated: the defeating player is stunned", () => {
    const { state, ids } = withAcolytes(SENYAKA);
    const after = defeat(state, ids[0]!);
    expect(inst(after, hero(after)).statuses.stunned).toBe(1);
    expect(inst(after, hero(after)).damage).toBe(0);
  });

  it("When Defeated: already stunned, they take 3 damage (resolved through Zeal for the Cause: a stunned hero cannot attack)", () => {
    const { state, ids } = withAcolytes(SENYAKA);
    const stunned = patchInstance(state, hero(state), {
      statuses: { ...inst(state, hero(state)).statuses, stunned: 1 },
    });
    const { state: after, events } = villainPhase(stunned, ZEAL);
    const tail = events.slice(
      events.findIndex((e) => e.type === "abilityResolved" && e.abilityId === "32164.when-revealed"),
    );
    const damage = of(tail, "damageDealt").filter((e) => e.targetInstanceId === hero(after));
    expect(damage.map((e) => e.amount)).toEqual([3]);
    expect(cardsInPlay(after)).toContain(ids[0]);
  });
});

describe("Delgado (32162)", () => {
  it("When Defeated: discards the villain's stunned and confused cards and gives it a facedown boost card", () => {
    const { state, ids } = withAcolytes(DELGADO);
    const v = villainId(state);
    const marked = patchInstance(state, v, { statuses: { ...inst(state, v).statuses, stunned: 1, confused: 1 } });
    const after = defeat(marked, ids[0]!);
    expect(inst(after, v).statuses.stunned).toBe(0);
    expect(inst(after, v).statuses.confused).toBe(0);
    expect(inst(after, v).boostCards ?? []).toHaveLength(1);
  });

  it("When Defeated: still gives the boost card when the villain has no stunned or confused card", () => {
    const { state, ids } = withAcolytes(DELGADO);
    const after = defeat(state, ids[0]!);
    expect(inst(after, villainId(after)).boostCards ?? []).toHaveLength(1);
  });
});

describe("Unuscione (32163)", () => {
  it("When Defeated: gives the villain a tough status card", () => {
    const { state, ids } = withAcolytes(UNUSCIONE);
    const after = defeat(state, ids[0]!);
    expect(inst(after, villainId(after)).statuses.tough).toBe(1);
  });

  it("When Defeated: a villain that already has one is healed 4 instead", () => {
    const { state, ids } = withAcolytes(UNUSCIONE);
    const v = villainId(state);
    const hurt = patchInstance(state, v, { damage: 6, statuses: { ...inst(state, v).statuses, tough: 1 } });
    const after = defeat(hurt, ids[0]!);
    expect(inst(after, v).damage).toBe(2);
    expect(inst(after, v).statuses.tough).toBe(1);
  });
});

describe("Zeal for the Cause (32164)", () => {
  it("resolves each engaged Acolyte's When Defeated for the revealing player; they stay in play (Q10)", () => {
    const { state: staged, ids } = withAcolytes(AMELIA, DELGADO);
    const { state } = villainPhase(staged, ZEAL);
    // Amelia's: the player is confused; Delgado's: a facedown boost card on the villain.
    expect(inst(state, hero(state)).statuses.confused).toBe(1);
    expect(inst(state, villainId(state)).boostCards).toHaveLength(1);
    for (const id of ids) expect(cardsInPlay(state)).toContain(id);
  });

  it("an Acolyte engaged with someone else is not resolved", () => {
    const { state: staged, ids } = withAcolytes(AMELIA);
    const away = patchInstance(staged, ids[0]!, { engagedWith: null });
    const { state } = villainPhase(away, ZEAL);
    expect(inst(state, hero(state)).statuses.confused).toBe(0);
  });

  it("with no Acolyte engaged, discards until a minion (any) and reveals it", () => {
    const state = run(acolytesGame(), toHero(P1));
    const base = stackEncounterDeck(state, NO_BOOST, ZEAL, FILLER, AMELIA);
    const { state: after, events } = driveEventsPicking(deps, base, firstLegal, { type: "endTurn", playerId: P1 });
    const [amelia] = inPlay(after, AMELIA);
    expect(amelia).toBeDefined();
    expect(inst(after, amelia!).engagedWith).toBe(P1);
    expect(of(events, "encounterCardRevealed").map((e) => e.cardId)).toEqual(expect.arrayContaining([ZEAL, AMELIA]));
    expect(activeEncounterDeck(after).discard.map((id) => codeOf(after, id))).toContain(FILLER);
  });
});

describe("The Acolytes (32165)", () => {
  it("Each Acolyte minion gains guard", () => {
    const { state: staged, ids } = withAcolytes(AMELIA);
    expect(hasKeyword(staged, ids[0]!, "guard", deps)).toBe(false);
    const { state } = villainPhase(staged, "32165");
    expect(inPlay(state, "32165")).toHaveLength(1);
    expect(hasKeyword(state, ids[0]!, "guard", deps)).toBe(true);
  });

  it("Boost: shuffles each Acolyte minion in the discard pile into the encounter deck", () => {
    const state = run(acolytesGame(), toHero(P1));
    const [a] = inEncounterPiles(state, AMELIA);
    const [d] = inEncounterPiles(state, DELGADO);
    const deckId = Object.keys(state.encounterDecks).find(
      (k) => state.encounterDecks[k] === activeEncounterDeck(state),
    )!;
    const pile = state.encounterDecks[deckId]!;
    const staged = {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== a && i !== d), discard: [...pile.discard, a!, d!] },
      },
    };
    // The villain's boost card is the side scheme; the reveal afterwards is a filler.
    const stacked = stackEncounterDeck(staged, "32165", NO_BOOST);
    const { state: after, events } = driveEventsPicking(deps, stacked, firstLegal, { type: "endTurn", playerId: P1 });
    expect(of(events, "abilityResolved").map((e) => e.abilityId)).toContain("32165.boost");
    const pileAfter = activeEncounterDeck(after);
    expect(pileAfter.discard).not.toContain(a);
    expect(pileAfter.discard).not.toContain(d);
    expect([...pileAfter.deck, ...after.players.flatMap((p) => p.dealtEncounter)]).toEqual(
      expect.arrayContaining([a, d]),
    );
  });
});
