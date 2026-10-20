import { cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { playFromHand } from "../../testing/staging.js";
import { CAPTAIN_MARVEL, SPIDER_MAN, codeOf, heroForm, types } from "../../wave9/testing.js";
import { SHADOWLAND_DEADLY_CONTRAPTIONS, SHADOWLAND_DEADLY_CONTRAPTIONS_SKIPPED } from "./deadly-contraptions.js";
import {
  BLINDING,
  CALTROPS,
  FILLER,
  HALL,
  PATH,
  TRAP_DEPS,
  choosingOption,
  endTurnAnswering,
  stackTraps,
  trapGame,
  withHandOnly,
} from "./trap-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Deadly Contraptions (MC65 pp. 12-13): the TRAP! treacheries Blinding Powder (65050) and Caltrops (65051), and the
 * boosts of Hall of Punishment (65048) and Path of a Thousand Cuts (65049). The pack is gated and the Shadow Labyrinth
 * scenario record does not exist yet, so the trap deck is declared by hand (`trapGame`): Shifting Corridors' own
 * interrupt reveals the top trap card at the end of the first player's turn, which is how a trap reaches a player here.
 * The Forced Interrupts on "choose the Avoid / Trip effect" (65046, 65048, 65049) and Iron Monk (65047) stay skipped.
 */
const THWART_EVENT = "01060"; // For Justice!: a THWART event
const DEFENSE_EVENT = "01003"; // Backflip: a DEFENSE event, and Spider-Man's own (identity-specific) card
const ALLY = "01059"; // Jessica Jones: a Core ally, cost 3, 3 hit points
const OTHER = "01004"; // Enhanced Spider-Sense: neither a Thwart nor a Defense event, but identity-specific

/** The cards discarded from hand during the run (the end-of-round refill reshuffles an emptied deck, so read the log). */
const discarded = (state: GameState, events: readonly GameEvent[]): string[] =>
  types(events, "cardDiscardedFromHand").map((e) => codeOf(state, e.instanceId));
const damage = (s: GameState) => inst(s, identityOf(s)).damage;
const statuses = (s: GameState) => inst(s, identityOf(s)).statuses;

/**
 * A Corridors game whose trap deck top is `trap` and P1's hand exactly `hand` (hero form); the first player's turn ends
 * and Corridors' interrupt reveals the trap for them, `pick` choosing among Avoid, Disarm and Trip. `offered` is the
 * option labels of that prompt (null when none was asked).
 */
function reveal(trap: string, hand: readonly string[], pick: Picker) {
  let state = trapGame({ trapCards: [BLINDING, CALTROPS], encounter: [FILLER, FILLER, FILLER] });
  state = heroForm(stackTraps(withHandOnly(state, P1, ...hand), trap), P1);
  let offered: string[] | null = null;
  const recording: Picker = (s) => {
    if (s.pendingChoice!.prompt.kind === "chooseOption" && offered === null)
      offered = s.pendingChoice!.options.map((o) => o.label.split(":")[0]!);
    return pick(s);
  };
  const run = endTurnAnswering(state, recording);
  return { before: state, ...run, offered: offered as string[] | null, discarded: discarded(run.state, run.events) };
}

describe("Blinding Powder (65050): Avoid, Disarm or Trip", () => {
  it("Avoid discards a Thwart event from the hand and nothing else", () => {
    const r = reveal(BLINDING, [THWART_EVENT, OTHER], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"]);
    expect(r.discarded).toEqual([THWART_EVENT]);
    expect(damage(r.state)).toBe(damage(r.before));
    expect(statuses(r.state).confused).toBe(0);
    expect(statuses(r.state).tough).toBe(0);
  });

  it("Avoid is not offered when the hand holds no Thwart event (a Defense event is not one)", () => {
    const r = reveal(BLINDING, [DEFENSE_EVENT, OTHER], choosingOption("Trip"));
    expect(r.offered).toEqual(["Disarm", "Trip"]);
  });

  it("Disarm discards 2 cards at random, then gives a character you control a tough status card", () => {
    const hand = [OTHER, DEFENSE_EVENT, THWART_EVENT];
    const r = reveal(BLINDING, hand, choosingOption("Disarm"));
    expect(r.discarded).toHaveLength(2);
    expect(new Set(r.discarded).size).toBe(2);
    for (const code of r.discarded) expect(hand).toContain(code);
    expect(statuses(r.state).tough).toBe(1);
    expect(damage(r.state)).toBe(damage(r.before));
  });

  // Owner decision 2026-10-20 (A), reversing Q8: RRG 1.8 "Choose (Option)" (p. 12) bars an option only for want of a
  // target (a card in hand to discard counts, p. 42); a hand of one card is a target, so Disarm is offered.
  it("Disarm with fewer than 2 cards in hand discards what it can and skips its 'then' (no tough status card)", () => {
    const r = reveal(BLINDING, [OTHER], choosingOption("Disarm"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"].filter((l) => l !== "Avoid"));
    expect(r.discarded).toEqual([OTHER]);
    expect(statuses(r.state).tough).toBe(0);
    expect(damage(r.state)).toBe(damage(r.before));
  });

  // RRG 1.8 "Choose (Option)" (p. 12): the discard is a part of its own, so a missing target for the "then" part does not
  // bar Disarm.
  it("Disarm is still offered when the identity already holds a tough status card: the discard resolves, no second card is given", () => {
    const base = trapGame({ trapCards: [BLINDING, CALTROPS], encounter: [FILLER, FILLER, FILLER] });
    const state = patchInstance(
      heroForm(stackTraps(withHandOnly(base, P1, OTHER, DEFENSE_EVENT, THWART_EVENT), BLINDING), P1),
      identityOf(base),
      { statuses: { stunned: 0, confused: 0, tough: 1 } },
    );
    let offered: string[] | null = null;
    const run = endTurnAnswering(state, (s) => {
      if (s.pendingChoice!.prompt.kind === "chooseOption" && offered === null)
        offered = s.pendingChoice!.options.map((o) => o.label.split(":")[0]!);
      return choosingOption("Disarm")(s);
    });
    expect(offered).toContain("Disarm");
    expect(discarded(run.state, run.events)).toHaveLength(2);
    expect(statuses(run.state).tough).toBe(1);
  });

  it("Trip deals 2 damage to the identity and confuses it", () => {
    const r = reveal(BLINDING, [], choosingOption("Trip"));
    expect(damage(r.state)).toBe(damage(r.before) + 2);
    expect(statuses(r.state).confused).toBe(1);
    expect(statuses(r.state).tough).toBe(0);
  });

  it("Trip is choosable while the identity is already confused: it still deals its 2 damage (the identity is a valid target of the damage)", () => {
    let state = trapGame({ trapCards: [BLINDING, CALTROPS], encounter: [FILLER, FILLER, FILLER] });
    state = heroForm(stackTraps(withHandOnly(state, P1), BLINDING), P1);
    const id = identityOf(state);
    state = {
      ...state,
      instances: {
        ...state.instances,
        [id]: { ...inst(state, id), statuses: { ...inst(state, id).statuses, confused: 1 } },
      },
    };
    const run = endTurnAnswering(state, choosingOption("Trip"));
    expect(damage(run.state)).toBe(damage(state) + 2);
    expect(statuses(run.state).confused).toBe(1);
  });

  it("is a TRAP! card: it is discarded to the trap discard pile", () => {
    const r = reveal(BLINDING, [], choosingOption("Trip"));
    expect(r.state.scenarioDecks["trap"]!.discard.map((id) => codeOf(r.state, id))).toContain(BLINDING);
  });
});

describe("Caltrops (65051): Avoid, Disarm or Trip", () => {
  it("Avoid discards a Defense event from the hand (a Thwart event is not one)", () => {
    const r = reveal(CALTROPS, [DEFENSE_EVENT, THWART_EVENT], choosingOption("Avoid"));
    expect(r.offered).toEqual(["Avoid", "Disarm", "Trip"]);
    expect(r.discarded).toEqual([DEFENSE_EVENT]);
    const none = reveal(CALTROPS, [THWART_EVENT, THWART_EVENT], choosingOption("Trip"));
    expect(none.offered).toBeNull();
    expect(none.discarded).toEqual([]);
    expect(damage(none.state)).toBe(damage(none.before) + 2);
  });

  it("Disarm discards an identity-specific card, then deals 2 damage to an enemy", () => {
    const r = reveal(CALTROPS, [DEFENSE_EVENT, THWART_EVENT], choosingOption("Disarm"));
    expect(r.discarded).toEqual([DEFENSE_EVENT]);
    // The only enemy in play is the villain.
    const villain = r.before.villains[0]!.instanceId;
    expect(inst(r.state, villain).damage).toBe(inst(r.before, villain).damage + 2);
    expect(damage(r.state)).toBe(damage(r.before));
  });

  it("Disarm is not offered with no identity-specific card in hand", () => {
    // For Justice! is a Justice aspect card, not identity-specific.
    const r = reveal(CALTROPS, [THWART_EVENT], choosingOption("Trip"));
    expect(r.offered).toBeNull();
    expect(damage(r.state)).toBe(damage(r.before) + 2);
  });

  it("Disarm is offered with an identity-specific card in hand (the card is the only requirement)", () => {
    const r = reveal(CALTROPS, [DEFENSE_EVENT], choosingOption("Disarm"));
    expect(r.offered).toContain("Disarm");
    expect(r.discarded).toEqual([DEFENSE_EVENT]);
  });

  it("Trip deals 2 damage to the identity and stuns it", () => {
    const r = reveal(CALTROPS, [], choosingOption("Trip"));
    expect(damage(r.state)).toBe(damage(r.before) + 2);
    expect(statuses(r.state).stunned).toBe(1);
    expect(statuses(r.state).confused).toBe(0);
  });
});

describe("an encounter card's unnamed choices belong to the first player (RRG 1.8 'First Player', p. 19)", () => {
  it("Blinding Powder revealed for the second player: the first player picks which of their characters gets the tough card", () => {
    let state = trapGame({
      seats: [SPIDER_MAN, CAPTAIN_MARVEL],
      passage: 5,
      trapCards: [BLINDING, BLINDING, CALTROPS],
      encounter: [FILLER, FILLER, FILLER],
    });
    state = heroForm(withHandOnly(state, P1), P1, P2);
    // P1 ends their turn; P2 then puts an ally into play, so P2 controls two characters that can take a tough card.
    state = endTurnAnswering(state, firstLegal, P1).state;
    const played = playFromHand(TRAP_DEPS, state, "01083", 3, firstLegal, P2);
    state = stackTraps(played.state, BLINDING, BLINDING);
    const asked: { player: string; labels: string[] }[] = [];
    const pick: Picker = (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget")
        asked.push({ player: choice.playerId, labels: choice.options.map((o) => o.label) });
      const disarm = choice.prompt.kind === "chooseOption" && choice.options.find((o) => o.label.startsWith("Disarm"));
      if (disarm) return [disarm.optionId];
      if (choice.prompt.kind === "chooseTarget")
        return [choice.options.find((o) => o.label === "Mockingbird")!.optionId];
      return firstLegal(s);
    };
    const run = endTurnAnswering(state, pick, P2);
    // Two characters of P2's (the identity and the ally) to choose from, chosen by P1.
    expect(asked).toEqual([{ player: P1, labels: expect.arrayContaining(["Mockingbird"]) }]);
    expect(asked[0]!.labels).toHaveLength(2);
    expect(run.state.instances[played.id]!.statuses.tough).toBe(1);
    expect(statuses(run.state).tough).toBe(0);
  });
});

describe("Hall of Punishment (65048) and Path of a Thousand Cuts (65049) boosts", () => {
  /** Rhino's activation against P1 with `code` on top as its boost card; optionally with an ally in play. */
  const boostRun = (code: string, ally: boolean) => {
    let state = trapGame({ villain: "rhino", encounter: [code, FILLER, FILLER] });
    let may: InstanceId | undefined;
    if (ally) {
      const played = playFromHand(TRAP_DEPS, state, ALLY, 3);
      state = played.state;
      may = played.id;
      expect(cardsInPlay(state)).toContain(may);
    }
    state = heroForm(stackEncounterDeck(state, code, FILLER), P1);
    return { before: state, may, ...endTurnAnswering(state, firstLegal) };
  };
  const boostCard = (r: ReturnType<typeof boostRun>) =>
    types(r.events, "boostCardFlipped").find(
      (e) => codeOf(r.state, e.instanceId) === HALL || codeOf(r.state, e.instanceId) === PATH,
    )!.instanceId;

  it("Hall: 1 threat on the main scheme for each character you control", () => {
    const placed = (r: ReturnType<typeof boostRun>) =>
      types(r.events, "threatPlaced")
        .filter((e) => e.sourceInstanceId === boostCard(r))
        .map((e) => e.amount);
    expect(placed(boostRun(HALL, false))).toEqual([1]);
    expect(placed(boostRun(HALL, true))).toEqual([2]);
  });

  it("Path: 1 damage to each character you control", () => {
    const dealt = (r: ReturnType<typeof boostRun>, target: InstanceId) =>
      types(r.events, "damageDealt").filter(
        (e) => e.targetInstanceId === target && e.sourceInstanceId === boostCard(r),
      );
    const solo = boostRun(PATH, false);
    expect(dealt(solo, identityOf(solo.state)).map((e) => e.amount)).toEqual([1]);
    const withAlly = boostRun(PATH, true);
    expect(dealt(withAlly, identityOf(withAlly.state)).map((e) => e.amount)).toEqual([1]);
    expect(dealt(withAlly, withAlly.may!).map((e) => e.amount)).toEqual([1]);
  });
});

describe("registry", () => {
  it("scripts the four refs and skips the four that need an option-choice trigger", () => {
    expect(Object.keys(SHADOWLAND_DEADLY_CONTRAPTIONS).sort()).toEqual([
      "65048.boost",
      "65049.boost",
      "65050.when-revealed",
      "65051.when-revealed",
    ]);
    expect(Object.keys(SHADOWLAND_DEADLY_CONTRAPTIONS_SKIPPED).sort()).toEqual([
      "65046.nervous-jitters-forced-interrupt",
      "65047.iron-monk-constant",
      "65048.hall-of-punishment-forced-interrupt",
      "65049.path-of-a-thousand-cuts-forced-interrupt",
    ]);
  });
});
