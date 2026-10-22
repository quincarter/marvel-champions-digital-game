import {
  cardsInPlay,
  characterProfile,
  chosenVillainOf,
  createGame,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  settle,
  stackEncounterDeck,
  type Picker,
} from "../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea, playFromHand } from "../../testing/staging.js";
import { WAVE11_DEPS } from "../index.js";
import { wave11Scenario, type Wave11ScenarioOptions } from "../setup.js";
import {
  CAPTAIN_MARVEL,
  SHE_HULK,
  SPIDER_MAN,
  type Seats,
  codeOf,
  heroAttacks,
  heroForm,
  heroThwarts,
  types,
} from "../../wave9/testing.js";
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

const DAREDEVIL = "65013a";
const HALL_OF_HIDDEN_DOORS = "65043";
interface LabyrinthOptions {
  readonly seats?: Seats;
  readonly expert?: boolean;
  readonly pick?: string;
  readonly seed?: number;
}
/**
 * A real Shadow Labyrinth game, built by `wave11Scenario("shadow-labyrinth", ...)` with the Dark Protege villain picked
 * (Daredevil unless named); the trap deck is the record's own. Heroes in hero form.
 */
function labyrinthConfig(opts: LabyrinthOptions = {}) {
  const options: Wave11ScenarioOptions = {
    players: opts.seats ?? [SPIDER_MAN],
    seed: opts.seed ?? 3,
    villainCardId: opts.pick ?? DAREDEVIL,
    modularSetIds: ["ninja_swarm"],
    ...(opts.expert ? { difficulty: "expert" as const } : {}),
  };
  return wave11Scenario("shadow-labyrinth", options);
}
function labyrinth(opts: LabyrinthOptions = {}): GameState {
  const seats = opts.seats ?? [SPIDER_MAN];
  const created = createGame(labyrinthConfig(opts), WAVE11_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE11_DEPS);
  return heroForm(settled, ...seats.map((_, i) => [P1, P2][i]!));
}
const schemeId = (s: GameState): InstanceId => s.mainScheme.instanceId;
const threatOf = (s: GameState, id: InstanceId): number => inst(s, id).threat;
const readied = (s: GameState, ...players: readonly (typeof P1)[]): GameState =>
  players.reduce((acc, p) => patchInstance(acc, identityOf(acc, p), { exhausted: false }), s);
/** The scheme one threat from advancing, then the last threat removed by a real attack on Shifting Corridors. */
function atStage2(opts: LabyrinthOptions = {}) {
  const start = labyrinth(opts);
  const corridors = villainId(start);
  const run = heroAttacks(WAVE11_DEPS, patchInstance(start, schemeId(start), { threat: 1 }), corridors);
  return { ...run, corridors, start };
}
const attacksOn = (s: GameState, events: readonly GameEvent[], villain: InstanceId, player: typeof P1) =>
  types(events, "attackResolved").filter(
    (e) => e.enemyInstanceId === villain && e.targetInstanceId === identityOf(s, player),
  ).length;

describe("the scenario record's trap deck", () => {
  it("wave11Scenario alone declares it, and a real game finds the 8 trap cards", () => {
    const config = labyrinthConfig();
    expect(config.scenarioDecks).toHaveLength(1);
    expect(config.scenarioDecks![0]).toMatchObject({ name: "trap", discardPile: "own", buildAtSetup: true });
    const s = labyrinth();
    expect(trapHas(s)).toHaveLength(8);
    expect(trapHas(s)).toContain("65040");
  });
});

describe("Into the Labyrinth 1A: Setup (65038a.setup)", () => {
  it("builds the trap deck: every TRAP! card of the encounter deck, Whisper in the Dark among them", () => {
    const s = labyrinth();
    const traps = trapHas(s);
    expect(traps).toHaveLength(8);
    expect(traps).toContain("65040");
    // The seven Deadly Contraptions TRAP! treacheries and Whisper: none of them is still in the encounter deck.
    const remaining = encounterPiles(s).deck.map((id) => codeOf(s, id));
    for (const code of traps) expect(remaining).not.toContain(code);
  });

  it("the chosen Dark Protege villain waits set aside (scenario setup, not this script)", () => {
    const s = labyrinth({ pick: "65015a" });
    expect(codeOf(s, chosenVillainOf(s)!)).toBe("65015a");
    expect(s.encounterSetAside).toContain(chosenVillainOf(s));
  });
});

describe("Into the Labyrinth 1B: passage counters (65038b.when-revealed)", () => {
  it("standard: 10 per hero on Shifting Corridors", () => {
    expect(passageOn(labyrinth())).toBe(10);
    expect(passageOn(labyrinth({ seats: [SPIDER_MAN, CAPTAIN_MARVEL] }))).toBe(20);
  });
  it("expert: 7 per hero instead", () => {
    expect(passageOn(labyrinth({ expert: true }))).toBe(7);
    expect(passageOn(labyrinth({ expert: true, seats: [SPIDER_MAN, CAPTAIN_MARVEL] }))).toBe(14);
  });
});

describe("Into the Labyrinth 1B: damage to Shifting Corridors (65038b.into-the-labyrinth-forced-interrupt)", () => {
  it("removes that much threat from the main scheme instead; Shifting Corridors takes none", () => {
    const game = labyrinth();
    const start = patchInstance(game, schemeId(game), { threat: 10 });
    const run = heroAttacks(WAVE11_DEPS, start, villainId(start));
    const removed = types(run.events, "threatRemoved").filter((e) => e.schemeInstanceId === schemeId(start));
    // The attack's damage (Spider-Man's ATK) is the threat removed.
    expect(removed).toHaveLength(1);
    expect(removed[0]!.amount).toBeGreaterThan(0);
    expect(threatOf(run.state, schemeId(start))).toBe(10 - removed[0]!.amount);
    expect(inst(run.state, villainId(start)).damage).toBe(0);
    expect(passageOn(run.state)).toBe(10);
    expect(run.state.mainScheme.stageIndex).toBe(0);
  });

  it("damage above the remaining threat clamps the removal at 0 (and advances); Shifting Corridors takes none", () => {
    const game = labyrinth();
    const start = patchInstance(game, schemeId(game), { threat: 1 });
    const run = heroAttacks(WAVE11_DEPS, start, villainId(start));
    expect(types(run.events, "threatRemoved").find((e) => e.schemeInstanceId === schemeId(start))!.amount).toBe(1);
    expect(inst(run.state, villainId(start)).damage).toBe(0);
    expect(threatOf(run.state, schemeId(start))).toBeGreaterThanOrEqual(0);
  });

  it("the control: damage to another enemy is dealt as usual and removes no scheme threat", () => {
    const game = labyrinth();
    const minion = encounterCardInVillainArea(game, DEATHSTRIKE);
    const before = threatOf(minion.state, schemeId(game));
    const run = heroAttacks(WAVE11_DEPS, minion.state, minion.id);
    expect(inst(run.state, minion.id).damage).toBeGreaterThan(0);
    expect(threatOf(run.state, schemeId(game))).toBe(before);
  });
});

describe("Into the Labyrinth 1B: the last threat removed (65038b.into-the-labyrinth-forced-interrupt-2)", () => {
  it("advances to stage 2, and the stage 2A When Revealed puts the chosen villain in play on side A", () => {
    const { state, corridors, events } = atStage2();
    expect(state.mainScheme.stageIndex).toBe(1);
    expect(types(events, "mainSchemeAdvanced")).toHaveLength(1);
    expect(state.outcome).toBeNull();
    // 2A step 1: Shifting Corridors is set aside (out of play, no counters left).
    expect(types(events, "villainSetAside").map((e) => e.instanceId)).toEqual([corridors]);
    expect(state.encounterSetAside).toContain(corridors);
    expect(inst(state, corridors).counters).toEqual({});
    // Steps 2 and 3: the chosen villain, clean, side A, is the villain.
    const chosen = chosenVillainOf(state)!;
    expect(codeOf(state, chosen)).toBe(DAREDEVIL);
    expect(state.encounterSetAside).not.toContain(chosen);
    expect(state.villains.find((v) => v.instanceId === chosen)).toMatchObject({ side: "A", defeated: false });
    expect(state.activeVillainId).toBe(chosen);
    expect(types(events, "villainAdded").map((e) => e.instanceId)).toEqual([chosen]);
    expect(inst(state, chosen).damage).toBe(0);
    expect(inst(state, chosen).attachments).toEqual([]);
  });

  it("expert: the chosen villain is revealed on side B instead (18 hit points per player, tough, no side A reveal)", () => {
    const { state, events } = atStage2({ expert: true });
    expect(state.mainScheme.stageIndex).toBe(1);
    const chosen = chosenVillainOf(state)!;
    expect(state.villains.find((v) => v.instanceId === chosen)).toMatchObject({ side: "B", defeated: false });
    expect(characterProfile(state, chosen, WAVE11_DEPS)!.maxHp).toBe(18);
    // Side B's Toughness.
    expect(inst(state, chosen).statuses.tough).toBe(1);
    // flipCard logs a flip for what the card calls a reveal (setVillainSide is setup-only), and side A never resolved.
    expect(types(events, "villainFlipped").map((e) => e.instanceId)).toContain(chosen);
    expect(
      types(events, "abilityResolved").filter(
        (e) =>
          e.instanceId === chosen &&
          String(e.abilityId).startsWith("65013a.") &&
          /when-revealed/.test(String(e.abilityId)),
      ),
    ).toEqual([]);
  });

  it("any other way the last threat leaves it advances too (a thwart)", () => {
    const game = labyrinth();
    const start = patchInstance(game, schemeId(game), { threat: 1 });
    const run = heroThwarts(WAVE11_DEPS, start, schemeId(start));
    expect(run.state.mainScheme.stageIndex).toBe(1);
  });

  it("threat remaining: no advance", () => {
    const game = labyrinth();
    const start = patchInstance(game, schemeId(game), { threat: 5 });
    const run = heroThwarts(WAVE11_DEPS, start, schemeId(start));
    expect(run.state.mainScheme.stageIndex).toBe(0);
  });
});

describe("Chamber of Vile Secrets 2B (65039b)", () => {
  it("When Revealed, expert: the villain activates against each player", () => {
    const seats = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
    const expert = atStage2({ seats, expert: true });
    const standard = atStage2({ seats });
    const chosenExpert = chosenVillainOf(expert.state)!;
    const chosenStandard = chosenVillainOf(standard.state)!;
    for (const player of [P1, P2]) {
      expect(attacksOn(expert.state, expert.events, chosenExpert, player)).toBeGreaterThan(
        attacksOn(standard.state, standard.events, chosenStandard, player),
      );
    }
  });

  it("Forced Response: after you thwart this scheme, you reveal the top card of the trap deck", () => {
    const { state } = atStage2();
    const ready = stackTraps(readied(state, P1), BLINDING);
    const run = heroThwarts(WAVE11_DEPS, patchInstance(ready, schemeId(ready), { threat: 6 }), schemeId(ready));
    expect(revealed(run.state, run.events)).toContainEqual({ code: BLINDING, player: P1 });
  });

  // The thwart that removes stage 1's last threat does not trigger stage 2B's response: a stage change counts as the
  // next stage entering play (RRG 1.8 p. 27 step 1, p. 23).
  it("the stage-1 thwart that advances the scheme reveals no trap card and uses no limit", () => {
    const game = labyrinth();
    const start = stackTraps(patchInstance(game, schemeId(game), { threat: 1 }), BLINDING);
    const run = heroThwarts(WAVE11_DEPS, start, schemeId(start));
    expect(run.state.mainScheme.stageIndex).toBe(1);
    expect(revealed(run.state, run.events).filter((r) => r.code === BLINDING)).toEqual([]);
    const next = heroThwarts(
      WAVE11_DEPS,
      patchInstance(readied(run.state, P1), schemeId(start), { threat: 6 }),
      schemeId(start),
    );
    expect(revealed(next.state, next.events).filter((r) => r.player === P1)).toHaveLength(1);
  });

  it("limit once per round per player: a second thwart reveals nothing; another player's still does", () => {
    const seats = [SPIDER_MAN, CAPTAIN_MARVEL] as const;
    let { state } = atStage2({ seats });
    state = patchInstance(readied(state, P1, P2), schemeId(state), { threat: 12 });
    const first = heroThwarts(WAVE11_DEPS, state, schemeId(state), { player: P1 });
    expect(revealed(first.state, first.events).filter((r) => r.player === P1)).toHaveLength(1);
    const again = heroThwarts(WAVE11_DEPS, readied(first.state, P1), schemeId(state), { player: P1 });
    expect(revealed(again.state, again.events).filter((r) => r.player === P1)).toEqual([]);
    // P1 ends the turn; it is the same round, and P2's own limit is untouched.
    const passed = driveEventsPicking(WAVE11_DEPS, again.state, firstLegal, endTurn(P1)).state;
    const other = heroThwarts(WAVE11_DEPS, readied(passed, P2), schemeId(state), { player: P2 });
    expect(revealed(other.state, other.events).filter((r) => r.player === P2)).toHaveLength(1);
  });

  it("completing this stage loses the game", () => {
    const { state } = atStage2();
    const full = patchInstance(state, schemeId(state), { threat: 9 });
    const run = driveEventsPicking(WAVE11_DEPS, full, firstLegal, endTurn(P1));
    expect(run.state.outcome).toMatchObject({ result: "loss" });
  });
});

describe("Hall of Hidden Doors (65043)", () => {
  it("When Defeated: removes 5 threat from the main scheme, discards until a minion or side scheme, reveals it", () => {
    const game = labyrinth();
    const hall = encounterCardInVillainArea(
      patchInstance(game, schemeId(game), { threat: 20 }),
      HALL_OF_HIDDEN_DOORS,
      1,
    );
    const state = stackEncounterDeck(hall.state, NO_TIME, DEAD_END);
    const [noTime, deadEnd] = encounterPiles(state).deck as [InstanceId, InstanceId];
    const run = heroThwarts(WAVE11_DEPS, state, hall.id);
    expect(threatOf(run.state, schemeId(state))).toBe(15);
    expect(encounterPiles(run.state).discard).toContain(noTime);
    expect(cardsInPlay(run.state)).toContain(deadEnd);
    expect(revealed(run.state, run.events).map((r) => r.code)).toContain(DEAD_END);
    // Dead End's own When Revealed ran: Shifting Corridors is in play, so a passage counter went.
    expect(passageOn(run.state)).toBe(9);
  });

  it("Boost: places 3 threat on the main scheme", () => {
    const state = trapGame({ villain: "rhino", trapCards: TRAPS, encounter: [HALL_OF_HIDDEN_DOORS, FILLER, FILLER] });
    const run = endTurnAnswering(state, firstLegal);
    const placed = types(run.events, "threatPlaced").filter(
      (e) => e.schemeInstanceId === run.state.mainScheme.instanceId && e.amount === 3,
    );
    expect(placed).toHaveLength(1);
  });
});

describe("Whisper in the Dark (65040)", () => {
  it("is skipped with a written reason for each ref: the engine has no villain-as-minion primitive", () => {
    expect(Object.keys(SHADOWLAND_SHADOW_LABYRINTH_SKIPPED).filter((id) => id.startsWith("65040."))).toHaveLength(3);
  });
});

describe("registry", () => {
  it("scripts every ref of its group but Whisper in the Dark's", () => {
    expect(Object.keys(SHADOWLAND_SHADOW_LABYRINTH).sort()).toEqual([
      "65037.shifting-corridors-constant",
      "65037.shifting-corridors-forced-interrupt",
      "65038a.setup",
      "65038b.into-the-labyrinth-forced-interrupt",
      "65038b.into-the-labyrinth-forced-interrupt-2",
      "65038b.when-revealed",
      "65039a.chamber-of-vile-secrets-constant",
      "65039a.chamber-of-vile-secrets-constant-2",
      "65039a.chamber-of-vile-secrets-constant-3",
      "65039a.when-revealed",
      "65039b.chamber-of-vile-secrets-forced-response",
      "65039b.when-revealed",
      "65041.boost",
      "65041.when-revealed",
      "65042.when-revealed",
      "65043.boost",
      "65043.when-defeated",
      "65044.boost",
      "65044.when-revealed",
      "65045.boost",
      "65045.when-revealed",
    ]);
    expect(Object.keys(SHADOWLAND_SHADOW_LABYRINTH_SKIPPED).sort()).toEqual([
      "65040.when-defeated",
      "65040.when-revealed",
      "65040.whisper-in-the-dark-constant",
    ]);
    expect(CORRIDORS).toBe("65037");
  });
});
