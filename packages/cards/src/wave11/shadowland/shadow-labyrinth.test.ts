import { cardsInPlay, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, playFromHand } from "../../testing/staging.js";
import { CAPTAIN_MARVEL, SHE_HULK, SPIDER_MAN, codeOf, heroForm, heroThwarts, types } from "../../wave9/testing.js";
import { SHADOWLAND_SHADOW_LABYRINTH, SHADOWLAND_SHADOW_LABYRINTH_SKIPPED } from "./shadow-labyrinth.js";
import {
  BLINDING,
  CALTROPS,
  CORRIDORS,
  DEAD_END,
  DEATHSTRIKE,
  FILLER,
  NO_TIME,
  SUDDEN_SHIFT,
  TRAP_DEPS,
  encounterPiles,
  endTurnAnswering,
  passageOn,
  stackTraps,
  trapDeck,
  trapGame,
  villainId,
  withHandOnly,
} from "./trap-testing.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * Shadow Labyrinth (MC65 pp. 12-13; docs/phase7-shadowland.md section 6 M3 to M6): Shifting Corridors (65037), Lord
 * Deathstrike (65041), Dead End (65042), No Time to Think! (65044) and Sudden Shift (65045). The pack is gated and the
 * scenario record (D4) does not exist yet, so the games are built by hand (`trapGame`): Core's Rhino game against Core
 * starter decks with Shifting Corridors as the villain (passage counters placed in the test) or Rhino, and a trap deck
 * of the TRAP! cards named, declared with `traitEncounterDeck`.
 */
const trapHas = (s: GameState): string[] => trapDeck(s).deck.map((id) => codeOf(s, id));
const trapDiscardHas = (s: GameState): string[] => trapDeck(s).discard.map((id) => codeOf(s, id));
const revealed = (s: GameState, events: readonly GameEvent[]) =>
  types(events, "encounterCardRevealed").map((e) => ({ code: codeOf(s, e.instanceId), player: e.playerId }));
/** A trap card with no choice to make once revealed to an empty hand and a confused-proof setup: Trip resolves alone. */
const TRAPS = [BLINDING, CALTROPS, BLINDING, CALTROPS] as const;

describe("Shifting Corridors (65037)", () => {
  it("instead of activating against you, removes a passage counter and reveals the top trap card for you", () => {
    let state = trapGame({ passage: 3, trapCards: TRAPS, encounter: [FILLER, FILLER] });
    state = heroForm(stackTraps(withHandOnly(state, P1), BLINDING), P1);
    const top = trapDeck(state).deck[0]!;
    const run = endTurnAnswering(state, firstLegal);
    expect(passageOn(run.state)).toBe(2);
    expect(revealed(run.state, run.events)).toContainEqual({ code: BLINDING, player: P1 });
    expect(run.events.some((e) => e.type === "encounterCardRevealed" && e.instanceId === top)).toBe(true);
    // The activation did not happen: no attack, no scheme, no boost card.
    expect(types(run.events, "attackResolved").filter((e) => e.enemyInstanceId === villainId(state))).toEqual([]);
    expect(types(run.events, "schemeResolved").filter((e) => e.enemyInstanceId === villainId(state))).toEqual([]);
    expect(types(run.events, "boostCardDealt")).toEqual([]);
  });

  it("the control: Rhino's activation does attack, deal a boost card and remove no counter", () => {
    let state = trapGame({ villain: "rhino", trapCards: TRAPS, encounter: [FILLER, FILLER] });
    state = heroForm(state, P1);
    const run = endTurnAnswering(state, firstLegal);
    expect(types(run.events, "attackResolved").length).toBeGreaterThan(0);
    expect(types(run.events, "boostCardDealt").length).toBeGreaterThan(0);
  });

  it("with two players it activates against each: two counters, and each reveals for the player it activated against", () => {
    let state = trapGame({
      seats: [SPIDER_MAN, CAPTAIN_MARVEL],
      passage: 4,
      trapCards: TRAPS,
      encounter: [FILLER, FILLER],
    });
    state = heroForm(withHandOnly(withHandOnly(state, P1), P2), P1, P2);
    state = stackTraps(state, BLINDING, CALTROPS);
    const run = endTurnAnswering(state, firstLegal, P1, P2);
    expect(passageOn(run.state)).toBe(2);
    expect(revealed(run.state, run.events).slice(0, 2)).toEqual([
      { code: BLINDING, player: P1 },
      { code: CALTROPS, player: P2 },
    ]);
  });

  it("the players lose the game when the last passage counter is removed", () => {
    let state = trapGame({ passage: 2, trapCards: TRAPS, encounter: [FILLER, FILLER] });
    state = heroForm(withHandOnly(state, P1), P1);
    const first = endTurnAnswering(state, firstLegal);
    expect(passageOn(first.state)).toBe(1);
    expect(first.state.outcome).toBeNull();
    const second = endTurnAnswering(first.state, firstLegal);
    expect(passageOn(second.state)).toBe(0);
    expect(second.state.outcome).toMatchObject({ result: "loss", reason: "cardAbility" });
  });

  it("is never defeated by damage (infinite hit points) and has Stalwart", () => {
    const state = trapGame({ passage: 3, trapCards: TRAPS });
    const id = villainId(state);
    const hit = { ...state, instances: { ...state.instances, [id]: { ...inst(state, id), damage: 500 } } };
    const run = endTurnAnswering(heroForm(withHandOnly(hit, P1), P1), firstLegal);
    expect(run.state.outcome).toBeNull();
    expect(run.state.villains.map((v) => v.instanceId)).toContain(id);
  });
});

describe("Lord Deathstrike (65041)", () => {
  it("with Shifting Corridors in play, shuffles the top 2 cards of the encounter deck into the trap deck", () => {
    let state = trapGame({ passage: 3, trapCards: TRAPS, encounter: [DEATHSTRIKE, FILLER, FILLER, FILLER] });
    state = heroForm(stackTraps(withHandOnly(state, P1), BLINDING), P1);
    state = stackEncounterDeck(state, DEATHSTRIKE, FILLER, FILLER, FILLER);
    const [, a, b] = encounterPiles(state).deck.slice(0, 3);
    const trapsBefore = trapHas(state).length;
    const run = endTurnAnswering(state, firstLegal);
    const inTraps = [...trapDeck(run.state).deck, ...trapDeck(run.state).discard];
    expect(inTraps).toContain(a);
    expect(inTraps).toContain(b);
    // Corridors' own interrupt revealed one trap card; Deathstrike revealed none (the cards joined, nothing was revealed).
    expect(revealed(run.state, run.events).map((r) => r.code)).toEqual([BLINDING, DEATHSTRIKE]);
    expect(trapHas(run.state).length + trapDiscardHas(run.state).length).toBe(trapsBefore + 2);
  });

  it("otherwise reveals the top card of the trap deck", () => {
    let state = trapGame({ villain: "rhino", trapCards: TRAPS, encounter: [DEATHSTRIKE, FILLER, FILLER, FILLER] });
    state = heroForm(stackTraps(withHandOnly(state, P1), CALTROPS), P1);
    state = stackEncounterDeck(state, FILLER, DEATHSTRIKE, FILLER);
    const run = endTurnAnswering(state, firstLegal);
    const codes = revealed(run.state, run.events).map((r) => r.code);
    expect(codes).toContain(DEATHSTRIKE);
    expect(codes[codes.indexOf(DEATHSTRIKE) + 1]).toBe(CALTROPS);
    // No encounter card joined the trap deck.
    expect(
      trapHas(run.state)
        .concat(trapDiscardHas(run.state))
        .filter((c) => c === FILLER),
    ).toEqual([]);
  });

  it("as a boost card, is put into play engaged with the player the activation is against", () => {
    let state = trapGame({ villain: "rhino", trapCards: TRAPS, encounter: [DEATHSTRIKE, FILLER, FILLER] });
    state = heroForm(stackEncounterDeck(withHandOnly(state, P1), DEATHSTRIKE, FILLER), P1);
    const id = Object.keys(state.instances).find((i) => codeOf(state, i as InstanceId) === DEATHSTRIKE)! as InstanceId;
    expect(cardsInPlay(state)).not.toContain(id);
    const run = endTurnAnswering(state, firstLegal);
    expect(cardsInPlay(run.state)).toContain(id);
    expect(inst(run.state, id).engagedWith).toBe(P1);
  });
});

describe("Dead End (65042)", () => {
  it("with Shifting Corridors in play, removes a passage counter from it and places no threat", () => {
    let state = trapGame({ passage: 4, trapCards: TRAPS, encounter: [DEAD_END, FILLER, FILLER] });
    state = heroForm(stackTraps(withHandOnly(state, P1), BLINDING), P1);
    state = stackEncounterDeck(state, DEAD_END, FILLER);
    const id = Object.keys(state.instances).find((i) => codeOf(state, i as InstanceId) === DEAD_END)! as InstanceId;
    const run = endTurnAnswering(state, firstLegal);
    // One counter for the activation, one for Dead End.
    expect(passageOn(run.state)).toBe(2);
    expect(inst(run.state, id).threat).toBe(2); // its printed 2[per_hero] only
  });

  it("otherwise places 1[per_hero] threat on itself, in addition to its starting threat", () => {
    for (const seats of [[SPIDER_MAN], [SPIDER_MAN, CAPTAIN_MARVEL]] as const) {
      let state = trapGame({ villain: "rhino", seats, trapCards: TRAPS, encounter: [DEAD_END, FILLER, FILLER] });
      state = heroForm(
        stackEncounterDeck(state, ...seats.map(() => FILLER), DEAD_END, FILLER),
        ...seats.map((_, i) => [P1, P2][i]!),
      );
      const id = Object.keys(state.instances).find((i) => codeOf(state, i as InstanceId) === DEAD_END)! as InstanceId;
      const run = endTurnAnswering(state, firstLegal, ...seats.map((_, i) => [P1, P2][i]!));
      // 2 per hero printed + 1 per hero from the When Revealed.
      expect(inst(run.state, id).threat).toBe(3 * seats.length);
    }
  });

  it("has Assault: a basic thwart against it uses ATK instead of THW (M6)", () => {
    let state = trapGame({
      villain: "rhino",
      seats: [SHE_HULK],
      trapCards: TRAPS,
      encounter: [DEAD_END, FILLER, FILLER],
    });
    state = heroForm(stackEncounterDeck(state, FILLER, DEAD_END), P1);
    state = endTurnAnswering(state, firstLegal).state;
    const id = Object.keys(state.instances).find((i) => codeOf(state, i as InstanceId) === DEAD_END)! as InstanceId;
    expect(cardsInPlay(state)).toContain(id);
    const before = inst(state, id).threat;
    const { state: after } = heroThwarts(TRAP_DEPS, state, id);
    // She-Hulk's ATK (3) is not her THW (1).
    expect(before - inst(after, id).threat).toBe(3);
  });
});

describe("No Time to Think! (65044)", () => {
  it("When Revealed: the villain activates against you", () => {
    const attacksOnP1 = (card: string) => {
      let state = trapGame({ villain: "rhino", trapCards: TRAPS, encounter: [NO_TIME, FILLER, FILLER] });
      state = heroForm(stackEncounterDeck(withHandOnly(state, P1), FILLER, card, FILLER), P1);
      const run = endTurnAnswering(state, firstLegal);
      return types(run.events, "attackResolved").filter(
        (e) => e.enemyInstanceId === villainId(state) && e.targetInstanceId === identityOf(state),
      ).length;
    };
    // Rhino's own activation, then the one No Time to Think! causes (a card-made activation is not an `enemyActivated`).
    expect(attacksOnP1(NO_TIME)).toBe(2);
    // The control: the same turn with another card dealt.
    expect(attacksOnP1(FILLER)).toBe(1);
  });

  it("boost during an attack: gains 2 boost icons and the attack gains overkill", () => {
    const run = (boostCard: string) => {
      let state = trapGame({ villain: "rhino", trapCards: TRAPS, encounter: [boostCard, FILLER, FILLER] });
      const played = playFromHand(TRAP_DEPS, state, "01059", 3);
      state = heroForm(stackEncounterDeck(played.state, boostCard, FILLER), P1);
      const defend: Picker = (s) => {
        const choice = s.pendingChoice!;
        if (choice.prompt.kind !== "declareDefender") return firstLegal(s);
        return [choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === played.id)!.optionId];
      };
      return { ally: played.id, ...driveEventsPicking(TRAP_DEPS, state, defend, endTurn(P1)) };
    };
    const noTime = run(NO_TIME);
    const control = run("01099"); // Core Rhino attachment with 2 boost icons and no Boost ability
    const attack = (r: typeof noTime) => types(r.events, "attackResolved")[0]!;
    // NO_TIME prints 1 icon: +2 makes 3. The control prints 2.
    expect(attack(noTime).boostIcons).toBe(3);
    expect(attack(control).boostIcons).toBe(2);
    // Overkill: the attack's damage beyond the defending ally's hit points goes on to the hero; without it, it is lost.
    const identityHit = (r: typeof noTime) =>
      types(r.events, "damageDealt")
        .filter((e) => e.targetInstanceId === identityOf(r.state))
        .reduce((sum, e) => sum + e.amount, 0);
    expect(identityHit(noTime)).toBeGreaterThan(0);
    expect(identityHit(control)).toBe(0);
  });

  it("boost during a scheme: neither the icons nor overkill apply", () => {
    let state = trapGame({ villain: "rhino", trapCards: TRAPS, encounter: [NO_TIME, FILLER, FILLER] });
    // Alter-ego form: Rhino schemes.
    state = stackEncounterDeck(state, NO_TIME, FILLER);
    const run = endTurnAnswering(state, firstLegal);
    const scheme = types(run.events, "schemeResolved")[0]!;
    expect(scheme.boostIcons).toBe(1);
  });
});

describe("Sudden Shift (65045)", () => {
  /** A Rhino game with one trap card in the trap discard pile, the card on top of the encounter deck after the boost. */
  const game = (stack: readonly string[]) => {
    let state = trapGame({
      villain: "rhino",
      trapCards: TRAPS,
      encounter: [SUDDEN_SHIFT, SUDDEN_SHIFT, FILLER, FILLER, FILLER, FILLER],
    });
    const piles = trapDeck(state);
    const discarded = piles.deck[0]!;
    state = {
      ...state,
      scenarioDecks: { ...state.scenarioDecks, trap: { ...piles, deck: piles.deck.slice(1), discard: [discarded] } },
    };
    state = heroForm(stackEncounterDeck(withHandOnly(state, P1), ...stack), P1);
    return { state, discarded };
  };
  const intoTraps = (events: readonly GameEvent[]) =>
    types(events, "cardMoved").filter((e) => e.to.kind === "scenarioDeck" && e.to.name === "trap");

  it("When Revealed: shuffles the trap discard pile and the top 3 encounter cards into the trap deck, then reveals the top trap card", () => {
    const { state, discarded } = game([FILLER, SUDDEN_SHIFT, FILLER, FILLER, FILLER]);
    const fillers = encounterPiles(state).deck.slice(2, 5);
    const run = endTurnAnswering(state, firstLegal);
    const moved = intoTraps(run.events).map((e) => e.instanceId);
    expect(moved).toContain(discarded);
    for (const f of fillers) expect(moved).toContain(f);
    expect(moved).toHaveLength(4);
    // Then a card of the trap deck was revealed.
    const codes = revealed(run.state, run.events).map((r) => r.code);
    expect(codes.indexOf(SUDDEN_SHIFT)).toBeGreaterThan(-1);
    expect(codes.length).toBeGreaterThan(codes.indexOf(SUDDEN_SHIFT) + 1);
  });

  it("Boost: shuffles the trap discard pile and the top 2 encounter cards into the trap deck", () => {
    const { state, discarded } = game([SUDDEN_SHIFT, FILLER, FILLER, FILLER]);
    const fillers = encounterPiles(state).deck.slice(1, 3);
    const run = endTurnAnswering(state, firstLegal);
    const moved = intoTraps(run.events).map((e) => e.instanceId);
    expect(moved).toContain(discarded);
    for (const f of fillers) expect(moved).toContain(f);
    expect(moved).toHaveLength(3);
  });
});

describe("registry", () => {
  it("scripts all nine refs and skips none", () => {
    expect(Object.keys(SHADOWLAND_SHADOW_LABYRINTH).sort()).toEqual([
      "65037.shifting-corridors-constant",
      "65037.shifting-corridors-forced-interrupt",
      "65041.boost",
      "65041.when-revealed",
      "65042.when-revealed",
      "65044.boost",
      "65044.when-revealed",
      "65045.boost",
      "65045.when-revealed",
    ]);
    expect(SHADOWLAND_SHADOW_LABYRINTH_SKIPPED).toEqual({});
    expect(CORRIDORS).toBe("65037");
  });
});
