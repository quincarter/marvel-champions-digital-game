import {
  activeEncounterDeck,
  activeVillain,
  applyCommand,
  cardsInPlay,
  characterProfile,
  legalActions,
  type EngineDeps,
  type GameEvent,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { cardId } from "@mc/content";
import { describe, expect, it } from "vitest";
import { WAVE6_DEPS } from "../index.js";
import {
  firstLegal,
  identityOf,
  inst,
  P1,
  P2,
  patchInstance,
  payWith,
  picking,
  play,
  playerOf,
  runWith,
  settle,
  stackEncounterDeck,
  threatOn,
  toHero,
  use,
} from "../../testing/harness.js";
import { driveEventsPicking } from "../../testing/staging.js";
import { each, forcedResponse, on, query, removeThreat, threatOn as threatOnRef } from "../../dsl/index.js";
import { SPIRAL_ABILITIES } from "./spiral.js";
import {
  inEncounterPiles,
  inPlay,
  showDeckCodes,
  spiralGame,
  spiralGameShowing,
  spiralOf,
  withShowDeck,
  withSpiral,
} from "./spiral-testing.js";

const deps: EngineDeps = WAVE6_DEPS;
const run = (state: GameState, ...commands: Parameters<typeof runWith>[2][]) => runWith(deps, state, ...commands);
const of = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);
const TWO = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
] as const;

const SEARCH = "39016";
const CORNERED_TREACHERY = "39017";
const SWORDS = "39018";
const TELEPORT = "39019";
const SHOW_MUST_GO_ON = "39020";
const WELL_ARMED = "39021";
const DIAL_M = "39035";
/** The Sci-Fi and Western SHOW environments (Mojo Runner, Wild Wild Mojo's set's own). */
const RUNNER = "39053";
const WESTERN_SHOW = "39066";
/** Assault and Advance, treacheries with no boost icons and no surge: they fill boost and reveal slots. */
const FILLER = "01187";
const FILLER_2 = "01186";
/** Crime Scene Investigation, a Crime side scheme: revealed, it only enters play (an inert reveal). */
const SOLDIER = "39037";
const FURY = "01084";
const HEROIC_STRIKE = "03004";
const MOCKINGBIRD = "01083";
const ENERGY = "01088";
const GENIUS = "01089";
const STRENGTH = "01090";
const SPIDER_SENSE = "01004";

const hero = (state: GameState, player: PlayerId = P1) => identityOf(state, player);
const spiral = (state: GameState) => spiralOf(state);
const side = (state: GameState) => activeVillain(state).side;
const stage = (state: GameState) => activeVillain(state).stageIndex;
const teleport = (state: GameState) => inst(state, spiral(state)).counters["teleport"] ?? 0;
/** P1 in hero form; `showing`: a game whose setup put that SHOW environment into play. */
const heroForm = (options: Parameters<typeof spiralGame>[0] = {}, showing?: string) =>
  settle(
    run(showing ? spiralGameShowing(showing, options) : spiralGame(options), toHero(P1)),
    firstLegal,
    undefined,
    deps,
  );
/** Every player ends their turn: `boost` cards are dealt first, then `reveal` is what step 3 reveals. */
const villainPhase = (
  state: GameState,
  boost: readonly string[],
  reveal: string,
  after: readonly string[] = [FILLER_2, FILLER],
  pick = firstLegal,
) =>
  driveEventsPicking(
    deps,
    stackEncounterDeck(state, ...boost, reveal, ...after),
    pick,
    ...state.players.map((p) => ({ type: "endTurn" as const, playerId: p.playerId })),
  );
const revealedCodes = (events: readonly GameEvent[]) =>
  of(events, "encounterCardRevealed").map((e) => e.cardId as string);
const threatFrom = (events: readonly GameEvent[], source: InstanceId) =>
  of(events, "threatPlaced")
    .filter((e) => e.sourceInstanceId === source)
    .map((e) => e.amount);
const atk = (state: GameState, id: InstanceId) => characterProfile(state, id, deps)!.atk;
/** Takes every optional trigger offered (a Response the player may use), declining nothing else. */
const accepting = (state: GameState): readonly string[] =>
  state.pendingChoice?.prompt.kind === "chooseTriggers"
    ? state.pendingChoice.options.map((o) => o.optionId).slice(0, 1)
    : firstLegal(state);
const handOf = (state: GameState, player: PlayerId = P1) => playerOf(state, player).hand;
/** Retypes the first hand cards of `player` into `codes` (surgery: the starter decks hold no such cards). */
const conjure = (state: GameState, codes: readonly string[], player: PlayerId = P1) => {
  const ids = handOf(state, player).slice(0, codes.length);
  const next = ids.reduce((s, id, i) => patchInstance(s, id, { cardId: cardId(codes[i]!) }), state);
  return { state: next, ids };
};
const attackCommand = (state: GameState) =>
  ({
    type: "basicAttack",
    playerId: P1,
    attackerInstanceId: hero(state),
    targetInstanceId: spiral(state),
  }) as const;
const attackSpiral = (state: GameState) => driveEventsPicking(deps, state, firstLegal, attackCommand(state));
/** RRG 1.8 "Target" (p. 43), ruling Mar 19, 2026 (2): a basic attack cannot target a character that cannot take damage. */
const attackRefused = (state: GameState): string | null => {
  const result = applyCommand(state, attackCommand(state), deps);
  return result.ok ? null : result.error.code;
};
/** Thwarts `scheme` with P1's hero (or `player`'s), answering prompts with `pick`. */
const thwart = (state: GameState, scheme: InstanceId, pick = firstLegal, player: PlayerId = P1) =>
  driveEventsPicking(deps, state, pick, {
    type: "basicThwart",
    playerId: player,
    thwarterInstanceId: hero(state, player),
    schemeInstanceId: scheme,
  });
const searchOf = (state: GameState) => inPlay(state, SEARCH)[0]!;
const showInPlay = (state: GameState) =>
  cardsInPlay(state).filter((id) => [DIAL_M, RUNNER, WESTERN_SHOW].includes(inst(state, id).cardId as string));
const codeOf = (state: GameState, id: InstanceId) => inst(state, id).cardId as string;

describe("registry", () => {
  it("scripts every ability ref of the Spiral set (both faces of each stage, boost abilities included)", () => {
    expect(Object.keys(SPIRAL_ABILITIES).sort()).toEqual(
      [
        "39012a.spiral-constant",
        "39012a.spiral-forced-interrupt",
        "39013a.spiral-constant",
        "39013a.spiral-forced-interrupt",
        "39014a.spiral-constant",
        "39014a.spiral-forced-interrupt",
        "39012b.spiral-constant",
        "39012b.spiral-forced-response",
        "39013b.spiral-constant",
        "39013b.spiral-forced-response",
        "39014b.spiral-constant",
        "39014b.spiral-forced-response",
        "39014b.when-revealed",
        "39015a.setup",
        "39015b.across-the-mojoverse-forced-interrupt",
        "39016.the-search-for-spiral-forced-response",
        "39016.the-search-for-spiral-action",
        "39017.when-revealed",
        "39018.spirals-swords-constant",
        "39018.spirals-swords-action",
        "39019.when-revealed",
        "39020.when-revealed",
        "39021.when-revealed",
      ].sort(),
    );
  });
});

describe("Across the Mojoverse 1A Setup (39015a.setup)", () => {
  it("standard: Spiral I begins on her ESCAPED side, and the main scheme is Across the Mojoverse", () => {
    const state = spiralGame();
    expect(inst(state, spiral(state)).cardId).toBe("39012a");
    expect(side(state)).toBe("A");
    expect(stage(state)).toBe(0);
    expect(inst(state, state.mainScheme.instanceId).cardId).toBe("39015a");
    expect(state.outcome).toBeNull();
  });

  it("puts The Search for Spiral into play with 3 threat per hero, in the villain area and not in the encounter deck", () => {
    const solo = spiralGame();
    expect(inPlay(solo, SEARCH)).toHaveLength(1);
    expect(threatOn(solo, searchOf(solo))).toBe(3);
    expect(inEncounterPiles(solo, SEARCH)).toEqual([]);
    const duo = spiralGame({ players: TWO });
    expect(threatOn(duo, searchOf(duo))).toBe(6);
  });

  it("puts exactly 1 SHOW environment into play and forms the show deck from the other two plus Cornered!", () => {
    const state = spiralGame();
    expect(showInPlay(state)).toHaveLength(1);
    const inDeck = showDeckCodes(state);
    expect([...inDeck].sort()).toEqual(
      [CORNERED_TREACHERY, DIAL_M, RUNNER, WESTERN_SHOW]
        .filter((c) => c !== codeOf(state, showInPlay(state)[0]!))
        .sort(),
    );
    // None of them is left in the encounter deck or its discard pile.
    for (const code of [CORNERED_TREACHERY, DIAL_M, RUNNER, WESTERN_SHOW])
      expect(inEncounterPiles(state, code)).toEqual([]);
    expect(state.scenarioDecks["show"]!.discard).toEqual([]);
  });

  it("the SHOW environment put into play is not revealed: no surge and no When Revealed (nothing else is in play with it)", () => {
    // Dial M for Mojo's When Revealed discards other SETTING environments; none was discarded to the show deck's bottom.
    for (const seed of [1, 2, 3, 4, 5, 6]) {
      const state = spiralGame({ seed });
      expect(showInPlay(state)).toHaveLength(1);
      expect(showDeckCodes(state)).toHaveLength(3);
    }
  });

  it("the SHOW environment is chosen at random: different seeds put different ones into play", () => {
    const first = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) {
      const state = spiralGame({ seed });
      first.add(codeOf(state, showInPlay(state)[0]!));
    }
    expect(first.size).toBeGreaterThan(1);
  });

  it("expert: Spiral II is the first stage, on her ESCAPED side", () => {
    const state = spiralGame({ difficulty: "expert" });
    expect(inst(state, spiral(state)).cardId).toBe("39012a");
    expect(stage(state)).toBe(1);
    expect(side(state)).toBe("A");
  });

  it("with no genre set named, three are chosen at random: three SHOW environments (one in play, two in the show deck)", () => {
    const state = spiralGame({ randomSets: true, seed: 4 });
    expect(showInPlay(state).length + showDeckCodes(state).filter((c) => c !== CORNERED_TREACHERY).length).toBe(3);
  });
});

describe("Spiral, ESCAPED (39012a-39014a)", () => {
  it("39012a.spiral-constant: cannot take damage (a basic attack cannot target her); CORNERED she can", () => {
    const state = heroForm();
    expect(side(state)).toBe("A");
    expect(attackRefused(state)).toBe("no_valid_target");
    expect(inst(state, hero(state)).exhausted).toBe(false);
    expect(inst(state, spiral(state)).damage).toBe(0);
    const cornered = withSpiral(state, { side: "B" });
    expect(inst(attackSpiral(cornered).state, spiral(cornered)).damage).toBeGreaterThan(0);
  });

  it("cannot be stunned: Mockingbird's stun leaves no status on her; CORNERED it does", () => {
    const stunnedAfter = (state: GameState) => {
      const conjured = conjure(state, [MOCKINGBIRD, ENERGY, ENERGY, ENERGY]);
      const [bird] = conjured.ids as [InstanceId];
      const { state: after } = driveEventsPicking(
        deps,
        conjured.state,
        accepting,
        play(P1, bird, payWith(conjured.state, P1, 3, [bird])),
      );
      return inst(after, spiral(after)).statuses.stunned;
    };
    const state = heroForm();
    expect(stunnedAfter(state)).toBe(0);
    expect(stunnedAfter(withSpiral(state, { side: "B" }))).toBe(1);
  });

  it("threat cannot be removed from the main scheme; CORNERED it can; a side scheme's is unaffected", () => {
    const staged = heroForm();
    const state = patchInstance(staged, staged.mainScheme.instanceId, { threat: 5 });
    const scheme = state.mainScheme.instanceId;
    // Either the thwart is refused or it removes nothing: the main scheme keeps all 5.
    const attempt = applyCommand(
      state,
      { type: "basicThwart", playerId: P1, thwarterInstanceId: hero(state), schemeInstanceId: scheme },
      deps,
    );
    const after = attempt.ok ? settle(attempt.state, firstLegal, undefined, deps) : state;
    expect(threatOn(after, scheme)).toBe(5);
    const cornered = withSpiral(state, { side: "B" });
    expect(threatOn(thwart(cornered, scheme).state, scheme)).toBeLessThan(5);
    const search = patchInstance(state, searchOf(state), { threat: 3 });
    expect(threatOn(thwart(search, searchOf(search)).state, searchOf(search))).toBeLessThan(3);
  });

  it("an effect whose only effect is damage cannot target her (ruling Apr 30, 2026 (1)); with a second effect it can", () => {
    // Nick Fury's "Deal 4 damage to an enemy" is a bare damage effect; Heroic Strike deals damage and stuns.
    const base = heroForm();
    const fury = conjure(base, [FURY, ENERGY, ENERGY]);
    const dealFour = (state: GameState, ids: readonly InstanceId[]) => {
      const played = applyCommand(state, play(P1, ids[0]!, payWith(state, P1, 2, [ids[0]!])), deps);
      expect(played.ok).toBe(true);
      if (!played.ok) return [];
      const picked = settle(played.state, picking("2"), (s) => s.pendingChoice?.prompt.kind !== "chooseOption", deps);
      return (picked.pendingChoice?.options ?? []).flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : []));
    };
    expect(dealFour(fury.state, fury.ids)).toEqual([]);
    const cornered = withSpiral(base, { side: "B" });
    const furyCornered = conjure(cornered, [FURY, ENERGY, ENERGY]);
    expect(dealFour(furyCornered.state, furyCornered.ids)).toEqual([spiral(cornered)]);
    const strike = conjure(base, [HEROIC_STRIKE, STRENGTH, ENERGY]);
    const [heroic, strength] = strike.ids as [InstanceId, InstanceId];
    const played = applyCommand(
      strike.state,
      play(P1, heroic, [strength, ...payWith(strike.state, P1, 1, [heroic, strength])]),
      deps,
    );
    expect(played.ok).toBe(true);
    if (played.ok) {
      const offered = (played.state.pendingChoice?.options ?? []).flatMap((o) =>
        o.ref.kind === "card" ? [o.ref.instanceId] : [],
      );
      expect(offered).toContain(spiral(base));
    }
  });

  it("a basic attack cannot target her at all (the villain is blocked while a minion is not)", () => {
    const state = heroForm();
    const actions = legalActions(state, P1, deps);
    if (actions.kind !== "turn") throw new Error("not P1's turn");
    const attacks = [...actions.legal, ...actions.illegal].filter(
      (e) => e.action.kind === "basicAttack" && e.action.instanceId === hero(state),
    );
    const offered = attacks.flatMap((e) => ("targets" in e ? e.targets : []));
    expect(offered).not.toContain(spiral(state));
  });

  it("39012a.spiral-forced-interrupt: when she would attack she schemes instead (SCH 1 placed, no damage to the hero)", () => {
    const state = heroForm();
    const { state: after, events } = villainPhase(state, [FILLER], SOLDIER);
    const schemes = of(events, "schemeResolved").filter((e) => e.enemyInstanceId === spiral(state));
    expect(schemes.map((e) => e.threatPlaced)).toEqual([1]);
    expect(of(events, "attackResolved")).toEqual([]);
    expect(inst(after, hero(after)).damage).toBe(0);
    // Exactly one boost card for that one activation.
    expect(of(events, "boostCardDealt")).toHaveLength(1);
  });

  it("39013a.spiral-forced-interrupt: Spiral II schemes for her SCH 2", () => {
    const state = heroForm({ difficulty: "expert" });
    expect(stage(state)).toBe(1);
    const { events } = villainPhase(state, [FILLER], SOLDIER);
    expect(
      of(events, "schemeResolved")
        .filter((e) => e.enemyInstanceId === spiral(state))
        .map((e) => e.threatPlaced),
    ).toEqual([2]);
    expect(of(events, "attackResolved")).toEqual([]);
  });

  it("39014a: Spiral III ESCAPED has the same rules (cannot take damage, schemes instead of attacking)", () => {
    const state = withSpiral(heroForm({ difficulty: "expert" }), { side: "A", stageIndex: 2 });
    expect(attackRefused(state)).toBe("no_valid_target");
    const { events } = villainPhase(state, [FILLER], SOLDIER);
    expect(
      of(events, "schemeResolved")
        .filter((e) => e.enemyInstanceId === spiral(state))
        .map((e) => e.threatPlaced),
    ).toEqual([2]);
    expect(of(events, "attackResolved")).toEqual([]);
  });
});

/** Spiral's counters, standing at `n` teleport counters (state surgery). */
const withTeleport = (state: GameState, n: number): GameState =>
  patchInstance(state, spiral(state), { counters: { ...inst(state, spiral(state)).counters, teleport: n } });
/** Brings Spiral to 1 hit point short of defeat on her current face and lands the killing blow with a real attack. */
const defeatSpiral = (state: GameState) => {
  const ready = patchInstance(
    patchInstance(state, spiral(state), { damage: 999, statuses: { stunned: 0, confused: 0, tough: 0 } }),
    hero(state),
    { exhausted: false },
  );
  return driveEventsPicking(deps, ready, firstLegal, attackCommand(ready));
};

describe("Spiral, CORNERED (39012b-39014b)", () => {
  it("39012b.spiral-forced-response: after she activates (attacks a hero), place 1 teleport counter on her", () => {
    const state = withSpiral(heroForm(), { side: "B" });
    const { state: after, events } = villainPhase(state, [FILLER], SOLDIER);
    expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === spiral(state))).toHaveLength(1);
    expect(teleport(after)).toBe(1);
    expect(side(after)).toBe("B");
  });

  it("39012b.spiral-forced-response: after she activates against an alter-ego (schemes) the counter is placed too", () => {
    const state = withSpiral(spiralGame(), { side: "B" });
    const { state: after, events } = villainPhase(state, [FILLER], SOLDIER);
    expect(of(events, "schemeResolved").filter((e) => e.enemyInstanceId === spiral(state))).toHaveLength(1);
    expect(teleport(after)).toBe(1);
  });

  it("39012b.spiral-constant: at 3 teleport counters per hero she loses them all and flips to ESCAPED (2 short: no flip)", () => {
    const base = withSpiral(heroForm(), { side: "B" });
    const short = villainPhase(withTeleport(base, 1), [FILLER], SOLDIER).state;
    expect(teleport(short)).toBe(2);
    expect(side(short)).toBe("B");
    const { state: flipped, events } = villainPhase(withTeleport(base, 2), [FILLER], SOLDIER);
    expect(side(flipped)).toBe("A");
    expect(teleport(flipped)).toBe(0);
    expect(of(events, "villainFlipped").map((e) => [e.from, e.to])).toEqual([["B", "A"]]);
    expect(stage(flipped)).toBe(0);
  });

  it("39012b.spiral-constant: 3 per hero is 6 with two players (she activates once against each player)", () => {
    const base = withSpiral(heroForm({ players: TWO }), { side: "B" });
    const short = villainPhase(withTeleport(base, 3), [FILLER, FILLER], SOLDIER, []).state;
    expect(teleport(short)).toBe(5);
    expect(side(short)).toBe("B");
    const { state } = villainPhase(withTeleport(base, 4), [FILLER, FILLER], SOLDIER, []);
    expect(side(state)).toBe("A");
    expect(teleport(state)).toBe(0);
  });

  it("39013b.spiral-constant: Spiral II flips at 2 teleport counters per hero", () => {
    const base = withSpiral(heroForm({ difficulty: "expert" }), { side: "B" });
    expect(stage(base)).toBe(1);
    expect(side(villainPhase(withTeleport(base, 0), [FILLER], SOLDIER).state)).toBe("B");
    const { state } = villainPhase(withTeleport(base, 1), [FILLER], SOLDIER);
    expect(side(state)).toBe("A");
    expect(teleport(state)).toBe(0);
    expect(stage(state)).toBe(1);
  });

  it("39014b.spiral-constant: Spiral III flips at 3 teleport counters per hero", () => {
    const base = withSpiral(heroForm({ difficulty: "expert" }), { side: "B", stageIndex: 2 });
    expect(side(villainPhase(withTeleport(base, 1), [FILLER], SOLDIER).state)).toBe("B");
    const { state } = villainPhase(withTeleport(base, 2), [FILLER], SOLDIER);
    expect(side(state)).toBe("A");
    expect(stage(state)).toBe(2);
  });

  it("FAQ 'Dial M for Mojo (#35)': flipping her with Dial M in play reveals the new face, and its incite 1 places 1 threat", () => {
    const base = withSpiral(heroForm({}, DIAL_M), { side: "B" });
    expect(inPlay(base, DIAL_M)).toHaveLength(1);
    const { events } = villainPhase(withTeleport(base, 2), [FILLER], SOLDIER);
    // The flip is her only source of threat this phase: her activation was an attack on the hero.
    expect(threatFrom(events, spiral(base))).toEqual([1]);
    const without = villainPhase(withTeleport(withSpiral(heroForm({}, RUNNER), { side: "B" }), 2), [FILLER], SOLDIER);
    expect(threatFrom(without.events, spiral(base))).toEqual([]);
  });

  it("defeating her on her CORNERED side brings in the next stage on the same side (insert p. 12)", () => {
    const state = withSpiral(heroForm(), { side: "B" });
    const { state: after } = defeatSpiral(state);
    expect(stage(after)).toBe(1);
    expect(side(after)).toBe("B");
    expect(inst(after, spiral(after)).cardId).toBe("39012a");
    expect(activeVillain(after).defeated).toBe(false);
  });

  it("39014b.when-revealed: Spiral III attacks each player in player order, alter-ego form included", () => {
    const base = withSpiral(heroForm({ difficulty: "expert", players: TWO }), { side: "B" });
    expect(stage(base)).toBe(1);
    const { events } = defeatSpiral(base);
    const attacks = of(events, "attackResolved").filter((e) => e.enemyInstanceId === spiral(base));
    expect(attacks.map((e) => e.targetInstanceId)).toEqual([hero(base, P1), hero(base, P2)]);
    // P1 is in hero form, P2 in alter-ego form; ATK 3 each.
    expect(attacks.map((e) => e.baseAtk)).toEqual([3, 3]);
  });
});

/** A Dial M game whose show deck holds, top first, exactly these three (Cornered! and the other two SHOW environments). */
const showGame = (...top: readonly string[]) => withShowDeck(heroForm({}, DIAL_M), ...top);
const reveals = (events: readonly GameEvent[]) =>
  of(events, "encounterCardRevealed").map((e) => [e.cardId as string, e.playerId as string]);
const INERT_DECK = [RUNNER, WESTERN_SHOW, CORNERED_TREACHERY] as const;

describe("The Search for Spiral (39016)", () => {
  it("Forced Response: the last threat removed reveals the top show-deck card and places 3 threat per hero here", () => {
    const base = showGame(...INERT_DECK);
    const staged = patchInstance(base, searchOf(base), { threat: 1 });
    const { state, events } = thwart(staged, searchOf(staged));
    expect(of(events, "threatRemoved").map((e) => [e.schemeInstanceId, e.amount])).toEqual([[searchOf(staged), 1]]);
    expect(reveals(events)).toEqual([[RUNNER, P1]]);
    expect(of(events, "surgeTriggered")).toEqual([]);
    expect(threatOn(state, searchOf(state))).toBe(3);
    // Permanent (RRG 1.8 p. 32): it stays in play, never defeated, so nothing is announced and nothing tries to leave.
    expect(cardsInPlay(state)).toContain(searchOf(staged));
    expect(of(events, "schemeDefeated")).toEqual([]);
    expect(of(events, "leavePlayBlocked")).toEqual([]);
  });

  it("the revealed SHOW environment enters play and the one it replaces goes to the bottom of the show deck (1B)", () => {
    const base = showGame(...INERT_DECK);
    const staged = patchInstance(base, searchOf(base), { threat: 1 });
    const { state } = thwart(staged, searchOf(staged));
    expect(showInPlay(state).map((id) => codeOf(state, id))).toEqual([RUNNER]);
    expect(showDeckCodes(state)).toEqual([WESTERN_SHOW, CORNERED_TREACHERY, DIAL_M]);
    expect(inEncounterPiles(state, DIAL_M)).toEqual([]);
    expect(state.scenarioDecks["show"]!.discard).toEqual([]);
  });

  it("places 3 threat per hero: 6 with two players, and the player who removed the last threat does the revealing", () => {
    // P1 ends their turn, so it is P2's hero that thwarts.
    const p2Turn = settle(
      run(spiralGameShowing(DIAL_M, { players: TWO }), { type: "endTurn", playerId: P1 }),
      firstLegal,
      (s) => s.step.kind === "turn" && s.step.activePlayerId === P2,
      deps,
    );
    const afterP1 = withShowDeck(settle(run(p2Turn, toHero(P2)), firstLegal, undefined, deps), ...INERT_DECK);
    const staged = patchInstance(afterP1, searchOf(afterP1), { threat: 1 });
    const { state, events } = thwart(staged, searchOf(staged), firstLegal, P2);
    expect(reveals(events)).toEqual([[RUNNER, P2]]);
    expect(threatOn(state, searchOf(state))).toBe(6);
  });

  it("does nothing while any threat is left on it", () => {
    const base = showGame(...INERT_DECK);
    const staged = patchInstance(base, searchOf(base), { threat: 5 });
    const { state, events } = thwart(staged, searchOf(staged));
    expect(threatOn(state, searchOf(state))).toBe(3);
    expect(reveals(events)).toEqual([]);
    expect(showDeckCodes(state)).toEqual([...INERT_DECK]);
  });

  it("39016.the-search-for-spiral-action: take 2 damage as a cost, then remove 3 threat from it", () => {
    const base = heroForm();
    const search = searchOf(base);
    expect(SPIRAL_ABILITIES["39016.the-search-for-spiral-action"]!.cost).toEqual({ damageSelf: 2 });
    const used = driveEventsPicking(deps, base, firstLegal, use(P1, search, "39016.the-search-for-spiral-action"));
    expect(inst(used.state, hero(base)).damage).toBe(2);
    expect(threatOn(used.state, search)).toBe(3 - 3 + 3);
    // The damage is paid before any threat is removed.
    const order = used.events.filter((e) => e.type === "damageDealt" || e.type === "threatRemoved").map((e) => e.type);
    expect(order[0]).toBe("damageDealt");
    expect(of(used.events, "threatRemoved").map((e) => e.amount)).toEqual([3]);
  });

  it("the Hero Action removes only 3 threat, so with more left the show deck stays closed", () => {
    const base = showGame(...INERT_DECK);
    const staged = patchInstance(base, searchOf(base), { threat: 5 });
    const used = driveEventsPicking(
      deps,
      staged,
      firstLegal,
      use(P1, searchOf(staged), "39016.the-search-for-spiral-action"),
    );
    expect(threatOn(used.state, searchOf(staged))).toBe(2);
    expect(reveals(used.events)).toEqual([]);
  });

  // The `removeThreat` event names the player who used the Hero Action (the scheme itself has no controller).
  it("the Hero Action that removes the last threat triggers the Forced Response, revealing for the acting player", () => {
    const base = showGame(...INERT_DECK);
    const used = driveEventsPicking(
      deps,
      base,
      firstLegal,
      use(P1, searchOf(base), "39016.the-search-for-spiral-action"),
    );
    expect(reveals(used.events)).toEqual([[RUNNER, P1]]);
    expect(threatOn(used.state, searchOf(base))).toBe(3);
  });

  // Owner decision Q64 = B: when no player removed the last threat (an encounter card's forced removal), the first
  // player reveals. Dial M for Mojo is rescripted here as such a card: "Forced Response: After a hero thwarts, remove
  // all threat from The Search for Spiral."
  describe("the last threat removed by an encounter card's forced ability (owner decision Q64)", () => {
    const SEARCH_REF = each(query("sideScheme", { name: "The Search for Spiral" }));
    const forcedDeps: EngineDeps = {
      ...deps,
      abilities: {
        ...deps.abilities,
        "39035.dial-m-for-mojo-constant-2": forcedResponse(
          on.thwarts(query("identity")),
          removeThreat(threatOnRef(SEARCH_REF), SEARCH_REF),
        ),
      },
    };
    const thwartForced = (state: GameState, player: PlayerId) =>
      driveEventsPicking(forcedDeps, state, firstLegal, {
        type: "basicThwart",
        playerId: player,
        thwarterInstanceId: hero(state, player),
        schemeInstanceId: searchOf(state),
      });
    /** The removal that emptied the scheme: the forced one, after the thwart's own. */
    const removals = (events: readonly GameEvent[], search: InstanceId) =>
      of(events, "threatRemoved")
        .filter((e) => e.schemeInstanceId === search)
        .map((e) => e.amount);

    it("one player: the first player reveals and the scheme gets its 3 threat per hero", () => {
      const base = showGame(...INERT_DECK);
      const staged = patchInstance(base, searchOf(base), { threat: 10 });
      const { state, events } = thwartForced(staged, P1);
      const amounts = removals(events, searchOf(staged));
      expect(amounts).toHaveLength(2);
      expect(amounts[0]! + amounts[1]!).toBe(10);
      expect(reveals(events)).toEqual([[RUNNER, P1]]);
      expect(threatOn(state, searchOf(state))).toBe(3);
    });

    it("two players: P2 thwarts but the forced removal took the last threat, so the first player (P1) reveals", () => {
      const p2Turn = settle(
        run(spiralGameShowing(DIAL_M, { players: TWO }), { type: "endTurn", playerId: P1 }),
        firstLegal,
        (s) => s.step.kind === "turn" && s.step.activePlayerId === P2,
        deps,
      );
      const afterP1 = withShowDeck(settle(run(p2Turn, toHero(P2)), firstLegal, undefined, deps), ...INERT_DECK);
      expect(afterP1.firstPlayerId).toBe(P1);
      const staged = patchInstance(afterP1, searchOf(afterP1), { threat: 10 });
      const { state, events } = thwartForced(staged, P2);
      expect(removals(events, searchOf(staged))).toHaveLength(2);
      expect(reveals(events)).toEqual([[RUNNER, P1]]);
      expect(threatOn(state, searchOf(state))).toBe(6);
    });

    it("control: P2's own thwart removing the last threat still reveals for P2", () => {
      const p2Turn = settle(
        run(spiralGameShowing(DIAL_M, { players: TWO }), { type: "endTurn", playerId: P1 }),
        firstLegal,
        (s) => s.step.kind === "turn" && s.step.activePlayerId === P2,
        deps,
      );
      const afterP1 = withShowDeck(settle(run(p2Turn, toHero(P2)), firstLegal, undefined, deps), ...INERT_DECK);
      const staged = patchInstance(afterP1, searchOf(afterP1), { threat: 1 });
      const { events } = thwartForced(staged, P2);
      expect(reveals(events)).toEqual([[RUNNER, P2]]);
    });
  });

  it("is a Hero Action: an alter-ego cannot use it", () => {
    const base = spiralGame();
    const result = applyCommand(base, use(P1, searchOf(base), "39016.the-search-for-spiral-action"), deps);
    expect(result.ok).toBe(false);
  });

  it("works while Spiral is ESCAPED: her rule only protects the main scheme", () => {
    const base = heroForm();
    expect(side(base)).toBe("A");
    const used = driveEventsPicking(
      deps,
      base,
      firstLegal,
      use(P1, searchOf(base), "39016.the-search-for-spiral-action"),
    );
    expect(of(used.events, "threatRemoved")).toHaveLength(1);
  });
});

describe("Cornered! (39017)", () => {
  /** The top of the show deck is Cornered!; The Search for Spiral is emptied so that its own Forced Response reveals it. */
  const searchReveals = (state: GameState) => {
    const staged = patchInstance(state, searchOf(state), { threat: 1 });
    return thwart(staged, searchOf(staged));
  };

  it("39017.when-revealed: flips Spiral to CORNERED, reveals the next show-deck card and shuffles itself into the deck", () => {
    const base = showGame(CORNERED_TREACHERY, RUNNER, WESTERN_SHOW);
    expect(side(base)).toBe("A");
    const { state, events } = searchReveals(base);
    // Her new face is revealed in full between the two (`encounterCardRevealed` for 39012a).
    expect(reveals(events)).toEqual([
      [CORNERED_TREACHERY, P1],
      ["39012a", P1],
      [RUNNER, P1],
    ]);
    expect(of(events, "villainFlipped").map((e) => [e.from, e.to])).toEqual([["A", "B"]]);
    expect(side(state)).toBe("B");
    expect(stage(state)).toBe(0);
    // Not surged: a SHOW revealed from the show deck, and no card was surged at all.
    expect(of(events, "surgeTriggered")).toEqual([]);
    // Cornered! is back in the show deck with the other two SHOW environments (Dial M to the bottom, 1B); the order
    // of the shuffled card is random, so the deck is compared as a set.
    expect([...showDeckCodes(state)].sort()).toEqual([CORNERED_TREACHERY, DIAL_M, WESTERN_SHOW].sort());
    expect(showDeckCodes(state)[1] === DIAL_M || showDeckCodes(state).includes(DIAL_M)).toBe(true);
  });

  it("never reaches the discard pile: not the encounter discard, not in play, not the show deck's own", () => {
    const { state } = searchReveals(showGame(CORNERED_TREACHERY, RUNNER, WESTERN_SHOW));
    expect(inEncounterPiles(state, CORNERED_TREACHERY)).toEqual([]);
    expect(inPlay(state, CORNERED_TREACHERY)).toEqual([]);
    expect(activeEncounterDeck(state).discard.map((id) => codeOf(state, id))).not.toContain(CORNERED_TREACHERY);
    expect(state.scenarioDecks["show"]!.discard).toEqual([]);
    expect(showDeckCodes(state)).toContain(CORNERED_TREACHERY);
  });

  it("the new face is revealed in full: Spiral III CORNERED attacks each player when Cornered! flips her", () => {
    const base = withSpiral(
      withShowDeck(heroForm({ difficulty: "expert" }, DIAL_M), CORNERED_TREACHERY, RUNNER, WESTERN_SHOW),
      {
        side: "A",
        stageIndex: 2,
      },
    );
    const { state, events } = searchReveals(base);
    expect(side(state)).toBe("B");
    expect(
      of(events, "attackResolved")
        .filter((e) => e.enemyInstanceId === spiral(base))
        .map((e) => e.baseAtk),
    ).toEqual([3]);
  });

  it("FAQ 'Dial M for Mojo (#35)': with Dial M in play, her incite 1 places 1 threat on the main scheme as she flips", () => {
    const { events } = searchReveals(showGame(CORNERED_TREACHERY, RUNNER, WESTERN_SHOW));
    expect(threatFrom(events, spiralOf(showGame(CORNERED_TREACHERY, RUNNER, WESTERN_SHOW)))).toEqual([1]);
  });

  it("already CORNERED: no flip, but it still reveals the next card and shuffles itself in", () => {
    const base = withSpiral(showGame(CORNERED_TREACHERY, RUNNER, WESTERN_SHOW), { side: "B" });
    const { state, events } = searchReveals(base);
    expect(of(events, "villainFlipped")).toEqual([]);
    expect(reveals(events)).toEqual([
      [CORNERED_TREACHERY, P1],
      [RUNNER, P1],
    ]);
    expect(showDeckCodes(state)).toContain(CORNERED_TREACHERY);
  });

  it("cannot be canceled: the ability is flagged uncancellable", () => {
    expect(SPIRAL_ABILITIES["39017.when-revealed"]!.uncancellable).toBe(true);
  });
});

/** Well-Armed revealed in a villain phase: Spiral's Swords from the encounter deck attached to her. */
const armed = (state: GameState) => villainPhase(state, [FILLER], WELL_ARMED, []);
const swordsOf = (state: GameState) => inPlay(state, SWORDS);

describe("Well-Armed (39021) and Spiral's Swords (39018)", () => {
  it("Well-Armed with no Swords on her: searches the encounter deck for a copy and attaches it to her, with 3 sword counters", () => {
    const base = withSpiral(heroForm(), { side: "B" });
    const { state, events } = armed(base);
    expect(swordsOf(state)).toHaveLength(1);
    const [swords] = swordsOf(state) as [InstanceId];
    expect(inst(state, swords).attachedTo).toBe(spiral(base));
    expect(inst(state, swords).counters["sword"]).toBe(3);
    expect(of(events, "deckShuffled").some((e) => e.zone.kind === "encounterDeck")).toBe(true);
    // No attack came from the card itself: only her one activation this phase.
    expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === spiral(base))).toHaveLength(1);
  });

  it("Well-Armed finds the copy in the discard pile too", () => {
    const base = withSpiral(heroForm(), { side: "B" });
    const deck = activeEncounterDeck(base);
    const copies = deck.deck.filter((id) => codeOf(base, id) === SWORDS);
    expect(copies).toHaveLength(2);
    const moved = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        e1: { deck: deck.deck.filter((id) => !copies.includes(id)), discard: [...deck.discard, ...copies] },
      },
    };
    const { state } = armed(moved);
    expect(swordsOf(state)).toHaveLength(1);
  });

  it("Well-Armed with Swords already on her: she attacks you even in alter-ego form, and nothing is searched for", () => {
    const first = armed(withSpiral(heroForm(), { side: "B" })).state;
    // P1 is in alter-ego form (the form change is surgery-free: the hero changes back).
    const alterEgo = settle(run(first, toHero(P1)), firstLegal, undefined, deps);
    expect(inst(alterEgo, hero(alterEgo)).flipped).toBe(false);
    const { state, events } = armed(alterEgo);
    expect(swordsOf(state)).toHaveLength(1);
    const swordsAttack = of(events, "attackResolved").filter((e) => e.enemyInstanceId === spiral(alterEgo));
    expect(swordsAttack.length).toBeGreaterThanOrEqual(1);
    expect(swordsAttack.every((e) => e.targetInstanceId === hero(alterEgo))).toBe(true);
    expect(inEncounterPiles(state, SWORDS)).toHaveLength(1);
  });

  it("Well-Armed with Swords on her while ESCAPED: her forced interrupt turns that attack into a scheme", () => {
    const first = armed(withSpiral(heroForm(), { side: "B" })).state;
    const escaped = withSpiral(first, { side: "A" });
    const { events } = armed(escaped);
    expect(of(events, "attackResolved").filter((e) => e.enemyInstanceId === spiral(escaped))).toEqual([]);
    expect(
      of(events, "schemeResolved").filter((e) => e.enemyInstanceId === spiral(escaped)).length,
    ).toBeGreaterThanOrEqual(2);
  });

  it("39018.spirals-swords-constant: Spiral gets +1 ATK for each sword counter on it", () => {
    const base = withSpiral(heroForm(), { side: "B" });
    const printed = atk(base, spiral(base));
    const { state } = armed(base);
    // Her activation resolved before the Swords came, so the ATK read now is printed + 3.
    expect(atk(state, spiral(state))).toBe(printed + 3);
    const [swords] = swordsOf(state) as [InstanceId];
    const worn = patchInstance(state, swords, { counters: { sword: 1 } });
    expect(atk(worn, spiral(worn))).toBe(printed + 1);
  });

  it("39018.spirals-swords-action: while she is CORNERED, spending [physical][physical] removes 1 sword counter", () => {
    const { state } = armed(withSpiral(heroForm(), { side: "B" }));
    const [swords] = swordsOf(state) as [InstanceId];
    const ACTION = "39018.spirals-swords-action";
    const conjured = conjure(state, [STRENGTH, STRENGTH, ENERGY]);
    const pay = (codes: readonly number[]) =>
      conjured.ids.filter((_, i) => codes.includes(i)).map((fromHand) => ({ fromHand }));
    // A Strength resource card is worth [physical][physical] by itself.
    const paid = applyCommand(conjured.state, use(P1, swords, ACTION, pay([0])), deps);
    expect(paid.ok).toBe(true);
    if (paid.ok) expect(inst(settle(paid.state, firstLegal, undefined, deps), swords).counters["sword"]).toBe(2);
    // [energy][energy] is not [physical][physical].
    expect(applyCommand(conjured.state, use(P1, swords, ACTION, pay([2])), deps).ok).toBe(false);
  });

  it("39018.spirals-swords-action: not while she is ESCAPED", () => {
    const { state } = armed(withSpiral(heroForm(), { side: "B" }));
    const escaped = withSpiral(state, { side: "A" });
    const [swords] = swordsOf(escaped) as [InstanceId];
    const conjured = conjure(escaped, [STRENGTH, STRENGTH]);
    const result = applyCommand(
      conjured.state,
      use(
        P1,
        swords,
        "39018.spirals-swords-action",
        conjured.ids.map((fromHand) => ({ fromHand })),
      ),
      deps,
    );
    expect(result.ok).toBe(false);
  });
});

describe("Erratic Teleportation (39019)", () => {
  const reveal = (state: GameState, pick = firstLegal) =>
    villainPhase(state, [FILLER], TELEPORT, [SOLDIER, FILLER], pick);

  it("is a surge card: the next card is revealed too", () => {
    const { events } = reveal(withSpiral(heroForm(), { side: "B" }));
    expect(revealedCodes(events).slice(0, 2)).toEqual([TELEPORT, SOLDIER]);
    expect(of(events, "surgeTriggered")).toHaveLength(1);
  });

  it("CORNERED: places 1 teleport counter on her (on top of the one for her activation)", () => {
    const base = withSpiral(heroForm(), { side: "B" });
    expect(teleport(reveal(base).state)).toBe(2);
  });

  it("CORNERED: the counter that reaches the threshold flips her", () => {
    const base = withTeleport(withSpiral(heroForm(), { side: "B" }), 1);
    // 1 + her activation = 2, then this card's counter = 3 = 3 per hero.
    expect(side(reveal(base).state)).toBe("A");
  });

  it("ESCAPED: you may spend a [mental] resource to look at the top show-deck card and put it on top or on the bottom", () => {
    const base = showGame(...INERT_DECK);
    const conjured = conjure(base, [GENIUS]);
    // The hand is full at the end of the turn: discard the last card, never the conjured Genius.
    const pick = (choose: string) => (s: GameState) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "discardDownToHandSize") return [choice.options.at(-1)!.optionId];
      if (choice.prompt.kind === "spendResources")
        return choice.options.filter((o) => o.label === "Genius").map((o) => o.optionId);
      if (choice.prompt.kind === "chooseOption")
        return choice.options
          .filter((o) => o.label.includes(choose))
          .map((o) => o.optionId)
          .slice(0, 1);
      return firstLegal(s);
    };
    const bottom = reveal(conjured.state, pick("bottom"));
    expect(of(bottom.events, "cardsLookedAt")).toHaveLength(1);
    expect(showDeckCodes(bottom.state)).toEqual([WESTERN_SHOW, CORNERED_TREACHERY, RUNNER]);
    const top = reveal(conjured.state, pick("top"));
    expect(showDeckCodes(top.state)).toEqual([...INERT_DECK]);
  });

  it("ESCAPED: declining the spend (or having no [mental] resource) looks at nothing", () => {
    const base = showGame(...INERT_DECK);
    const noMental = reveal(base);
    expect(of(noMental.events, "cardsLookedAt")).toEqual([]);
    expect(showDeckCodes(noMental.state)).toEqual([...INERT_DECK]);
    expect(teleport(noMental.state)).toBe(0);
  });
});

describe("The Show Must Go On (39020)", () => {
  /** The encounter set of a printed card id, read from the card pool. */
  const setOf = (state: GameState, code: string) =>
    (state.cardPool[cardId(code)] as { encounterSetIds?: string[] }).encounterSetIds?.[0];
  /**
   * The dealt card is turned faceup at once: it is dealt during the reveal step, and the reveal step goes on to reveal
   * every card dealt to a player. So it shows up as a later `encounterCardRevealed` of the same set as the SHOW.
   */
  const revealedOfSet = (state: GameState, events: readonly GameEvent[], set: string) =>
    of(events, "encounterCardRevealed").filter((e) => setOf(state, e.cardId as string) === set);

  it("each player deals themself a card of the current SHOW environment's set (Dial M: Crime) and shuffles", () => {
    const base = heroForm({}, DIAL_M);
    const { state, events } = villainPhase(base, [FILLER], SHOW_MUST_GO_ON, []);
    expect(revealedCodes(events)[0]).toBe(SHOW_MUST_GO_ON);
    const crime = revealedOfSet(state, events, "crime");
    expect(crime).toHaveLength(1);
    expect(crime[0]!.playerId).toBe(P1);
    expect(of(events, "deckShuffled").some((e) => e.zone.kind === "encounterDeck")).toBe(true);
  });

  it("with Mojo Runner in play it is a Sci-Fi card instead", () => {
    const base = heroForm({}, RUNNER);
    const { state, events } = villainPhase(base, [FILLER], SHOW_MUST_GO_ON, []);
    expect(revealedOfSet(state, events, "sci-fi")).toHaveLength(1);
    expect(revealedOfSet(state, events, "crime")).toHaveLength(0);
  });

  it("two players: each is dealt one of the set, a different card each", () => {
    const base = heroForm({ players: TWO }, DIAL_M);
    const { state, events } = villainPhase(base, [FILLER, FILLER], SHOW_MUST_GO_ON, [FILLER_2]);
    const crime = revealedOfSet(state, events, "crime");
    expect(crime.map((e) => e.playerId).sort()).toEqual([P1, P2]);
    expect(new Set(crime.map((e) => e.cardId)).size).toBe(2);
  });

  it("searches the discard pile as well as the deck", () => {
    const base = heroForm({}, DIAL_M);
    const deck = activeEncounterDeck(base);
    const crime = deck.deck.filter((id) => setOf(base, codeOf(base, id)) === "crime");
    expect(crime.length).toBeGreaterThan(0);
    const moved = {
      ...base,
      encounterDecks: {
        ...base.encounterDecks,
        e1: { deck: deck.deck.filter((id) => !crime.includes(id)), discard: [...deck.discard, ...crime] },
      },
    };
    const { state, events } = villainPhase(moved, [FILLER], SHOW_MUST_GO_ON, []);
    expect(revealedOfSet(state, events, "crime")).toHaveLength(1);
  });
});

describe("Across the Mojoverse 1B", () => {
  it("39015b: if the main scheme's stage is completed, the players lose the game", () => {
    const base = heroForm();
    const full = patchInstance(base, base.mainScheme.instanceId, { threat: 15 });
    const { state } = villainPhase(full, [FILLER], SOLDIER);
    expect(state.outcome?.result).toBe("loss");
  });

  it("39015b.across-the-mojoverse-forced-interrupt: a SHOW environment that would be discarded goes to the bottom of the show deck", () => {
    // Dial M is discarded by the next SHOW environment revealed (Wild Wild Mojo, from the show deck).
    const base = showGame(WESTERN_SHOW, RUNNER, CORNERED_TREACHERY);
    const staged = patchInstance(base, searchOf(base), { threat: 1 });
    const { state } = thwart(staged, searchOf(staged));
    expect(showInPlay(state).map((id) => codeOf(state, id))).toEqual([WESTERN_SHOW]);
    expect(showDeckCodes(state).at(-1)).toBe(DIAL_M);
    expect(activeEncounterDeck(state).discard.map((id) => codeOf(state, id))).not.toContain(DIAL_M);
  });
});

describe("Cornered! revealed from the encounter deck", () => {
  /** Surgery: Cornered! leaves the show deck for the encounter deck (it can only be revealed from there to be canceled). */
  const cornered = (state: GameState): GameState => {
    const id = state.scenarioDecks["show"]!.deck.find((i) => codeOf(state, i) === CORNERED_TREACHERY)!;
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const piles = state.encounterDecks[deckId]!;
    return {
      ...state,
      scenarioDecks: {
        ...state.scenarioDecks,
        show: { ...state.scenarioDecks["show"]!, deck: state.scenarioDecks["show"]!.deck.filter((i) => i !== id) },
      },
      encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [id, ...piles.deck] } },
    };
  };
  /** Whether Enhanced Spider-Sense ("cancel its When Revealed effects") was offered while `code` was revealed. */
  const cancelOffered = (code: string, prepare: (s: GameState) => GameState = (s) => s) => {
    const base = prepare(heroForm());
    const conjured = conjure(base, [SPIDER_SENSE]);
    let offered = false;
    const { state } = villainPhase(conjured.state, [FILLER], code, [], (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTriggers" && choice.options.some((o) => o.label.includes("Spider-Sense")))
        offered = true;
      return choice.prompt.kind === "discardDownToHandSize" ? [choice.options.at(-1)!.optionId] : firstLegal(s);
    });
    return { offered, state };
  };

  it("control: Erratic Teleportation's When Revealed can be canceled (the interrupt is offered)", () => {
    expect(cancelOffered(TELEPORT).offered).toBe(true);
  });

  it("39017.when-revealed: This effect cannot be canceled: the interrupt is not offered and Spiral flips", () => {
    const { offered, state } = cancelOffered(CORNERED_TREACHERY, cornered);
    expect(offered).toBe(false);
    expect(side(state)).toBe("B");
    expect(showDeckCodes(state)).toContain(CORNERED_TREACHERY);
  });
});

describe("a show-deck card discarded with no replacement applying goes to the encounter discard pile (the owner's decision, Q54; no rule covers it, MojoMania insert p. 11)", () => {
  // No printed card reaches this today: Cornered! and the SHOW environments leave the show deck only by being revealed,
  // Cornered! then shuffles itself back in, and Across the Mojoverse 1B (the scenario's only stage) replaces every
  // discard of a SHOW environment from play. So the route is staged by surgery: a show-deck card on top of the encounter
  // deck, dealt to Spiral as a boost card and discarded with the rest of her boost cards, which no card text replaces.
  const onEncounterDeck = (state: GameState, code: string): { state: GameState; id: InstanceId } => {
    const show = state.scenarioDecks["show"]!;
    const id = show.deck.find((i) => codeOf(state, i) === code)!;
    const deckId = Object.keys(state.encounterDecks)[0]!;
    const piles = state.encounterDecks[deckId]!;
    return {
      id,
      state: {
        ...state,
        scenarioDecks: { ...state.scenarioDecks, show: { ...show, deck: show.deck.filter((i) => i !== id) } },
        encounterDecks: { ...state.encounterDecks, [deckId]: { ...piles, deck: [id, ...piles.deck] } },
      },
    };
  };

  it.each([
    ["Cornered! (39017)", CORNERED_TREACHERY],
    ["a SHOW environment (Mojo Runner, 39053), discarded from outside play so that 1B does not apply", RUNNER],
  ])("%s dealt as a boost card is discarded to the encounter discard pile, not to the show deck", (_label, code) => {
    const base = showGame(...INERT_DECK);
    const staged = onEncounterDeck(base, code);
    expect(inst(staged.state, staged.id).home).toEqual({ kind: "scenarioDeck", name: "show" });
    const { state, events } = villainPhase(staged.state, [code], FILLER);
    expect(of(events, "boostCardDealt").map((e) => e.instanceId)).toContain(staged.id);
    expect(activeEncounterDeck(state).discard).toContain(staged.id);
    expect(inst(state, staged.id).faceup).toBe(true);
    expect(showDeckCodes(state)).not.toContain(code);
    expect(state.scenarioDecks["show"]!.discard).toEqual([]);
    expect(
      of(events, "cardMoved")
        .filter((e) => e.instanceId === staged.id)
        .map((e) => e.to.kind)
        .at(-1),
    ).toBe("encounterDiscard");
  });

  it("1B still replaces the discard of a SHOW environment from play: bottom of the show deck, never the discard pile", () => {
    const base = showGame(...INERT_DECK);
    const { state } = thwart(patchInstance(base, searchOf(base), { threat: 1 }), searchOf(base));
    expect(showDeckCodes(state).at(-1)).toBe(DIAL_M);
    expect(inEncounterPiles(state, DIAL_M)).toEqual([]);
  });
});
