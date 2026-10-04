import {
  activeEncounterDeckId,
  cardsInPlay,
  characterProfile,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it } from "vitest";
import { ZERO_TOLERANCE_ABILITIES } from "./zero-tolerance.js";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  patchInstance,
  runWith,
  stackEncounterDeck,
  toHero,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../testing/staging.js";
import { attachToHost, engageMinion } from "./project-wideawake-testing.js";
import { wideawakeGame } from "./project-wideawake-testing.js";
import { inEncounterPile, zeroToleranceGame } from "./zero-tolerance-testing.js";

const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(WAVE6_DEPS, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const codeOf = (state: GameState, id: InstanceId) => state.instances[id]!.cardId as string;
const inPlayOf = (state: GameState, code: string) => cardsInPlay(state).filter((id) => codeOf(state, id) === code);
/** Master Mold's own interrupt (it discards for a Sentinel and skips the boost card) is out of the way of these tests. */
const deps: EngineDeps = {
  ...WAVE6_DEPS,
  abilities: Object.fromEntries(
    Object.entries(WAVE6_DEPS.abilities).filter(([id]) => !/^(32109|3211[01])\.master-mold/.test(id)),
  ),
};
/** One villain phase from the end of P1's turn: the stacked cards are drawn in order (the villain's boost card first). */
const phase = (state: GameState, top: readonly string[]) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(patchInstance(state, state.mainScheme.instanceId, { threat: 0 }), ...top),
    firstLegal,
    { type: "endTurn", playerId: P1 },
  );
const revealed = (events: readonly GameEvent[]) => of(events, "encounterCardRevealed").map((e) => e.cardId as string);
const FILLER = "01186";
const NO_BOOST = "01187";
const SIDE = "32104";

describe("registry", () => {
  it("registers every ability ref of the set's cards (32104 lives in project-wideawake.ts)", () => {
    expect(Object.keys(ZERO_TOLERANCE_ABILITIES).sort()).toEqual([
      "32101.when-revealed",
      "32102.boost",
      "32102.when-revealed",
      "32103.energy-barrier-constant",
      "32103.energy-barrier-forced-response",
    ]);
    for (const id of ["32104.operation-zero-tolerance-forced-response", "32104.operation-zero-tolerance-constant"])
      expect(WAVE6_DEPS.abilities[id], id).toBeDefined();
  });

  it("the set's cards are in the game from data when it is the modular set", () => {
    const state = zeroToleranceGame();
    expect(inEncounterPile(state, "32101")).toHaveLength(2);
    expect(inEncounterPile(state, "32102")).toHaveLength(2);
    expect(inEncounterPile(state, "32103")).toHaveLength(2);
    expect(inEncounterPile(state, SIDE)).toHaveLength(1);
  });
});

describe("Sentinel Mark II (32101)", () => {
  it("When Revealed, Operation Zero Tolerance not in play: searches the deck for it and reveals it", () => {
    const base = zeroToleranceGame();
    expect(inPlayOf(base, SIDE)).toEqual([]);
    const { state, events } = phase(base, [FILLER, "32101"]);
    expect(revealed(events).slice(0, 2)).toEqual(["32101", SIDE]);
    expect(inPlayOf(state, SIDE)).toHaveLength(1);
    // Not surged: the next revealed card is the side scheme found by the search, not the deck's next card.
    expect(inPlayOf(state, "32101")).toHaveLength(1);
  });

  it("also searches the discard pile", () => {
    const base = zeroToleranceGame();
    const deckId = activeEncounterDeckId(base);
    const [scheme] = inEncounterPile(base, SIDE);
    const pile = base.encounterDecks[deckId]!;
    const moved: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== scheme), discard: [...pile.discard, scheme!] },
      },
    };
    const { state } = phase(moved, [FILLER, "32101"]);
    expect(inPlayOf(state, SIDE)).toEqual([scheme]);
  });

  it("When Revealed, Operation Zero Tolerance in play: gains surge (no search, the next card is revealed)", () => {
    const { state: held, id: scheme } = encounterCardInVillainArea(zeroToleranceGame(), SIDE);
    const { state, events } = phase(held, [FILLER, "32101", "01188"]);
    expect(revealed(events).slice(0, 2)).toEqual(["32101", "01188"]);
    expect(inPlayOf(state, SIDE)).toEqual([scheme]);
  });

  it("Project Wideawake (where Zero Tolerance is required) already has the side scheme in play, so it surges", () => {
    const base = wideawakeGame();
    expect(inPlayOf(base, SIDE)).toHaveLength(1);
    expect(inEncounterPile(base, "32101")).toHaveLength(2);
    const { events } = phase(base, [FILLER, "32101", "01188"]);
    expect(revealed(events).slice(0, 2)).toEqual(["32101", "01188"]);
  });
});

describe("Sentinel Mark III (32102)", () => {
  it("When Revealed: searches the encounter deck for Energy Barrier and attaches it to this minion (no tough from the barrier)", () => {
    const base = zeroToleranceGame();
    const { state } = phase(base, [FILLER, "32102"]);
    const [mark] = inPlayOf(state, "32102");
    expect(mark).toBeDefined();
    const barriers = inst(state, mark!).attachments.filter((a) => codeOf(state, a) === "32103");
    expect(barriers).toHaveLength(1);
    // Toughness (its own keyword, one tough on entering play) and +2 ATK from the attachment: 3 + 2.
    expect(inst(state, mark!).statuses.tough).toBe(1);
    expect(characterProfile(state, mark!, WAVE6_DEPS)!.atk).toBe(5);
    // Only one copy was attached, the other stays in the encounter piles.
    expect(inEncounterPile(state, "32103")).toHaveLength(1);
  });

  it("also finds Energy Barrier in the discard pile", () => {
    const base = zeroToleranceGame();
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    const barriers = pile.deck.filter((i) => codeOf(base, i) === "32103");
    const moved: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => !barriers.includes(i)), discard: [...pile.discard, ...barriers] },
      },
    };
    const { state } = phase(moved, [FILLER, "32102"]);
    const [mark] = inPlayOf(state, "32102");
    expect(inst(state, mark!).attachments.filter((a) => codeOf(state, a) === "32103")).toHaveLength(1);
  });

  it("with no Energy Barrier left in the encounter deck or discard, nothing is attached", () => {
    const base = zeroToleranceGame();
    const deckId = activeEncounterDeckId(base);
    const pile = base.encounterDecks[deckId]!;
    const gone = pile.deck.filter((i) => codeOf(base, i) === "32103");
    const stripped: GameState = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => !gone.includes(i)), discard: pile.discard },
      },
    };
    const { state } = phase(stripped, [FILLER, "32102"]);
    const [mark] = inPlayOf(state, "32102");
    expect(mark).toBeDefined();
    expect(inst(state, mark!).attachments).toEqual([]);
  });

  describe("[star] Boost: you are stunned; if you are already stunned, take 2 damage", () => {
    /** Hero form, Master Mold attacks P1 and the stacked card is its boost card. */
    const attacked = (base: GameState, boostCard: string) => {
      const hero = run(base, toHero(P1));
      const { state, events } = phase(hero, [boostCard, NO_BOOST]);
      return { state, events, hero: identityOf(hero, P1) };
    };
    const damageOf = (state: GameState, id: InstanceId) => inst(state, id).damage;

    it("not stunned: you become stunned and take no extra damage", () => {
      const base = zeroToleranceGame();
      const control = attacked(base, NO_BOOST);
      const result = attacked(base, "32102");
      expect(of(result.events, "abilityResolved").map((e) => e.abilityId)).toContain("32102.boost");
      expect(inst(result.state, result.hero).statuses.stunned).toBe(1);
      expect(damageOf(result.state, result.hero)).toBe(damageOf(control.state, control.hero));
    });

    it("already stunned: take 2 damage (and stay stunned)", () => {
      const base = zeroToleranceGame();
      const hero = identityOf(base, P1);
      const stunned = patchInstance(base, hero, { statuses: { ...inst(base, hero).statuses, stunned: 1 } });
      const control = attacked(stunned, NO_BOOST);
      const result = attacked(stunned, "32102");
      expect(damageOf(result.state, result.hero)).toBe(damageOf(control.state, control.hero) + 2);
      expect(inst(result.state, result.hero).statuses.stunned).toBe(1);
    });
  });
});

describe("Energy Barrier (32103)", () => {
  it("When Revealed with a Sentinel minion in play: attaches to it, gives it a tough status card and +2 ATK", () => {
    const { state: engaged, id: minion } = engageMinion(zeroToleranceGame(), "32101");
    const bare = patchInstance(engaged, minion, { statuses: { ...inst(engaged, minion).statuses, tough: 0 } });
    const before = characterProfile(bare, minion, WAVE6_DEPS)!.atk;
    const { state, events } = phase(bare, [FILLER, NO_BOOST, "32103"]);
    const [barrier] = inPlayOf(state, "32103");
    expect(barrier).toBeDefined();
    expect(inst(state, minion).attachments).toContain(barrier);
    expect(inst(state, minion).statuses.tough).toBe(1);
    expect(characterProfile(state, minion, WAVE6_DEPS)!.atk).toBe(before + 2);
    expect(revealed(events)).toContain("32103");
  });

  it("with no Sentinel minion in play, this card gains surge: it is discarded and the next card is revealed", () => {
    const { state, events } = phase(zeroToleranceGame(), [FILLER, "32103", "01188"]);
    expect(revealed(events).slice(0, 2)).toEqual(["32103", "01188"]);
    expect(inPlayOf(state, "32103")).toEqual([]);
  });

  it("a Sentinel minion that already has an Energy Barrier is not a legal host: the second barrier gains surge", () => {
    const { state: engaged, id: minion } = engageMinion(zeroToleranceGame(), "32101");
    const { state: armed, id: first } = attachToHost(engaged, "32103", minion);
    const toughBefore = inst(armed, minion).statuses.tough;
    const { state, events } = phase(armed, [FILLER, NO_BOOST, "32103", "01188"]);
    // (The minion's own boost card, 01187, is flipped first.)
    const seen = revealed(events);
    expect(seen.slice(seen.indexOf("32103"), seen.indexOf("32103") + 2)).toEqual(["32103", "01188"]);
    expect(inst(state, minion).attachments.filter((a) => codeOf(state, a) === "32103")).toEqual([first]);
    expect(inst(state, minion).statuses.tough).toBe(toughBefore);
  });

  it("Forced Response: after the attached minion attacks, give it a tough status card", () => {
    const { state: engaged, id: minion } = engageMinion(run(zeroToleranceGame(), toHero(P1)), "32101");
    const { state: armed } = attachToHost(engaged, "32103", minion);
    const bare = patchInstance(armed, minion, { statuses: { ...inst(armed, minion).statuses, tough: 0 } });
    const { state, events } = phase(bare, [FILLER, NO_BOOST]);
    expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === minion)).toHaveLength(1);
    expect(inst(state, minion).statuses.tough).toBe(1);
  });

  it("the Forced Response does not fire for another minion's attack", () => {
    const { state: engaged, id: minion } = engageMinion(run(zeroToleranceGame(), toHero(P1)), "32101");
    const { state: armed } = attachToHost(engaged, "32103", minion);
    const { state: both, id: other } = engageMinion(armed, "32101", P1);
    expect(other).not.toBe(minion);
    const bare = patchInstance(both, other, { statuses: { ...inst(both, other).statuses, tough: 0 } });
    const noBarrierTough = patchInstance(bare, minion, { statuses: { ...inst(bare, minion).statuses, tough: 0 } });
    const { state } = phase(noBarrierTough, [FILLER, NO_BOOST]);
    expect(inst(state, other).statuses.tough).toBe(0);
    expect(inst(state, minion).statuses.tough).toBe(1);
  });
});
