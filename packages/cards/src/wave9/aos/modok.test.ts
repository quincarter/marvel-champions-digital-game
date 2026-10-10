import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  cardsInPlay,
  createGame,
  applyCommand,
  hasKeyword,
  isCaptiveAlly,
  keywordsOf,
  legalActions,
  maxHitPoints,
  remainingHitPoints,
  statBonus,
  traitsOf,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { abilityRefIds } from "../../ability-refs.js";
import { mergeRegistries } from "../../dsl/index.js";
import { validateDefinition } from "../../dsl/validate.js";
import {
  P1,
  P2,
  endTurn,
  firstLegal,
  identityOf,
  inst,
  patchInstance,
  playerOf,
  settle,
  stackEncounterDeck,
  use,
  type Picker,
} from "../../testing/harness.js";
import {
  defeatWithAttack,
  driveEventsPicking,
  encounterCardInVillainArea,
  playFromHand,
  withForm,
} from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import {
  BLANK,
  IRON_MAN,
  ONE_ICON,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  dataOf,
  heroAttacks,
  heroThwarts,
  onlyDeck,
  picking,
  piles,
  schemesBy,
  types,
} from "../testing.js";
import { wave9Scenario } from "../setup.js";
import { MODOK, MODOK_SKIPPED } from "./modok.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * M.O.D.O.K. (docs/phase7-wave9.md sections 2.4, 3.5, 3.6, 3.13, 3.15, 3.17 to 3.20, 3.25, 3.33): the villain 50103a/b,
 * the main scheme 50104a/b, the four Holding Cells 50105a to 50108a with their allies 50105b to 50108b, the Adaptoid
 * upgrades 50109 to 50112 and the Adaptoid 50113; then the second half: the attachments 50114 to 50119, A.I.M. Jailer
 * 50120, Hostage Situation 50121, Psionic Enhancement 50122, "It's Alive!" 50123 and Psionic Blast 50124. The real `modok` scenario (Spider-Man and Iron Man preconstructed decks from
 * Core), every seat in hero form.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, MODOK) };
const SEATS = [SPIDER_MAN, IRON_MAN] as const;
const REGISTERED = [
  "50103a.modok-forced-interrupt",
  "50103b.modok-forced-interrupt",
  "50104a.setup",
  "50104b.upgrading-adaptoids-forced-interrupt",
  "50105a.holding-cell-constant",
  "50105a.holding-cell-forced-interrupt",
  "50105a.holding-cell-action",
  "50105b.flying-inhuman-constant",
  "50105b.flying-inhuman-response",
  "50105b.flying-inhuman-forced-response",
  "50106a.holding-cell-constant",
  "50106a.holding-cell-forced-interrupt",
  "50106a.holding-cell-action",
  "50106b.psionic-inhuman-constant",
  "50106b.psionic-inhuman-response",
  "50106b.psionic-inhuman-forced-response",
  "50107a.holding-cell-constant",
  "50107a.holding-cell-forced-interrupt",
  "50107a.holding-cell-action",
  "50107b.sarah-garza-constant",
  "50107b.sarah-garza-constant-2",
  "50107b.sarah-garza-forced-response",
  "50108a.holding-cell-constant",
  "50108a.holding-cell-forced-interrupt",
  "50108a.holding-cell-action",
  "50108b.strong-inhuman-constant",
  "50108b.strong-inhuman-forced-response",
  "50109.flying-upgrade-constant",
  "50110.psionic-upgrade-constant",
  "50111.sarah-garza-upgrade-constant",
  "50111.sarah-garza-upgrade-constant-2",
  "50112.strong-upgrade-constant",
  "50113.when-defeated",
  "50113.boost",
  "50114.automated-mobile-unit-constant",
  "50114.automated-mobile-unit-forced-response",
  "50115.focusing-crystal-forced-response",
  "50116.nanobots-forced-response",
  "50116.nanobots-forced-response-2",
  "50117.psionic-force-field-constant",
  "50117.psionic-force-field-forced-interrupt",
  "50117.boost",
  "50118.psionic-machetes-constant",
  "50118.psionic-machetes-forced-response",
  "50118.boost",
  "50119.reverse-engineering-constant",
  "50119.when-revealed",
  "50119.reverse-engineering-forced-response",
  "50120.when-revealed",
  "50121.hostage-situation-constant",
  "50121.when-revealed",
  "50121.when-defeated",
  "50122.boost",
  "50123.when-revealed",
  "50124.when-revealed-alter-ego",
  "50124.when-revealed-hero",
];
const CELL_CODES = ["50105a", "50106a", "50107a", "50108a"] as const;
const DECK = "Holding Cell";

type Mode = "standard" | "expert";

/** The scenario past setup, every seat in hero form. `seed` varies the shuffle (which cell is on top, which upgrade). */
function game(players = 2, mode: Mode = "standard", seed = 1): GameState {
  const config = wave9Scenario("modok", { players: SEATS.slice(0, players), seed, difficulty: mode });
  const created = createGame(config, DEPS);
  if (!created.ok) throw new Error(created.error.message);
  let state = settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
  for (let p = 0; p < players; p++) state = withForm(state, { heroForm: 0 }, state.players[p]!.playerId);
  return state;
}
/** A game whose top Holding Cell is `code` (the first seed that shuffles it there). */
function gameWithCell(code: string, players = 2, mode: Mode = "standard"): GameState {
  for (let seed = 1; seed < 60; seed++) {
    const s = game(players, mode, seed);
    if (codeOf(s, cellOf(s)) === code) return s;
  }
  throw new Error(`no seed puts ${code} on top`);
}
const cellOf = (s: GameState): InstanceId => s.scenarioDecks[DECK]!.inPlayTopId!;
const deckOf = (s: GameState): readonly InstanceId[] => s.scenarioDecks[DECK]!.deck;
const lock = (s: GameState, id: InstanceId): number => inst(s, id).counters.lock ?? 0;
const villainOf = (s: GameState): InstanceId => s.villains[0]!.instanceId;
const inPlayIds = (s: GameState): InstanceId[] =>
  Object.keys(s.instances).filter(
    (i) => s.players.some((p) => p.playArea.includes(i as InstanceId)) || s.villainArea.includes(i as InstanceId),
  ) as InstanceId[];
const inPlayCodes = (s: GameState, code: string): InstanceId[] => inPlayIds(s).filter((i) => codeOf(s, i) === code);
const ready = (s: GameState): GameState => ({
  ...s,
  instances: Object.fromEntries(Object.entries(s.instances).map(([k, v]) => [k, { ...v, exhausted: false }])) as never,
});
const stageOf = (s: GameState) => s.mainScheme.stageIndex;
/** Every player ends their turn and the villain phase runs; `stack` is the encounter deck's top, first card first. */
const villainPhase = (s: GameState, pick: Picker = firstLegal, ...stack: string[]) =>
  driveEventsPicking(
    DEPS,
    stack.length > 0 ? stackEncounterDeck(s, ...stack) : s,
    pick,
    ...s.players.map((p) => endTurn(p.playerId)),
  );

describe("registry", () => {
  it("registers every ref of the module's 26 cards, each a valid definition; nothing is skipped", () => {
    expect(Object.keys(MODOK).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(MODOK)) expect(validateDefinition(def), id).toEqual([]);
    expect(Object.keys(MODOK_SKIPPED)).toEqual([]);
  });

  it("the data names exactly the registered refs for the module's cards", () => {
    const ids = AOS_CARDS.filter((c) => /^5010[3-9]|^5011[0-9]|^5012[0-4]/.test(c.id)).map((c) => c.id);
    const refs = ids.flatMap((id) => abilityRefIds(AOS_CARDS.find((c) => c.id === id)!));
    expect([...new Set(refs)].sort()).toEqual([...REGISTERED, ...Object.keys(MODOK_SKIPPED)].sort());
  });
});

// --- helpers for the scenarios below -----------------------------------------------------------------------------

/** Answers "choose a player" with `player`; every other prompt as `firstLegal` does. */
const choosing =
  (player: PlayerId): Picker =>
  (s) => {
    const option = s.pendingChoice!.options.find((o) => o.ref.kind === "player" && o.ref.playerId === player);
    return option ? [option.optionId] : firstLegal(s);
  };
/** Declares `ally` as the defender whenever offered; any other prompt as `firstLegal`. */
const defendingWith =
  (ally: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") {
      const option = choice.options.find((o) => o.ref.kind === "card" && o.ref.instanceId === ally);
      return option ? [option.optionId] : ["decline"];
    }
    return firstLegal(s);
  };
/** Takes every optional response offered (a card's "Response:"); a target prompt is answered with `target` if given. */
const accepting =
  (target?: InstanceId): Picker =>
  (s) => {
    const choice = s.pendingChoice!;
    if (choice.prompt.kind === "declareDefender") return ["decline"];
    if (choice.prompt.kind === "chooseTarget") return target ? picking(target)(s) : firstLegal(s);
    const take = choice.options.find((o) => o.optionId !== "decline");
    return take ? [take.optionId] : firstLegal(s);
  };
const attackOn = (state: GameState, attacker: InstanceId, target: InstanceId, player: PlayerId = P1) => ({
  type: "basicAttack" as const,
  playerId: player,
  attackerInstanceId: attacker,
  targetInstanceId: target,
});

/** `n` cards from the player's hand or deck whose only resource icon is `icon` (a single one), moved to hand. */
function withIcons(
  state: GameState,
  player: PlayerId,
  icon: "energy" | "mental" | "physical" | "wild",
  n: number,
): { readonly state: GameState; readonly ids: readonly InstanceId[] } {
  const owner = playerOf(state, player);
  const found: InstanceId[] = [];
  for (const id of [...owner.hand, ...owner.deck, ...owner.discard]) {
    const card = CORE_CARDS.find((c) => c.id === codeOf(state, id)) as
      | { resourceIcons?: Record<string, number> }
      | undefined;
    const icons = card?.resourceIcons ?? {};
    const total = Object.values(icons).reduce((a, b) => a + b, 0);
    if (total === 1 && icons[icon] === 1) found.push(id);
    if (found.length === n) break;
  }
  // A [wild] resource: neither starter deck holds one, so a deck card is swapped for Core's Spider-Woman (01011).
  if (found.length < n && icon === "wild") {
    for (const id of owner.deck) {
      if (found.length === n) break;
      found.push(id);
    }
    state = found.reduce((acc, id) => patchInstance(acc, id, { cardId: "01011" as never }), state);
  }
  if (found.length < n) throw new Error(`${player} has fewer than ${n} ${icon} cards`);
  return {
    ids: found,
    state: {
      ...state,
      players: state.players.map((p) =>
        p.playerId === player
          ? {
              ...p,
              hand: [...p.hand.filter((i) => !found.includes(i)), ...found],
              deck: p.deck.filter((i) => !found.includes(i)),
              discard: p.discard.filter((i) => !found.includes(i)),
            }
          : p,
      ),
    },
  };
}
const fromHand = (ids: readonly InstanceId[]) => ids.map((id) => ({ fromHand: id }));

/** Puts exactly `codes` of the four Adaptoid upgrade environments into play; the others back in the set-aside area. */
function withUpgrades(state: GameState, ...codes: readonly string[]): GameState {
  const all = ["50109", "50110", "50111", "50112"];
  const idsOf = (code: string) =>
    Object.keys(state.instances).filter((i) => codeOf(state, i as InstanceId) === code) as InstanceId[];
  const wanted = new Set(codes.flatMap(idsOf));
  const every = new Set(all.flatMap(idsOf));
  return {
    ...state,
    villainArea: [...state.villainArea.filter((i) => !every.has(i)), ...wanted],
    encounterSetAside: [
      ...state.encounterSetAside.filter((i) => !every.has(i)),
      ...[...every].filter((i) => !wanted.has(i)),
    ],
  };
}
const upgradesInPlay = (s: GameState) =>
  s.villainArea.map((i) => codeOf(s, i)).filter((c) => /^5011[0-2]$|^50109$/.test(c));
const setAsideUpgrades = (s: GameState) =>
  s.encounterSetAside.map((i) => codeOf(s, i)).filter((c) => /^5011[0-2]$|^50109$/.test(c));
/** The first Adaptoid in play. */
const adaptoids = (s: GameState) => inPlayCodes(s, "50113");

describe("M.O.D.O.K. data (50103a/b)", () => {
  const stages = () =>
    (
      dataOf("50103a").sides as {
        stages: {
          atk: number;
          sch: number;
          hp: { base: number; perPlayer: number };
          keywords: { name: string; value?: number }[];
        }[];
      }[]
    )[0]!.stages;
  it("(A): ATK 1, SCH 2, 10 hit points not per player, retaliate 1; (B): ATK 1, SCH 3, 14, retaliate 2 and steady", () => {
    const [a, b] = stages();
    expect([a!.atk, a!.sch, a!.hp, a!.keywords]).toEqual([
      1,
      2,
      { base: 10, perPlayer: 0 },
      [{ name: "retaliate", value: 1 }],
    ]);
    expect([b!.atk, b!.sch, b!.hp, b!.keywords]).toEqual([
      1,
      3,
      { base: 14, perPlayer: 0 },
      [{ name: "retaliate", value: 2 }, { name: "steady" }],
    ]);
  });

  it("standard: (A) with 10 hit points at one and two players; expert: (B) with 14 and steady", () => {
    for (const players of [1, 2]) {
      const std = game(players);
      expect(codeOf(std, villainOf(std))).toBe("50103a");
      expect(maxHitPoints(std, villainOf(std), DEPS)).toBe(10);
      expect(hasKeyword(std, villainOf(std), "retaliate", DEPS)).toBe(true);
      expect(hasKeyword(std, villainOf(std), "steady", DEPS)).toBe(false);
      const exp = game(players, "expert");
      expect(std.villains[0]!.stageIndex).toBe(0);
      expect(exp.villains[0]!.stageIndex).toBe(1);
      expect(maxHitPoints(exp, villainOf(exp), DEPS)).toBe(14);
      expect(hasKeyword(exp, villainOf(exp), "steady", DEPS)).toBe(true);
    }
  });

  it("retaliate 1 (A) / 2 (B): a basic attack on him costs the attacking hero that much damage", () => {
    for (const [mode, expected] of [
      ["standard", 1],
      ["expert", 2],
    ] as const) {
      const s = game(2, mode);
      const { state } = heroAttacks(DEPS, s, villainOf(s));
      expect(inst(state, identityOf(state, P1)).damage).toBe(expected);
    }
  });
});

describe("M.O.D.O.K.'s Forced Interrupt: would be defeated", () => {
  it("(A) a cell in play with 4 lock counters (two players): 2 left, hit points reset to 10, never defeated", () => {
    const s = game(2);
    const cell = cellOf(s);
    expect(lock(s, cell)).toBe(4);
    const state = defeatWithAttack(DEPS, patchInstance(s, villainOf(s), { damage: 6 }), villainOf(s));
    expect(lock(state, cell)).toBe(2);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(10);
    expect(state.villains[0]!.defeated).toBe(false);
    expect(state.villains[0]!.stageIndex).toBe(0);
    expect(state.outcome).toBeNull();
    expect(codeOf(state, cellOf(state))).toBe(codeOf(s, cell));
  });

  it("(B) expert resets to 14 and removes 2 lock counters the same way", () => {
    const s = game(2, "expert");
    const state = defeatWithAttack(DEPS, s, villainOf(s));
    expect(lock(state, cellOf(s))).toBe(2);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(14);
    expect(state.villains[0]!.defeated).toBe(false);
    expect(state.outcome).toBeNull();
  });

  it("one player: the cell holds 2 lock counters, so the first interrupt removes both and frees it", () => {
    const s = game(1);
    const cell = cellOf(s);
    expect(lock(s, cell)).toBe(2);
    const state = defeatWithAttack(DEPS, s, villainOf(s));
    expect(codeOf(state, cell)).toBe(codeOf(s, cell).replace("a", "b"));
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(10);
    expect(lock(state, cellOf(state))).toBe(2);
  });

  it("nothing defeat-related happens: no characterDefeated for the villain, no stage change", () => {
    const s = game(2);
    const staged = patchInstance(s, villainOf(s), { damage: 9 });
    const { state, events } = heroAttacks(DEPS, staged, villainOf(s));
    expect(types(events, "characterDefeated").filter((e) => e.instanceId === villainOf(s))).toEqual([]);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(lock(state, cellOf(s))).toBe(2);
  });

  it("the last lock counter (2 asked, 1 left): it goes, the cell flips to its ally, the next cell enters with 4, hit points 10", () => {
    const s = game(2);
    const cell = cellOf(s);
    const staged = patchInstance(s, cell, { counters: { lock: 1 } });
    const state = defeatWithAttack(DEPS, staged, villainOf(s));
    expect(codeOf(state, cell)).toBe(codeOf(s, cell).replace("a", "b"));
    expect(inPlayCodes(state, codeOf(state, cell))).toEqual([cell]);
    expect(inst(state, cell).controllerId).toBe(P1);
    const next = cellOf(state);
    expect(next).not.toBe(cell);
    expect(lock(state, next)).toBe(4);
    expect(deckOf(state)).toHaveLength(2);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(10);
    expect(state.outcome).toBeNull();
  });

  it("with no Holding Cell in play (all four freed) the defeat stands and the players win; hit points are not reset", () => {
    let state = game(2);
    for (let freed = 0; freed < 4; freed++) {
      state = defeatWithAttack(
        DEPS,
        ready(patchInstance(state, cellOf(state), { counters: { lock: 2 } })),
        villainOf(state),
      );
      expect(state.outcome).toBeNull();
    }
    expect(state.scenarioDecks[DECK]!.inPlayTopId).toBeUndefined();
    expect(deckOf(state)).toHaveLength(0);
    expect(["50105b", "50106b", "50107b", "50108b"].map((c) => inPlayCodes(state, c).length)).toEqual([1, 1, 1, 1]);
    const won = defeatWithAttack(DEPS, ready(state), villainOf(state));
    expect(won.outcome).toMatchObject({ result: "win" });
  });
});

/**
 * The stage completes in the villain phase's threat step (threat is placed there, which is when completion is checked):
 * the threat staged one acceleration short of the target, the villain stunned (his activation then places nothing), every
 * Adaptoid in play moved to the encounter discard pile. The cards dealt afterwards come off the reshuffled deck.
 */
function completeStage(state: GameState): GameState {
  const main = state.mainScheme.instanceId;
  const players = state.startingPlayerCount;
  const gone = new Set(adaptoids(state));
  const pile = piles(state);
  let staged: GameState = {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !gone.has(i)) })),
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck, discard: [...pile.discard, ...gone] },
    },
  };
  staged = patchInstance(staged, main, { threat: players * 7 - players });
  staged = patchInstance(staged, villainOf(staged), { statuses: { stunned: 1, confused: 0, tough: 0 } });
  return villainPhase(staged).state;
}

describe("Upgrading Adaptoids (50104a/b), stage 1", () => {
  it("data: 1 per player start, 7 per player target, +1 per player acceleration", () => {
    const stage1 = (dataOf("50104a") as unknown as { stages: Record<string, unknown>[] }).stages[0]!;
    expect(stage1.startingThreat).toEqual({ base: 0, perPlayer: 1 });
    expect(stage1.targetThreat).toEqual({ base: 0, perPlayer: 7 });
    expect(stage1.acceleration).toEqual({ base: 0, perPlayer: 1 });
  });

  it("setup (standard): threat 1 / 2, one cell in play with 2 per player lock counters, three under it", () => {
    for (const [players, threat, locks] of [
      [1, 1, 2],
      [2, 2, 4],
    ] as const) {
      const s = game(players);
      expect(inst(s, s.mainScheme.instanceId).threat).toBe(threat);
      expect(s.scenarioDecks[DECK]!.contents.cardIds).toHaveLength(4);
      expect(CELL_CODES).toContain(codeOf(s, cellOf(s)));
      expect(lock(s, cellOf(s))).toBe(locks);
      expect(deckOf(s)).toHaveLength(3);
      // The three under it are out of play and hold no counters.
      for (const id of deckOf(s)) {
        expect(inPlayIds(s)).not.toContain(id);
        expect(lock(s, id)).toBe(0);
      }
      // The deck and the in-play cell are four different cards.
      expect(new Set([...deckOf(s), cellOf(s)].map((i) => codeOf(s, i)))).toEqual(new Set(CELL_CODES));
    }
  });

  it("setup: one random Adaptoid environment in play (two in expert), the others set aside, in no deck", () => {
    for (const [mode, inPlayCount] of [
      ["standard", 1],
      ["expert", 2],
    ] as const) {
      for (const players of [1, 2]) {
        const s = game(players, mode);
        expect(upgradesInPlay(s)).toHaveLength(inPlayCount);
        expect(setAsideUpgrades(s)).toHaveLength(4 - inPlayCount);
        expect(new Set([...upgradesInPlay(s), ...setAsideUpgrades(s)]).size).toBe(4);
        const pile = piles(s);
        for (const id of [...pile.deck, ...pile.discard]) expect(codeOf(s, id)).not.toMatch(/^5011[0-2]$|^50109$/);
      }
    }
  });

  it("setup: the upgrade is random: different seeds put different upgrades into play", () => {
    const seen = new Set<string>();
    for (let seed = 1; seed <= 12; seed++) for (const c of upgradesInPlay(game(1, "standard", seed))) seen.add(c);
    expect(seen.size).toBeGreaterThan(1);
  });

  it("setup: each player reveals one Adaptoid, engaged with them; the other copies stay in the encounter deck", () => {
    for (const players of [1, 2]) {
      const s = game(players);
      expect(adaptoids(s)).toHaveLength(players);
      expect(s.players.map((p) => p.playArea.filter((i) => codeOf(s, i) === "50113").length)).toEqual(
        Array.from({ length: players }, () => 1),
      );
      expect(piles(s).deck.filter((i) => codeOf(s, i) === "50113")).toHaveLength(4 - players);
    }
  });

  it("completion is replaced: at 14 (two players) an upgrade enters, the threat goes to 0 and the Adaptoids in the discard pile are shuffled into the deck", () => {
    const s0 = game(2);
    const staged = s0;
    const before = upgradesInPlay(staged);
    const state = completeStage(staged);
    expect(upgradesInPlay(state)).toHaveLength(before.length + 1);
    expect(setAsideUpgrades(state)).toHaveLength(2);
    expect(stageOf(state)).toBe(0);
    expect(state.outcome).toBeNull();
    // The stage was staged at 12 of 14 and the villain phase placed 2: completed, every token removed. The villain was
    // stunned and no minion was in play, so nothing placed threat on the new stage.
    expect(inst(state, state.mainScheme.instanceId).threat).toBe(0);
    // The two Adaptoids that were in the discard pile are back in the deck (or were dealt from it); none stays discarded.
    expect(piles(state).discard.filter((i) => codeOf(state, i) === "50113")).toEqual([]);
    const total = piles(state).deck.filter((i) => codeOf(state, i) === "50113").length + adaptoids(state).length;
    expect(total).toBe(4);
  });

  it("the third completion in standard mode (none set aside afterwards) loses the game; the first two do not", () => {
    let state = game(1);
    const results: (string | null)[] = [];
    for (let completion = 1; completion <= 3; completion++) {
      state = completeStage(state);
      results.push(state.outcome ? state.outcome.result : null);
      expect(upgradesInPlay(state).length).toBe(1 + completion);
    }
    expect(results).toEqual([null, null, "loss"]);
    expect(setAsideUpgrades(state)).toEqual([]);
  });

  it("expert: the second completion loses (two start in play, two set aside)", () => {
    let state = game(1, "expert");
    const results: (string | null)[] = [];
    for (let completion = 1; completion <= 2; completion++) {
      state = completeStage(state);
      results.push(state.outcome ? state.outcome.result : null);
    }
    expect(results).toEqual([null, "loss"]);
  });
});

const ALLY_OF: Record<string, string> = {
  "50105a": "50105b",
  "50106a": "50106b",
  "50107a": "50107b",
  "50108a": "50108b",
};
const ICON_OF: Record<string, "energy" | "mental" | "wild" | "physical"> = {
  "50105a": "energy",
  "50106a": "mental",
  "50107a": "wild",
  "50108a": "physical",
};
const ACTION_OF = (code: string) => `${code}.holding-cell-action`;

describe("Holding Cells (50105a to 50108a)", () => {
  it("data: each is an environment with the lock counter type defined, and flips to its ally", () => {
    for (const code of CELL_CODES) {
      const card = dataOf(code) as unknown as { type: string; definedCounterTypes: string[]; otherFaceId: string };
      expect(card.type).toBe("environment");
      expect(card.definedCounterTypes).toEqual(["lock"]);
      expect(card.otherFaceId).toBe(ALLY_OF[code]);
    }
  });

  it("enters play with 2 per player lock counters: 2 at one player, 4 at two, 8 at four", () => {
    expect(lock(game(1), cellOf(game(1)))).toBe(2);
    expect(lock(game(2), cellOf(game(2)))).toBe(4);
  });

  it("each cell's Hero Action, branch 0: spends its two icons (or a wild) -> 1 lock counter off (4 -> 3)", () => {
    for (const code of CELL_CODES) {
      const s = gameWithCell(code);
      const cell = cellOf(s);
      const icon = ICON_OF[code]!;
      const paid = withIcons(s, P1, icon, icon === "wild" ? 1 : 2);
      const { state } = driveEventsPicking(
        DEPS,
        paid.state,
        firstLegal,
        use(P1, cell, ACTION_OF(code), fromHand(paid.ids), undefined, { branch: 0 }),
      );
      expect(lock(state, cell), code).toBe(3);
      for (const id of paid.ids) expect(playerOf(state, P1).hand).not.toContain(id);
      for (const id of paid.ids) expect(playerOf(state, P1).discard).toContain(id);
    }
  });

  it("each cell's Hero Action, branch 1: spends 3 resources of any type -> 1 lock counter off", () => {
    for (const code of CELL_CODES) {
      const s = gameWithCell(code);
      const cell = cellOf(s);
      const paid = withIcons(s, P1, "physical", 3);
      const { state } = driveEventsPicking(
        DEPS,
        paid.state,
        firstLegal,
        use(P1, cell, ACTION_OF(code), fromHand(paid.ids), undefined, { branch: 1 }),
      );
      expect(lock(state, cell), code).toBe(3);
    }
  });

  it("the wrong resources are refused: one energy for Flying's two, two cards for the three of any type", () => {
    const s = gameWithCell("50105a");
    const cell = cellOf(s);
    const one = withIcons(s, P1, "energy", 1);
    expect(() =>
      driveEventsPicking(
        DEPS,
        one.state,
        firstLegal,
        use(P1, cell, ACTION_OF("50105a"), fromHand(one.ids), undefined, { branch: 0 }),
      ),
    ).toThrow();
    const two = withIcons(s, P1, "physical", 2);
    expect(() =>
      driveEventsPicking(
        DEPS,
        two.state,
        firstLegal,
        use(P1, cell, ACTION_OF("50105a"), fromHand(two.ids), undefined, { branch: 1 }),
      ),
    ).toThrow();
    const mental = withIcons(s, P1, "mental", 2);
    expect(() =>
      driveEventsPicking(
        DEPS,
        mental.state,
        firstLegal,
        use(P1, cell, ACTION_OF("50105a"), fromHand(mental.ids), undefined, { branch: 0 }),
      ),
    ).toThrow();
  });

  it("Sarah Garza's cell asks for a wild resource: an energy card alone is refused", () => {
    const s = gameWithCell("50107a");
    const energy = withIcons(s, P1, "energy", 1);
    expect(() =>
      driveEventsPicking(
        DEPS,
        energy.state,
        firstLegal,
        use(P1, cellOf(s), ACTION_OF("50107a"), fromHand(energy.ids), undefined, { branch: 0 }),
      ),
    ).toThrow();
  });

  it("the last lock counter: the first player's choice of player controls the ally (ready), the cell is out of the deck, the next one comes up with 4", () => {
    for (const code of CELL_CODES) {
      for (const freer of [P1, P2]) {
        const s = gameWithCell(code);
        const cell = cellOf(s);
        const icon = ICON_OF[code]!;
        const paid = withIcons(patchInstance(s, cell, { counters: { lock: 1 } }), P1, icon, icon === "wild" ? 1 : 2);
        const { state } = driveEventsPicking(
          DEPS,
          paid.state,
          choosing(freer),
          use(P1, cell, ACTION_OF(code), fromHand(paid.ids), undefined, { branch: 0 }),
        );
        expect(codeOf(state, cell), code).toBe(ALLY_OF[code]);
        expect(inst(state, cell).controllerId).toBe(freer);
        expect(playerOf(state, freer).playArea).toContain(cell);
        expect(inst(state, cell).exhausted).toBe(false);
        expect(inst(state, cell).counters).toEqual({});
        expect(deckOf(state)).not.toContain(cell);
        expect(deckOf(state)).toHaveLength(2);
        const next = cellOf(state);
        expect(next).not.toBe(cell);
        expect(lock(state, next)).toBe(4);
        expect(CELL_CODES).toContain(codeOf(state, next));
      }
    }
  });

  it("the next cell is not revealed: its printed text only places its counters (no extra effect, no second set)", () => {
    const s = gameWithCell("50105a");
    const cell = cellOf(s);
    const state = defeatWithAttack(DEPS, patchInstance(s, cell, { counters: { lock: 1 } }), villainOf(s));
    expect(lock(state, cellOf(state))).toBe(4);
    expect(inPlayIds(state).filter((i) => CELL_CODES.includes(codeOf(state, i) as never))).toEqual([cellOf(state)]);
  });
});

/** The top cell freed through M.O.D.O.K.'s own interrupt (2 lock counters left, a killing blow): the ally goes to `freer`. */
function freeTopCell(state: GameState, freer: PlayerId = P1): { readonly state: GameState; readonly ally: InstanceId } {
  const cell = cellOf(state);
  const staged = ready(
    patchInstance(patchInstance(state, cell, { counters: { lock: 2 } }), villainOf(state), { damage: 999 }),
  );
  const { state: next } = driveEventsPicking(
    DEPS,
    staged,
    choosing(freer),
    attackOn(staged, identityOf(staged, P1), villainOf(staged)),
  );
  return { state: next, ally: cell };
}
/** Every cell freed, the allies split by `freer`. */
function allFreed(freer: PlayerId = P1): GameState {
  let state = game(2);
  for (let i = 0; i < 4; i++) state = freeTopCell(state, freer).state;
  return state;
}
/** `ally` makes a basic attack on `target` (the villain by default); an ally takes 1 consequential damage after attacking. */
const allyAttacks = (state: GameState, ally: InstanceId, target = villainOf(state)) =>
  driveEventsPicking(DEPS, state, firstLegal, attackOn(state, ally, target));

describe("the Inhuman allies (50105b to 50108b)", () => {
  const stats = (code: string) => {
    const c = dataOf(code) as unknown as {
      cost: number;
      specialCost: string;
      atk: number;
      thw: number;
      hp: number;
      unique: boolean;
      traits: string[];
      keywords: { name: string }[];
      resourceIcons: Record<string, number>;
    };
    return c;
  };
  it("data: Flying 1/2/5, Psionic 1/1/5, Sarah Garza (unique) 2/2/5, Strong 3/1/7 with toughness; cost a dash", () => {
    expect([stats("50105b").atk, stats("50105b").thw, stats("50105b").hp]).toEqual([1, 2, 5]);
    expect([stats("50106b").atk, stats("50106b").thw, stats("50106b").hp]).toEqual([1, 1, 5]);
    expect([stats("50107b").atk, stats("50107b").thw, stats("50107b").hp]).toEqual([2, 2, 5]);
    expect([stats("50108b").atk, stats("50108b").thw, stats("50108b").hp]).toEqual([3, 1, 7]);
    expect(["50105b", "50106b", "50107b", "50108b"].map((c) => stats(c).unique)).toEqual([false, false, true, false]);
    expect(["50105b", "50106b", "50107b", "50108b"].map((c) => stats(c).specialCost)).toEqual([
      "dash",
      "dash",
      "dash",
      "dash",
    ]);
    expect(stats("50108b").keywords).toEqual([{ name: "toughness" }]);
  });

  it("a freed ally enters ready, with no damage, under the chosen player; Strong Inhuman has toughness", () => {
    const s = gameWithCell("50108a");
    const { state, ally } = freeTopCell(s, P2);
    expect(codeOf(state, ally)).toBe("50108b");
    expect(inst(state, ally).controllerId).toBe(P2);
    expect(inst(state, ally).exhausted).toBe(false);
    expect(inst(state, ally).damage).toBe(0);
    expect(hasKeyword(state, ally, "toughness", DEPS)).toBe(true);
    expect(remainingHitPoints(state, ally, DEPS)).toBe(7);
  });

  it("they do not count against the ally limit: all four under one player, no ally to discard is asked", () => {
    const state = allFreed(P1);
    expect(state.pendingChoice).toBeNull();
    const mine = (code: string) => inPlayCodes(state, code).filter((i) => inst(state, i).controllerId === P1);
    expect(["50105b", "50106b", "50107b", "50108b"].map((c) => mine(c).length)).toEqual([1, 1, 1, 1]);
  });

  it("Flying Inhuman: after it thwarts a side scheme, 1 threat comes off another scheme (the main scheme), and vice versa", () => {
    const s = gameWithCell("50105a");
    const { state: freed, ally } = freeTopCell(s, P1);
    const side = Object.keys(freed.instances).find((i) => codeOf(freed, i as InstanceId) === "50121") as InstanceId;
    const sideIn: GameState = {
      ...patchInstance(freed, side, { threat: 3 }),
      villainArea: [...freed.villainArea, side],
      encounterDecks: {
        ...freed.encounterDecks,
        [activeEncounterDeckId(freed)]: {
          deck: piles(freed).deck.filter((i) => i !== side),
          discard: piles(freed).discard.filter((i) => i !== side),
        },
      },
    };
    const main = freed.mainScheme.instanceId;
    const staged = ready(patchInstance(sideIn, main, { threat: 5 }));
    const thwartSide = driveEventsPicking(DEPS, staged, accepting(main), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally,
      schemeInstanceId: side,
    });
    // THW 2 off the side scheme (3 -> 1), then 1 off the main scheme.
    expect(inst(thwartSide.state, side).threat).toBe(1);
    expect(inst(thwartSide.state, main).threat).toBe(4);
    const thwartMain = driveEventsPicking(DEPS, staged, accepting(side), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally,
      schemeInstanceId: main,
    });
    expect(inst(thwartMain.state, main).threat).toBe(3);
    expect(inst(thwartMain.state, side).threat).toBe(2);
  });

  it("Psionic Inhuman: after it thwarts, 1 lock counter comes off the Holding Cell in play (4 -> 3)", () => {
    const s = gameWithCell("50106a");
    const { state: freed, ally } = freeTopCell(s, P1);
    const cell = cellOf(freed);
    expect(lock(freed, cell)).toBe(4);
    const main = freed.mainScheme.instanceId;
    const { state } = driveEventsPicking(DEPS, ready(freed), accepting(), {
      type: "basicThwart",
      playerId: P1,
      thwarterInstanceId: ally,
      schemeInstanceId: main,
    });
    expect(lock(state, cell)).toBe(3);
    expect(inst(state, main).threat).toBe(inst(freed, main).threat - 1);
  });

  it("Sarah Garza's attacks gain ranged (no retaliate comes back); the other allies' attacks take M.O.D.O.K.'s retaliate 1 on top of their own 1 consequential damage", () => {
    const all = allFreed(P1);
    const damageAfterAttacking = (code: string) => {
      // Fresh table each time: the villain at full hit points, the attacker ready.
      const ally = inPlayCodes(all, code)[0]!;
      const { state } = allyAttacks(ready(patchInstance(all, villainOf(all), { damage: 0 })), ally);
      return inst(state, ally).damage;
    };
    expect(damageAfterAttacking("50107b")).toBe(1);
    expect(damageAfterAttacking("50105b")).toBe(2);
    expect(damageAfterAttacking("50106b")).toBe(2);
    // Strong Inhuman's tough status card is discarded by the first damage instead of taking it.
    const strong = inPlayCodes(all, "50108b")[0]!;
    expect(inst(all, strong).statuses.tough).toBe(1);
    expect(damageAfterAttacking("50108b")).toBe(1);
  });

  it("Sarah Garza's attacks gain overkill: 2 damage on an Adaptoid with 1 hit point left spills 1 onto M.O.D.O.K.; Flying Inhuman's 1 does not", () => {
    const s = gameWithCell("50107a");
    const { state: freed, ally } = freeTopCell(s, P1);
    const target = adaptoids(freed)[0]!;
    const hurt = ready(patchInstance(freed, target, { damage: 4 }));
    const { state } = allyAttacks(hurt, ally, target);
    expect(adaptoids(state)).not.toContain(target);
    expect(inst(state, villainOf(state)).damage).toBe(1);
    // The same blow with a flat 1 ATK (Spider-Man): the Adaptoid is defeated and the villain is untouched.
    const plain = driveEventsPicking(DEPS, hurt, firstLegal, attackOn(hurt, identityOf(hurt, P1), target));
    expect(inst(plain.state, villainOf(plain.state)).damage).toBe(0);
  });

  it("overkill past an Adaptoid that takes M.O.D.O.K. to 0: his interrupt first (2 lock counters), then the Adaptoid's When Defeated (1 more)", () => {
    const s = gameWithCell("50107a");
    const { state: freed, ally } = freeTopCell(s, P1);
    const cell = cellOf(freed);
    expect(lock(freed, cell)).toBe(4);
    const target = adaptoids(freed)[0]!;
    const staged = ready(patchInstance(patchInstance(freed, target, { damage: 4 }), villainOf(freed), { damage: 9 }));
    const { state } = allyAttacks(staged, ally, target);
    expect(lock(state, cell)).toBe(1);
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(10);
    expect(state.outcome).toBeNull();
  });

  it("an ally defeated goes to the bottom of the Holding Cell deck as a cell, not to any discard pile", () => {
    const s = gameWithCell("50105a");
    const { state: freed, ally } = freeTopCell(s, P1);
    const before = deckOf(freed);
    // 4 damage on 5 hit points: its own 1 consequential damage after attacking defeats it.
    const hurt = ready(patchInstance(freed, ally, { damage: 4 }));
    const { state } = allyAttacks(hurt, ally);
    expect(inPlayIds(state)).not.toContain(ally);
    expect(codeOf(state, ally)).toBe("50105a");
    expect(deckOf(state)).toEqual([...before, ally]);
    expect(inst(state, ally).damage).toBe(0);
    expect(playerOf(state, P1).discard).not.toContain(ally);
    expect(state.victoryDisplay).not.toContain(ally);
    expect(state.removedFromGame).not.toContain(ally);
    // The cell in play is still the one that came up when it was freed.
    expect(cellOf(state)).toBe(cellOf(freed));
  });

  it("with the deck empty (the other three freed too) the defeated ally is the only card: in play at once with 4 lock counters, and the win branch is closed", () => {
    const state = allFreed(P1);
    expect(state.scenarioDecks[DECK]!.inPlayTopId).toBeUndefined();
    const ally = inPlayCodes(state, "50108b")[0]!;
    const hurt = ready(patchInstance(state, ally, { damage: 6 }));
    const { state: after } = allyAttacks(hurt, ally);
    expect(codeOf(after, ally)).toBe("50108a");
    expect(after.scenarioDecks[DECK]!.inPlayTopId).toBe(ally);
    expect(lock(after, ally)).toBe(4);
    expect(deckOf(after)).toHaveLength(0);
    // M.O.D.O.K. can be reset again: no win.
    const reset = defeatWithAttack(DEPS, ready(after), villainOf(after));
    expect(reset.outcome).toBeNull();
    expect(lock(reset, ally)).toBe(2);
  });
});

describe("the Adaptoid upgrade environments (50109 to 50112)", () => {
  const keywordNames = (s: GameState, id: InstanceId) => keywordsOf(s, id, DEPS).map((k) => k.name);
  const traitNames = (s: GameState, id: InstanceId) => traitsOf(s, id, DEPS).map((t) => String(t));
  const withOnly = (code?: string, players = 1) => {
    const s = withUpgrades(game(players), ...(code ? [code] : []));
    return { s, adaptoid: adaptoids(s)[0]! };
  };

  it("data: four environments with the Adaptoid trait; the Adaptoid is a minion with ATK 1, SCH 1, 5 hit points, boost icons 2", () => {
    for (const code of ["50109", "50110", "50111", "50112"]) {
      const card = dataOf(code) as unknown as { type: string; traits: string[] };
      expect(card.type).toBe("environment");
      expect(card.traits.map(String)).toEqual(["ADAPTOID"]);
    }
    const adaptoid = dataOf("50113") as unknown as Record<string, unknown>;
    expect([adaptoid.type, adaptoid.atk, adaptoid.sch, adaptoid.hp, adaptoid.boostIcons]).toEqual([
      "minion",
      1,
      1,
      5,
      2,
    ]);
    expect(adaptoid.keywords).toEqual([]);
  });

  it("with no upgrade in play an Adaptoid is plain: no modifier, no keyword, only the Adaptoid trait", () => {
    const { s, adaptoid } = withOnly();
    expect(upgradesInPlay(s)).toEqual([]);
    expect(statBonus(s, DEPS, adaptoid, "atk")).toBe(0);
    expect(statBonus(s, DEPS, adaptoid, "sch")).toBe(0);
    expect(keywordNames(s, adaptoid)).toEqual([]);
    expect(traitNames(s, adaptoid)).toEqual(["ADAPTOID"]);
    expect(maxHitPoints(s, adaptoid, DEPS)).toBe(5);
  });

  it("Flying Upgrade: every Adaptoid gets +1 SCH, gains incite 1 and the Aerial trait (and nothing else)", () => {
    for (const players of [1, 2]) {
      const { s } = withOnly("50109", players);
      expect(adaptoids(s)).toHaveLength(players);
      for (const a of adaptoids(s)) {
        expect(statBonus(s, DEPS, a, "sch")).toBe(1);
        expect(statBonus(s, DEPS, a, "atk")).toBe(0);
        expect(keywordsOf(s, a, DEPS)).toEqual([{ name: "incite", value: 1 }]);
        expect(traitNames(s, a).sort()).toEqual(["ADAPTOID", "AERIAL"]);
      }
    }
  });

  it("Psionic Upgrade: every Adaptoid gains villainous and the Psionic trait", () => {
    const { s, adaptoid } = withOnly("50110", 2);
    for (const a of adaptoids(s)) {
      expect(keywordNames(s, a)).toEqual(["villainous"]);
      expect(traitNames(s, a).sort()).toEqual(["ADAPTOID", "PSIONIC"]);
      expect(statBonus(s, DEPS, a, "atk")).toBe(0);
      expect(statBonus(s, DEPS, a, "sch")).toBe(0);
    }
    expect(adaptoid).toBeDefined();
  });

  it("Sarah Garza Upgrade: every Adaptoid is Elite with +1 ATK", () => {
    const { s } = withOnly("50111", 2);
    for (const a of adaptoids(s)) {
      expect(traitNames(s, a).sort()).toEqual(["ADAPTOID", "ELITE"]);
      expect(statBonus(s, DEPS, a, "atk")).toBe(1);
      expect(statBonus(s, DEPS, a, "sch")).toBe(0);
    }
  });

  it("Strong Upgrade: every Adaptoid gets +1 ATK, gains toughness and the Brute trait", () => {
    const { s } = withOnly("50112", 2);
    for (const a of adaptoids(s)) {
      expect(keywordNames(s, a)).toEqual(["toughness"]);
      expect(traitNames(s, a).sort()).toEqual(["ADAPTOID", "BRUTE"]);
      expect(statBonus(s, DEPS, a, "atk")).toBe(1);
    }
  });

  it("Strong and Sarah Garza upgrades together: ATK 3 (1 + 1 + 1), Elite and Brute, toughness", () => {
    const s = withUpgrades(game(1), "50111", "50112");
    const a = adaptoids(s)[0]!;
    expect(statBonus(s, DEPS, a, "atk")).toBe(2);
    expect(traitNames(s, a).sort()).toEqual(["ADAPTOID", "BRUTE", "ELITE"]);
    expect(keywordNames(s, a)).toEqual(["toughness"]);
  });

  it("only Adaptoid minions are changed: M.O.D.O.K. and the allies are untouched", () => {
    const s = withUpgrades(game(1), "50109", "50110", "50111", "50112");
    expect(keywordNames(s, villainOf(s))).toEqual(["retaliate"]);
    expect(statBonus(s, DEPS, villainOf(s), "atk")).toBe(0);
    expect(statBonus(s, DEPS, villainOf(s), "sch")).toBe(0);
    expect(traitNames(s, villainOf(s)).sort()).toEqual(["AERIAL", "CYBORG", "PSIONIC"]);
  });

  /** One player, the villain stunned, the encounter deck exactly the given cards (the first is dealt to the player, the second is the boost card of the Adaptoid already in play). */
  function revealing(upgrades: readonly string[]): { before: GameState; after: GameState; revealed: InstanceId } {
    const before = onlyDeck(
      patchInstance(withUpgrades(game(1), ...upgrades), villainOf(game(1)), {
        statuses: { stunned: 1, confused: 0, tough: 0 },
      }),
      "50113",
      BLANK,
      ONE_ICON,
    );
    const { state } = villainPhase(before);
    const revealed = adaptoids(state).find((i) => !adaptoids(before).includes(i))!;
    return { before, after: state, revealed };
  }

  it("a newly revealed Adaptoid: incite 1 from Flying Upgrade places 1 threat on the main scheme, Strong Upgrade gives it a tough status card", () => {
    const plain = revealing([]);
    const upgraded = revealing(["50109", "50112"]);
    expect(upgraded.revealed).toBeDefined();
    expect(inst(plain.after, plain.revealed).statuses.tough).toBe(0);
    expect(inst(upgraded.after, upgraded.revealed).statuses.tough).toBe(1);
    const gained = (t: { before: GameState; after: GameState }) =>
      inst(t.after, t.after.mainScheme.instanceId).threat - inst(t.before, t.before.mainScheme.instanceId).threat;
    expect(gained(upgraded) - gained(plain)).toBe(1);
  });

  it("an Adaptoid already in play when Strong Upgrade enters gets no status card (toughness answers entering play)", () => {
    let seed = 1;
    while (upgradesInPlay(game(1, "standard", seed)).includes("50112")) seed++;
    const before = game(1, "standard", seed);
    const adaptoid = adaptoids(before)[0]!;
    const after = withUpgrades(before, ...upgradesInPlay(before), "50112");
    expect(keywordNames(after, adaptoid)).toContain("toughness");
    expect(inst(after, adaptoid).statuses.tough).toBe(0);
    // Setup with Strong Upgrade already in play does give the revealed Adaptoid its tough status card.
    let strongSeed = 1;
    while (!upgradesInPlay(game(1, "standard", strongSeed)).includes("50112")) strongSeed++;
    const strong = game(1, "standard", strongSeed);
    expect(inst(strong, adaptoids(strong)[0]!).statuses.tough).toBe(1);
  });

  it("Sarah Garza Upgrade: an Adaptoid's attack gains overkill (excess damage on a defending ally reaches the hero)", () => {
    const run = (upgrades: readonly string[]) => {
      const base = withUpgrades(gameWithCell("50105a", 1), ...upgrades);
      const { state: withAlly, ally } = freeTopCell(base, P1);
      const staged = onlyDeck(
        patchInstance(
          patchInstance(withAlly, villainOf(withAlly), { statuses: { stunned: 1, confused: 0, tough: 0 } }),
          ally,
          { damage: 4 },
        ),
        BLANK,
        BLANK,
      );
      const { state } = villainPhase(staged, defendingWith(ally));
      return {
        state,
        ally,
        heroDamage: inst(state, identityOf(state, P1)).damage - inst(staged, identityOf(staged, P1)).damage,
      };
    };
    // Plain: ATK 1 finishes the ally (4 + 1 = 5) with nothing to spare. Upgraded: ATK 2, overkill: 1 spills onto the hero.
    const plain = run([]);
    expect(inPlayIds(plain.state)).not.toContain(plain.ally);
    expect(plain.heroDamage).toBe(0);
    const upgraded = run(["50111"]);
    expect(inPlayIds(upgraded.state)).not.toContain(upgraded.ally);
    expect(upgraded.heroDamage).toBe(1);
  });
});

describe("Adaptoid (50113)", () => {
  it("When Defeated: 1 all-purpose counter comes off an environment: the Holding Cell's lock counters 4 -> 3", () => {
    const s = game(2);
    const cell = cellOf(s);
    const target = adaptoids(s)[0]!;
    const state = defeatWithAttack(DEPS, s, target);
    expect(adaptoids(state)).not.toContain(target);
    expect(lock(state, cell)).toBe(3);
  });

  it("the first player picks the environment when several hold counters; the others keep theirs", () => {
    const s = game(2);
    const cell = cellOf(s);
    const upgrade = s.villainArea.find((i) => /^5011[0-2]$|^50109$/.test(codeOf(s, i)))!;
    const target = adaptoids(s)[0]!;
    const staged = patchInstance(s, upgrade, { counters: { storm: 2 } });
    const picked = driveEventsPicking(
      DEPS,
      patchInstance(staged, target, { damage: 999 }),
      picking(upgrade),
      attackOn(staged, identityOf(staged, P1), target),
    );
    expect(inst(picked.state, upgrade).counters).toEqual({ storm: 1 });
    expect(lock(picked.state, cell)).toBe(4);
    const other = driveEventsPicking(
      DEPS,
      patchInstance(staged, target, { damage: 999 }),
      picking(cell),
      attackOn(staged, identityOf(staged, P1), target),
    );
    expect(inst(other.state, upgrade).counters).toEqual({ storm: 2 });
    expect(lock(other.state, cell)).toBe(3);
  });

  it("the last lock counter taken by a defeated Adaptoid frees the cell, as any removal does", () => {
    const s = game(2);
    const cell = cellOf(s);
    const staged = patchInstance(s, cell, { counters: { lock: 1 } });
    const state = defeatWithAttack(DEPS, staged, adaptoids(s)[0]!);
    expect(codeOf(state, cell)).toBe(codeOf(s, cell).replace("a", "b"));
    expect(inst(state, cell).controllerId).toBe(P1);
    expect(lock(state, cellOf(state))).toBe(4);
  });

  it("Boost: after the activation it boosted, the Adaptoid is shuffled into the encounter deck (not discarded)", () => {
    const s = game(1);
    // The Adaptoid in play is moved away so only the villain activates.
    const gone = new Set(adaptoids(s));
    const pile = piles(s);
    const cleared: GameState = {
      ...s,
      players: s.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !gone.has(i)) })),
      encounterDecks: {
        ...s.encounterDecks,
        [activeEncounterDeckId(s)]: { deck: pile.deck, discard: [...pile.discard, ...gone] },
      },
    };
    // The villain's activation draws the first card as its boost; the next is dealt to the player.
    const staged = onlyDeck(cleared, "50113", BLANK, ONE_ICON);
    const boostCard = piles(staged).deck[0]!;
    expect(codeOf(staged, boostCard)).toBe("50113");
    const { state, events } = villainPhase(staged);
    // The boost resolved (2 boost icons), then the card went back into the encounter deck, which was shuffled with it.
    expect(types(events, "boostCardFlipped").map((e) => [e.instanceId, e.boostIcons])).toEqual([[boostCard, 2]]);
    expect(types(events, "abilityResolved").map((e) => e.abilityId)).toContain("50113.boost");
    const shuffled = types(events, "deckShuffled").find((e) => e.order.includes(boostCard));
    expect(shuffled).toBeDefined();
    expect(piles(state).discard).not.toContain(boostCard);
  });
});

// --- the second half --------------------------------------------------------------------------------------------

/** Every Adaptoid in play moved to the encounter discard pile, so a villain phase boosts and activates only the villain. */
function withoutAdaptoids(state: GameState): GameState {
  const gone = new Set(adaptoids(state));
  const pile = piles(state);
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, playArea: p.playArea.filter((i) => !gone.has(i)) })),
    encounterDecks: {
      ...state.encounterDecks,
      [activeEncounterDeckId(state)]: { deck: pile.deck, discard: [...pile.discard, ...gone] },
    },
  };
}
const stunned = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { stunned: 1, confused: 0, tough: 0 } });
/**
 * Filler boost cards: Core treacheries with no boost icon and no Boost ability (two copies of each are in the deck).
 * Dealt, they are not inert (Advance schemes, Assault attacks), so a card dealt to a player as a filler is `HARMLESS`.
 */
const FILL = "01187";
/** A card whose reveal changes nothing these tests read: a side scheme (it is put into play with its starting threat). */
const HARMLESS = "50122";
/**
 * A villain phase in which only the cards dealt to the players are revealed: no Adaptoid in play, and the villain
 * stunned. The stun replaces the villain's first attack (no boost card is drawn for it); he activates once per player,
 * so each further player's activation draws a filler boost card. `stack` is then the encounter deck's top, first card
 * first: one dealt card per player, then whatever a revealed card draws.
 */
const dealtPhase = (s: GameState, pick: Picker, ...stack: string[]) =>
  villainPhase(
    stunned(withoutAdaptoids(s), villainOf(s)),
    pick,
    ...Array.from({ length: s.players.length - 1 }, () => FILL),
    ...stack,
  );

/** `code` (an encounter card, in the deck or discard pile) attached to `host` by surgery, with `counters`. */
function attachTo(
  state: GameState,
  code: string,
  host: InstanceId = villainOf(state),
  counters: Record<string, number> = {},
): { readonly state: GameState; readonly id: InstanceId } {
  const deckId = activeEncounterDeckId(state);
  const pile = state.encounterDecks[deckId]!;
  const id = [...pile.deck, ...pile.discard].find((i) => codeOf(state, i) === code);
  if (!id) throw new Error(`no ${code} in the encounter deck or discard`);
  return {
    id,
    state: {
      ...state,
      encounterDecks: {
        ...state.encounterDecks,
        [deckId]: { deck: pile.deck.filter((i) => i !== id), discard: pile.discard.filter((i) => i !== id) },
      },
      instances: {
        ...state.instances,
        [id]: { ...state.instances[id]!, faceup: true, attachedTo: host, counters },
        [host]: { ...state.instances[host]!, attachments: [...state.instances[host]!.attachments, id] },
      },
    },
  };
}
const attachedCodes = (s: GameState, host: InstanceId) => inst(s, host).attachments.map((i) => codeOf(s, i));
const inEncounterDiscard = (s: GameState, id: InstanceId) => piles(s).discard.includes(id);
const dataFor = (code: string) =>
  dataOf(code) as unknown as {
    type: string;
    atk?: number;
    sch?: number;
    hp?: number;
    quantityInSet: number;
    boostIcons: number;
    starIcon?: boolean;
    schemeIcons?: string[];
    amplifyIcons?: number;
    statModifiers?: Record<string, number>;
    attachesTo?: unknown;
    startingThreat?: { base: number; perPlayer: number };
    icons?: unknown[];
    traits: string[];
    keywords: { name: string; value?: number; perPlayer?: number }[];
    abilities: { id: string }[];
  };

describe("the attachments (50114 to 50119): data", () => {
  it("all six attach to M.O.D.O.K. by name, one copy each, with no Hero Action of their own", () => {
    for (const code of ["50114", "50115", "50116", "50117", "50118", "50119"]) {
      const card = dataFor(code);
      expect(card.type, code).toBe("attachment");
      expect(card.attachesTo, code).toEqual({ kind: "namedCard", name: "M.O.D.O.K." });
      expect(card.quantityInSet, code).toBe(1);
      expect(card.keywords, code).toEqual([]);
      // No ability is a Hero Action: each card is removed only by the ability naming the hit point reset (or the
      // damage it absorbs), never by a cost a player pays.
      expect(
        card.abilities.map((a) => a.id).filter((id) => id.endsWith("-action")),
        code,
      ).toEqual([]);
    }
  });

  it("stats and icons: Mobile Unit +1 ATK, 2 boost; Crystal +1 ATK +1 SCH, acceleration, 3 boost; Nanobots 2 boost, Tech", () => {
    const unit = dataFor("50114");
    expect([unit.statModifiers, unit.boostIcons, unit.starIcon]).toEqual([{ atk: 1 }, 2, undefined]);
    const crystal = dataFor("50115");
    expect([crystal.statModifiers, crystal.schemeIcons, crystal.boostIcons]).toEqual([
      { atk: 1, sch: 1 },
      ["acceleration"],
      3,
    ]);
    const nanobots = dataFor("50116");
    expect([nanobots.statModifiers, nanobots.traits, nanobots.boostIcons]).toEqual([undefined, ["TECH"], 2]);
  });

  it("stats and icons: Force Field 0 boost and a star; Machetes +1 ATK, 1 boost and a star; Reverse Engineering 2 boost", () => {
    const field = dataFor("50117");
    expect([field.statModifiers, field.boostIcons, field.starIcon]).toEqual([undefined, 0, true]);
    const machetes = dataFor("50118");
    expect([machetes.statModifiers, machetes.boostIcons, machetes.starIcon]).toEqual([{ atk: 1 }, 1, true]);
    // Reverse Engineering prints +X ATK and +X SCH: no flat modifier in the data, X is the script's.
    expect([dataFor("50119").statModifiers, dataFor("50119").boostIcons]).toEqual([undefined, 2]);
  });

  it("a revealed attachment attaches to M.O.D.O.K. (each of the six, dealt and revealed in a villain phase)", () => {
    for (const code of ["50114", "50115", "50116", "50117", "50118", "50119"]) {
      const { state } = dealtPhase(game(1), firstLegal, code);
      expect(attachedCodes(state, villainOf(state)), code).toEqual([code]);
      const [id] = inst(state, villainOf(state)).attachments;
      expect(inst(state, id!).attachedTo, code).toBe(villainOf(state));
      expect(cardsInPlay(state), code).toContain(id);
      expect(
        piles(state).discard.map((i) => codeOf(state, i)),
        code,
      ).not.toContain(code);
    }
  });
});

describe("Automated Mobile Unit (50114) and the hit point reset (owner decision Q3 = A)", () => {
  it("CONSTANT: M.O.D.O.K. gets +5 hit points (10 -> 15; 14 -> 19) and the card's +1 ATK", () => {
    for (const [mode, printed] of [
      ["standard", 10],
      ["expert", 14],
    ] as const) {
      const s = game(2, mode);
      const { state } = attachTo(s, "50114");
      expect(maxHitPoints(s, villainOf(s), DEPS)).toBe(printed);
      expect(maxHitPoints(state, villainOf(state), DEPS)).toBe(printed + 5);
      expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(printed + 5);
      expect(statBonus(state, DEPS, villainOf(state), "atk")).toBe(1);
    }
  });

  it("RESET: the attachment is discarded after his hit points are reset; he is not defeated and a cell loses 2 lock counters", () => {
    const { state: staged, id } = attachTo(game(2), "50114");
    const state = defeatWithAttack(DEPS, patchInstance(staged, villainOf(staged), { damage: 9 }), villainOf(staged));
    expect(attachedCodes(state, villainOf(state))).toEqual([]);
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(maxHitPoints(state, villainOf(state), DEPS)).toBe(10);
    expect(state.villains[0]!.defeated).toBe(false);
    expect(lock(state, cellOf(staged))).toBe(2);
    expect(state.outcome).toBeNull();
  });

  it("RESET, expert: the attachment is discarded and the maximum is back to 14", () => {
    const { state: staged, id } = attachTo(game(2, "expert"), "50114");
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(maxHitPoints(state, villainOf(state), DEPS)).toBe(14);
  });

  // Q3 = A (docs/phase7-wave9.md section 4.1): the dial is set to the printed 10 (14) with the +5 still on him (10 of
  // 15), then the attachment leaves and the dial drops by 5 (RRG 1.8 "Hit Points", p. 22: "If that ability later ceases
  // to be in effect, reduce that character's hit point dial by X").
  it("Q3 = A, standard: reset to 10 of 15, the attachment leaves, he ends at 5 remaining of 10 (5 damage)", () => {
    const { state: staged } = attachTo(game(2), "50114");
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(maxHitPoints(state, villainOf(state), DEPS)).toBe(10);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(5);
    expect(inst(state, villainOf(state)).damage).toBe(5);
    expect(state.villains[0]!.defeated).toBe(false);
    expect(state.outcome).toBeNull();
  });

  it("Q3 = A, expert: reset to 14 of 19, the attachment leaves, he ends at 9 remaining of 14", () => {
    const { state: staged } = attachTo(game(2, "expert"), "50114");
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(maxHitPoints(state, villainOf(state), DEPS)).toBe(14);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(9);
    expect(inst(state, villainOf(state)).damage).toBe(5);
  });

  it("Q3 = A: the dial reads 10 (14) at the reset itself, before the attachment leaves", () => {
    for (const [mode, printed] of [
      ["standard", 10],
      ["expert", 14],
    ] as const) {
      const { state: staged } = attachTo(game(2, mode), "50114");
      const events = driveEventsPicking(
        DEPS,
        patchInstance(staged, villainOf(staged), { damage: 999 }),
        firstLegal,
        attackOn(staged, identityOf(staged, P1), villainOf(staged)),
      ).events;
      expect(events.filter((e) => e.type === "hitPointsSet")).toEqual([
        { type: "hitPointsSet", instanceId: villainOf(staged), remaining: printed, damage: 5 },
      ]);
    }
  });

  it("Q3 = A, revealed rather than placed: Automated Mobile Unit dealt in a villain phase attaches (15), and the reset ends at 5", () => {
    const { state: revealed } = dealtPhase(game(1), firstLegal, "50114");
    expect(attachedCodes(revealed, villainOf(revealed))).toEqual(["50114"]);
    expect(maxHitPoints(revealed, villainOf(revealed), DEPS)).toBe(15);
    const state = defeatWithAttack(DEPS, ready(revealed), villainOf(revealed));
    expect(attachedCodes(state, villainOf(state))).toEqual([]);
    expect(maxHitPoints(state, villainOf(state), DEPS)).toBe(10);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(5);
  });

  it("Q3 = A: the next reset, with nothing attached, takes him from 5 back to the printed 10; 2 more lock counters go", () => {
    const { state: staged } = attachTo(game(2), "50114");
    const first = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(remainingHitPoints(first, villainOf(first), DEPS)).toBe(5);
    expect(lock(first, cellOf(staged))).toBe(2);
    const second = defeatWithAttack(DEPS, ready(first), villainOf(first));
    expect(remainingHitPoints(second, villainOf(second), DEPS)).toBe(10);
    expect(inst(second, villainOf(second)).damage).toBe(0);
    expect(second.outcome).toBeNull();
    // Both counters of the first cell are gone: it flipped to its ally and the next cell came up with its own 4.
    expect(cellOf(second)).not.toBe(cellOf(staged));
    expect(lock(second, cellOf(second))).toBe(4);
  });

  it("without the attachment the reset ends at the printed 10 (14 in expert mode), with no damage", () => {
    for (const [mode, printed] of [
      ["standard", 10],
      ["expert", 14],
    ] as const) {
      const s = game(2, mode);
      const state = defeatWithAttack(DEPS, s, villainOf(s));
      expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(printed);
      expect(inst(state, villainOf(state)).damage).toBe(0);
    }
  });

  it("the attachment is not discarded by a heal or damage, only by the reset", () => {
    const { state: staged, id } = attachTo(game(2), "50114");
    const hit = heroAttacks(DEPS, staged, villainOf(staged)).state;
    expect(inst(hit, id).attachedTo).toBe(villainOf(staged));
    expect(inst(hit, villainOf(hit)).damage).toBeGreaterThan(0);
  });
});

describe("Focusing Crystal (50115)", () => {
  it("CONSTANT (card): +1 ATK, +1 SCH and an acceleration icon on M.O.D.O.K.", () => {
    const s = game(2);
    const { state } = attachTo(s, "50115");
    expect(statBonus(state, DEPS, villainOf(state), "atk")).toBe(1);
    expect(statBonus(state, DEPS, villainOf(state), "sch")).toBe(1);
  });

  it("FORCED RESPONSE: after his hit points are reset it is discarded; the hit points end at the printed 10", () => {
    const { state: staged, id } = attachTo(game(2), "50115");
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(attachedCodes(state, villainOf(state))).toEqual([]);
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(remainingHitPoints(state, villainOf(state), DEPS)).toBe(10);
  });
});

describe("Focusing Crystal (50115): the acceleration icon", () => {
  it("places 1 more threat on the main scheme in the villain phase than without it (solo: 1 + 1 against 1)", () => {
    const threatAfter = (withCrystal: boolean) => {
      let s = withoutAdaptoids(game(1));
      if (withCrystal) s = attachTo(s, "50115").state;
      const { state } = villainPhase(stunned(s, villainOf(s)), firstLegal, HARMLESS);
      return inst(state, state.mainScheme.instanceId).threat;
    };
    expect(threatAfter(true) - threatAfter(false)).toBe(1);
  });
});

describe("Nanobots (50116)", () => {
  /** A villain phase with the villain activating (an undefended attack on the hero, one blank boost). */
  const activates = (s: GameState) => villainPhase(withoutAdaptoids(s), firstLegal, FILL, HARMLESS);

  it("FORCED RESPONSE: after M.O.D.O.K. activates, 1 damage is healed from him (3 -> 2)", () => {
    const { state: staged } = attachTo(game(1), "50116");
    const { state, events } = activates(patchInstance(staged, villainOf(staged), { damage: 3 }));
    expect(attacksBy(state, events, "50103a")).toHaveLength(1);
    expect(inst(state, villainOf(state)).damage).toBe(2);
  });

  it("with no damage on him there is nothing to heal", () => {
    const { state: staged } = attachTo(game(1), "50116");
    expect(inst(activates(staged).state, villainOf(staged)).damage).toBe(0);
  });

  it("a stunned M.O.D.O.K. does not attack (RRG 1.8 p. 41: not considered to have attacked), so nothing is healed", () => {
    const { state: staged } = attachTo(game(1), "50116");
    const { state } = dealtPhase(patchInstance(staged, villainOf(staged), { damage: 3 }), firstLegal, HARMLESS);
    expect(inst(state, villainOf(state)).damage).toBe(3);
  });

  it("FORCED RESPONSE: after the reset it is discarded too", () => {
    const { state: staged, id } = attachTo(game(2), "50116");
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(inEncounterDiscard(state, id)).toBe(true);
  });
});

const HAYMAKER = "01087";
/** Six more cards from the top of P1's deck in hand, to pay for a card. */
const refilled = (s: GameState): GameState => ({
  ...s,
  players: s.players.map((p) =>
    p.playerId === P1 ? { ...p, hand: [...p.hand, ...p.deck.slice(0, 6)], deck: p.deck.slice(6) } : p,
  ),
});
const keywordNames = (s: GameState, id: InstanceId) => keywordsOf(s, id, DEPS).map((k) => k.name);
const toughOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.tough;
const withTough = (s: GameState, id: InstanceId): GameState =>
  patchInstance(s, id, { statuses: { stunned: 0, confused: 0, tough: 1 } });

describe("Psionic Force Field (50117)", () => {
  it("CONSTANT: the attached enemy gains stalwart (so it cannot be stunned or confused)", () => {
    const s = game(2);
    const { state } = attachTo(s, "50117");
    expect(keywordNames(s, villainOf(s))).not.toContain("stalwart");
    expect(keywordNames(state, villainOf(state))).toContain("stalwart");
  });

  it("FORCED INTERRUPT: a 1 damage attack puts that damage on the field instead; M.O.D.O.K. takes none", () => {
    const { state: staged, id } = attachTo(game(2), "50117");
    const { state } = heroAttacks(DEPS, staged, villainOf(staged));
    expect(inst(state, villainOf(state)).damage).toBe(0);
    expect(inst(state, id).damage).toBeGreaterThan(0);
    expect(inst(state, id).attachedTo).toBe(villainOf(state));
    // Retaliate 1 still answers an attack that dealt him nothing.
    expect(inst(state, identityOf(state, P1)).damage).toBe(1);
  });

  it("THEN: a 3 damage hit on a field holding 3 puts it at 6, discards the field, and M.O.D.O.K. takes 0", () => {
    const { state: staged, id } = attachTo(game(2), "50117");
    const loaded = patchInstance(refilled(staged), id, { damage: 3 });
    const played = playFromHand(DEPS, loaded, HAYMAKER, 2, picking(villainOf(staged)));
    expect(inst(played.state, villainOf(staged)).damage).toBe(0);
    expect(attachedCodes(played.state, villainOf(staged))).toEqual([]);
    expect(inEncounterDiscard(played.state, id)).toBe(true);
  });

  it("below 5 the field stays: a 3 damage hit on an empty field leaves it at 3", () => {
    const { state: staged, id } = attachTo(game(2), "50117");
    const played = playFromHand(DEPS, refilled(staged), HAYMAKER, 2, picking(villainOf(staged)));
    expect(inst(played.state, id).damage).toBe(3);
    expect(inst(played.state, villainOf(staged)).damage).toBe(0);
    expect(attachedCodes(played.state, villainOf(staged))).toEqual(["50117"]);
  });

  it("a hit that brings it to exactly 5 is absorbed in full and discards it", () => {
    const { state: staged, id } = attachTo(game(2), "50117");
    const loaded = patchInstance(refilled(staged), id, { damage: 2 });
    const played = playFromHand(DEPS, loaded, HAYMAKER, 2, picking(villainOf(staged)));
    expect(inst(played.state, villainOf(staged)).damage).toBe(0);
    expect(inEncounterDiscard(played.state, id)).toBe(true);
  });

  it("it is not discarded by the hit point reset (unlike the other five)", () => {
    const { state: staged } = attachTo(game(2), "50117");
    // The field holds the damage, so the lethal blow is staged as the villain's own damage.
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(attachedCodes(state, villainOf(state))).toContain("50117");
  });

  it("BOOST: attaches to the activating enemy; M.O.D.O.K. activating, it is attached to him", () => {
    const s = withoutAdaptoids(game(2));
    const { state } = villainPhase(s, firstLegal, "50117", BLANK, FILL);
    expect(attachedCodes(state, villainOf(state))).toContain("50117");
    expect(piles(state).discard.map((i) => codeOf(state, i))).not.toContain("50117");
  });

  it("BOOST: an Adaptoid activating, it is attached to that Adaptoid, which gains stalwart", () => {
    const s = game(2);
    const gone = adaptoids(s);
    const stunnedVillain = stunned(s, villainOf(s));
    // The stunned villain draws no boost card; the Adaptoid engaged with P1 draws the Force Field, P2's a filler, and one
    // harmless card is dealt to each player.
    const { state } = villainPhase(stunnedVillain, firstLegal, "50117", FILL, HARMLESS, "50121");
    const holders = gone.filter((a) => attachedCodes(state, a).includes("50117"));
    expect(holders).toHaveLength(1);
    expect(inst(state, holders[0]!).engagedWith).toBe(P1);
    expect(keywordNames(state, holders[0]!)).toContain("stalwart");
    expect(attachedCodes(state, villainOf(state))).not.toContain("50117");
  });
});

describe("Psionic Machetes (50118)", () => {
  /** One player, no Adaptoid: the villain attacks the hero, who has a tough status card; `stack` starts with the boost. */
  const attacked = (withMachetes: boolean, ...stack: string[]) => {
    let s = withoutAdaptoids(game(1));
    if (withMachetes) s = attachTo(s, "50118").state;
    s = withTough(s, identityOf(s, P1));
    const { state, events } = villainPhase(s, firstLegal, ...stack);
    return { state, events, hero: identityOf(state, P1) };
  };

  it("without Machetes the hero's tough status absorbs M.O.D.O.K.'s attack: no damage, the card is discarded", () => {
    const { state, hero } = attacked(false, FILL, HARMLESS);
    expect(inst(state, hero).damage).toBe(0);
    expect(toughOn(state, hero)).toBe(0);
  });

  it("CONSTANT: his attacks gain piercing: tough is discarded before the damage, which lands (1 ATK + 1 from the card)", () => {
    const { state, hero } = attacked(true, FILL, HARMLESS);
    expect(inst(state, hero).damage).toBe(2);
    expect(toughOn(state, hero)).toBe(0);
  });

  it("FORCED RESPONSE: after the reset it is discarded", () => {
    const { state: staged, id } = attachTo(game(2), "50118");
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(inEncounterDiscard(state, id)).toBe(true);
  });

  it("BOOST: on an attack, the attack gains piercing: 1 boost icon + 1 ATK = 2 damage through the tough card", () => {
    const { state, hero, events } = attacked(false, "50118", HARMLESS);
    expect(types(events, "boostCardFlipped").map((e) => [codeOf(state, e.instanceId), e.boostIcons])).toEqual([
      ["50118", 1],
    ]);
    expect(inst(state, hero).damage).toBe(2);
    expect(toughOn(state, hero)).toBe(0);
    expect(piles(state).discard.map((i) => codeOf(state, i))).toContain("50118");
  });

  it("BOOST: on a scheme (the player is in alter-ego form) there is no attack to give piercing; only the icon counts", () => {
    const s = withForm(withoutAdaptoids(game(1)), "alterEgo", P1);
    const { state, events } = villainPhase(s, firstLegal, "50118", HARMLESS);
    const [scheme] = schemesBy(state, events, "50103a");
    expect([scheme!.baseSch, scheme!.boostIcons, scheme!.threatPlaced]).toEqual([2, 1, 3]);
  });
});

/**
 * The six attachments attach to M.O.D.O.K. when revealed ("the attachments: data" above). Where a test needs one on
 * him with nothing else going on it is put there directly (`attachTo`), which skips the villain phase.
 */
describe("Reverse Engineering (50119)", () => {
  /** A Core ally of printed cost 3: stands in for the top card of P1's deck. */
  const costThree = CORE_CARDS.find((c) => "cost" in c && c.cost === 3 && c.type === "ally")!.id as string;
  const instanceOf = (s: GameState, code: string) =>
    Object.keys(s.instances).find((i) => codeOf(s, i as InstanceId) === code) as InstanceId;

  /** `card` tucked under `host` by surgery (out of its owner's deck or play area). */
  function tuck(state: GameState, host: InstanceId, card: InstanceId): GameState {
    return {
      ...patchInstance(state, host, { tucked: [...inst(state, host).tucked, card] }),
      players: state.players.map((p) => ({
        ...p,
        deck: p.deck.filter((i) => i !== card),
        hand: p.hand.filter((i) => i !== card),
        playArea: p.playArea.filter((i) => i !== card),
      })),
    };
  }
  /** Reverse Engineering on M.O.D.O.K. with P1's deck-top card (made a cost-3 ally) tucked under it. */
  function engineered() {
    const s = game(1);
    const top = playerOf(s, P1).deck[0]!;
    const card = patchInstance(s, top, { cardId: costThree as never });
    const { state: attached, id } = attachTo(card, "50119");
    return { state: tuck(attached, id, top), id, top };
  }

  it("data: the cost-3 stand-in really costs 3", () => {
    expect((CORE_CARDS.find((c) => c.id === costThree) as { cost: number }).cost).toBe(3);
  });

  it("WHEN REVEALED: with no upgrade in play the top card of the revealer's deck is tucked under it", () => {
    const s = game(1);
    const top = playerOf(s, P1).deck[0]!;
    const run = dealtPhase(s, firstLegal, "50119");
    const id = instanceOf(run.state, "50119");
    expect(inst(run.state, id).tucked).toEqual([top]);
    expect(playerOf(run.state, P1).deck).not.toContain(top);
    expect(playerOf(run.state, P1).discard).not.toContain(top);
  });

  it("WHEN REVEALED: an upgrade the revealer controls is tucked instead of the deck's top card", () => {
    const s = game(1);
    const upgrade = playerOf(s, P1).deck.find((i) => codeOf(s, i) === "01065")!;
    const hero = identityOf(s, P1);
    const staged: GameState = {
      ...patchInstance(patchInstance(s, upgrade, { attachedTo: hero, controllerId: P1 }), hero, {
        attachments: [...inst(s, hero).attachments, upgrade],
      }),
      players: s.players.map((p) => ({
        ...p,
        deck: p.deck.filter((i) => i !== upgrade),
        playArea: [...p.playArea, upgrade],
      })),
    };
    const top = playerOf(staged, P1).deck[0]!;
    const run = dealtPhase(staged, firstLegal, "50119");
    expect(inst(run.state, instanceOf(run.state, "50119")).tucked).toEqual([upgrade]);
    expect(playerOf(run.state, P1).playArea).not.toContain(upgrade);
    expect(playerOf(run.state, P1).deck[0]).toBe(top);
  });

  it("CONSTANT: X is the printed cost of the tucked card (3): +3 ATK, +3 SCH on M.O.D.O.K.", () => {
    const { state } = engineered();
    expect(statBonus(state, DEPS, villainOf(state), "atk")).toBe(3);
    expect(statBonus(state, DEPS, villainOf(state), "sch")).toBe(3);
  });

  it("REVEALED: attached to M.O.D.O.K. with the deck's top card (cost 3) tucked: +3 ATK, +3 SCH", () => {
    const s = game(1);
    const top = playerOf(s, P1).deck[0]!;
    const run = dealtPhase(patchInstance(s, top, { cardId: costThree as never }), firstLegal, "50119");
    const id = instanceOf(run.state, "50119");
    expect(inst(run.state, id).attachedTo).toBe(villainOf(run.state));
    expect(inst(run.state, id).tucked).toEqual([top]);
    expect(statBonus(run.state, DEPS, villainOf(run.state), "atk")).toBe(3);
    expect(statBonus(run.state, DEPS, villainOf(run.state), "sch")).toBe(3);
  });

  it("CONSTANT: with nothing tucked here X is 0", () => {
    const { state } = attachTo(game(1), "50119");
    expect(statBonus(state, DEPS, villainOf(state), "atk")).toBe(0);
  });

  it("FORCED RESPONSE: after the reset it is discarded and the tucked card goes to its owner's discard pile", () => {
    const { state: staged, id, top } = engineered();
    const state = defeatWithAttack(DEPS, staged, villainOf(staged));
    expect(attachedCodes(state, villainOf(state))).not.toContain("50119");
    expect(inEncounterDiscard(state, id)).toBe(true);
    expect(playerOf(state, P1).discard).toContain(top);
  });
});

describe("the reset discards every attachment that answers it, and only those", () => {
  it("50114, 50115, 50116, 50118 and 50119 leave; 50117 stays; M.O.D.O.K. is not defeated", () => {
    let state = game(2);
    for (const code of ["50114", "50115", "50116", "50117", "50118", "50119"]) state = attachTo(state, code).state;
    expect(attachedCodes(state, villainOf(state)).sort()).toEqual(
      ["50114", "50115", "50116", "50117", "50118", "50119"].sort(),
    );
    const after = defeatWithAttack(DEPS, state, villainOf(state));
    expect(attachedCodes(after, villainOf(after))).toEqual(["50117"]);
    // Q3 = A: reset to 10 of 15, then Automated Mobile Unit's +5 leaves with the others: 5 remaining of 10.
    expect([maxHitPoints(after, villainOf(after), DEPS), remainingHitPoints(after, villainOf(after), DEPS)]).toEqual([
      10, 5,
    ]);
    expect(lock(after, cellOf(state))).toBe(2);
    expect(after.villains[0]!.defeated).toBe(false);
    expect(after.outcome).toBeNull();
  });

  it("with no Holding Cell in play the players win and the attachments are not discarded (no reset)", () => {
    let state = allFreed();
    state = attachTo(state, "50115").state;
    const won = defeatWithAttack(DEPS, ready(state), villainOf(state));
    expect(won.outcome).toMatchObject({ result: "win" });
  });
});

/** The cells freed one by one, each ally going to the player named (in order); returns the allies in the same order. */
function withFreedAllies(state: GameState, ...freers: readonly PlayerId[]): { state: GameState; allies: InstanceId[] } {
  const allies: InstanceId[] = [];
  let current = state;
  for (const freer of freers) {
    const freed = freeTopCell(current, freer);
    current = freed.state;
    allies.push(freed.ally);
  }
  return { state: current, allies };
}
/** Declines every defender prompt; anything else as `firstLegal` (or as `then` when given). */
const undefended =
  (then: Picker = firstLegal): Picker =>
  (s) =>
    s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : then(s);
const attackedBy = (state: GameState, events: readonly import("@mc/engine").GameEvent[], code: string) =>
  attacksBy(state, events, code);

describe("A.I.M. Jailer (50120)", () => {
  /** The Jailer is dealt to P1 (the villain stunned, no Adaptoid): `stack` after it supplies the second player's card and the boost. */
  const reveal = (s: GameState, pick: Picker = undefended()) => dealtPhase(s, pick, "50120", HARMLESS, FILL);
  /** The same phase with a harmless card dealt instead of the Jailer: what the heroes take from M.O.D.O.K. alone. */
  const baseline = (s: GameState) => dealtPhase(s, undefended(), HARMLESS, "50121").state;

  it("data: ATK 2, SCH 0, 4 hit points, A.I.M., Guard, 1 boost icon, two copies in the set", () => {
    const card = dataFor("50120");
    expect([card.type, card.atk, card.sch, card.hp, card.boostIcons, card.quantityInSet]).toEqual([
      "minion",
      2,
      0,
      4,
      1,
      2,
    ]);
    expect([card.traits, card.keywords]).toEqual([["A.I.M."], [{ name: "guard" }]]);
  });

  it("WHEN REVEALED: attacks the Rescued ally with the fewest remaining hit points (5 and 3): 2 damage on it, none on its controller's hero", () => {
    const base = withFreedAllies(game(2), P1, P2);
    const [a, b] = base.allies as [InstanceId, InstanceId];
    const staged = patchInstance(base.state, b, { damage: 2 });
    const { state, events } = reveal(staged);
    const jailer = inPlayCodes(state, "50120")[0]!;
    expect(inst(state, jailer).engagedWith).toBe(P1);
    const [attack] = attackedBy(state, events, "50120");
    expect([attack!.targetInstanceId, attack!.baseAtk, attack!.boostIcons, attack!.damageDealt]).toEqual([b, 2, 0, 2]);
    expect(inst(state, b).damage).toBe(4);
    expect(inst(state, a).damage).toBe(0);
    // Neither hero takes more than M.O.D.O.K.'s own activation dealt (P2's undefended 1).
    const alone = baseline(staged);
    for (const p of [P1, P2])
      expect(inst(state, identityOf(state, p)).damage).toBe(inst(alone, identityOf(alone, p)).damage);
  });

  it("a tie for the fewest: the first player chooses (P1's ally, or P2's)", () => {
    const base = withFreedAllies(game(2), P1, P2);
    const [a, b] = base.allies as [InstanceId, InstanceId];
    const first = reveal(base.state, undefended(picking(a)));
    expect(attackedBy(first.state, first.events, "50120").map((e) => e.targetInstanceId)).toEqual([a]);
    const second = reveal(base.state, undefended(picking(b)));
    expect(attackedBy(second.state, second.events, "50120").map((e) => e.targetInstanceId)).toEqual([b]);
  });

  it("the attacked ally is defeated by 2 damage with 1 left, and no excess reaches its controller (no overkill)", () => {
    const base = withFreedAllies(game(2), P1, P2);
    const [, b] = base.allies as [InstanceId, InstanceId];
    const { state } = reveal(patchInstance(base.state, b, { damage: 4 }));
    const alone = baseline(patchInstance(base.state, b, { damage: 4 }));
    expect(inst(state, identityOf(state, P2)).damage).toBe(inst(alone, identityOf(alone, P2)).damage);
    // A defeated Inhuman goes back under the Holding Cell deck as a cell (Forced Response of the ally).
    expect(inPlayCodes(state, codeOf(state, b))).not.toContain(b);
  });

  it("OTHERWISE: with no Rescued ally in play, 1 lock counter goes on the Holding Cell (4 -> 5) and nobody is attacked", () => {
    const s = game(2);
    const cell = cellOf(s);
    const { state, events } = reveal(s);
    expect(lock(state, cell)).toBe(5);
    expect(attackedBy(state, events, "50120")).toEqual([]);
    expect(inst(state, inPlayCodes(state, "50120")[0]!).engagedWith).toBe(P1);
  });

  it("a Rescued ally that a hero has not freed (the Holding Cell itself) is not a Rescued ally: the cell is never attacked", () => {
    const s = game(1);
    const cell = cellOf(s);
    const { state } = dealtPhase(s, undefended(), "50120", FILL);
    expect(inst(state, cell).damage).toBe(0);
    expect(lock(state, cell)).toBe(3);
  });

  it("BOOST: 1 icon, no ability: the Jailer adds 1 damage to the villain's attack", () => {
    const s = withoutAdaptoids(game(1));
    const { state, events } = villainPhase(s, undefended(), "50120", HARMLESS);
    const [attack] = attackedBy(state, events, "50103a");
    expect([attack!.baseAtk, attack!.boostIcons, attack!.damageDealt]).toEqual([1, 1, 2]);
  });
});

describe("Hostage Situation (50121)", () => {
  /** Hostage Situation dealt to P1, revealed in a phase with nothing else going on. */
  const reveal = (s: GameState, pick: Picker = firstLegal) => dealtPhase(s, pick, "50121", HARMLESS);
  const scheme = (s: GameState) => s.villainArea.find((i) => codeOf(s, i) === "50121")!;
  /** A picker that answers a target prompt with `ally`, noting who was asked to choose among which cards. */
  const choosing = (ally: InstanceId, asked: { player: PlayerId; among: InstanceId[] }[] = []): Picker => {
    const pick = picking(ally);
    return (s) => {
      const choice = s.pendingChoice!;
      if (choice.prompt.kind === "chooseTarget")
        asked.push({
          player: choice.playerId,
          among: choice.options.flatMap((o) => (o.ref.kind === "card" ? [o.ref.instanceId] : [])),
        });
      return pick(s);
    };
  };
  /** The scheme's threat set to 1, so one basic thwart defeats it. */
  const nearlyDone = (s: GameState) => patchInstance(s, scheme(s), { threat: 1 });
  const activeOf = (s: GameState) => (s.step as { activePlayerId: PlayerId }).activePlayerId;

  it("data: a side scheme with 0 + 3 per player threat, no icons, 2 boost icons, no keywords", () => {
    const card = dataFor("50121");
    expect([card.type, card.startingThreat, card.icons, card.boostIcons, card.keywords, card.quantityInSet]).toEqual([
      "side_scheme",
      { base: 0, perPlayer: 3 },
      [],
      2,
      [],
      1,
    ]);
  });

  it("starts with 3 threat per player: 6 at two players, 3 at one", () => {
    for (const [players, threat] of [
      [2, 6],
      [1, 3],
    ] as const) {
      const { state } = reveal(game(players));
      expect(inst(state, scheme(state)).threat).toBe(threat);
    }
  });

  it("CONSTANT: M.O.D.O.K. cannot take damage: an attack deals 0, nothing resets, no lock counter is removed", () => {
    const { state: revealed } = reveal(game(2));
    const cell = cellOf(revealed);
    // After the villain phase the first player token has passed: the active player is whoever's turn it is.
    const active = (revealed.step as { activePlayerId: PlayerId }).activePlayerId;
    const staged = patchInstance(revealed, villainOf(revealed), { damage: 9 });
    const { state } = heroAttacks(DEPS, staged, villainOf(staged), { player: active });
    expect(inst(state, villainOf(state)).damage).toBe(9);
    expect(lock(state, cell)).toBe(lock(revealed, cell));
    expect(state.villains[0]!.defeated).toBe(false);
    expect(state.outcome).toBeNull();
  });

  it("CONSTANT: only while the scheme is in play: without it the same attack deals damage", () => {
    const s = patchInstance(game(2), villainOf(game(2)), { damage: 0 });
    const { state } = heroAttacks(DEPS, s, villainOf(s));
    expect(inst(state, villainOf(state)).damage).toBeGreaterThan(0);
  });

  it("WHEN REVEALED, no Rescued ally in play: nothing is attached, nobody is asked, the scheme stays with its 6 threat", () => {
    const asked: { player: PlayerId; among: InstanceId[] }[] = [];
    const { state, events } = reveal(game(2), choosing("none" as InstanceId, asked));
    expect(cardsInPlay(state)).toContain(scheme(state));
    expect(inst(state, scheme(state)).attachments).toEqual([]);
    expect(inst(state, scheme(state)).threat).toBe(6);
    expect(asked).toEqual([]);
    expect(events.filter((e) => e.type === "controlReleased")).toEqual([]);
    // The card prints no alternative and no surge: the two dealt cards are the only ones revealed.
    expect(events.filter((e) => e.type === "encounterCardRevealed")).toHaveLength(2);
  });

  it("WHEN REVEALED, one Rescued ally (P2's, with 2 damage): attached faceup, in play, under no player's control", () => {
    const base = withFreedAllies(game(2), P2);
    const [b] = base.allies as [InstanceId];
    const { state, events } = reveal(patchInstance(base.state, b, { damage: 2 }));
    const hostage = inst(state, b);
    expect([hostage.attachedTo, hostage.controllerId, hostage.faceup, hostage.damage]).toEqual([
      scheme(state),
      null,
      true,
      2,
    ]);
    expect(inst(state, scheme(state)).attachments).toEqual([b]);
    expect(cardsInPlay(state)).toContain(b);
    expect(isCaptiveAlly(state, b)).toBe(true);
    for (const p of [P1, P2]) expect(playerOf(state, p).playArea).not.toContain(b);
    expect(events.filter((e) => e.type === "controlReleased")).toEqual([
      { type: "controlReleased", instanceId: b, hostInstanceId: scheme(state), from: P2 },
    ]);
    // It did not leave play: it is not back under the Holding Cell deck.
    expect(deckOf(state)).not.toContain(b);
  });

  it("WHEN REVEALED, several Rescued allies: the first player (P1) chooses among them, whoever controls them", () => {
    const base = withFreedAllies(game(2), P1, P2);
    const [a, b] = base.allies as [InstanceId, InstanceId];
    expect(base.state.firstPlayerId).toBe(P1);
    for (const [taken, kept, keeper] of [
      [a, b, P2],
      [b, a, P1],
    ] as const) {
      const asked: { player: PlayerId; among: InstanceId[] }[] = [];
      const { state } = reveal(base.state, choosing(taken, asked));
      expect(asked).toEqual([{ player: P1, among: expect.arrayContaining([a, b]) }]);
      expect(asked[0]!.among).toHaveLength(2);
      expect(inst(state, scheme(state)).attachments).toEqual([taken]);
      expect(inst(state, taken).controllerId).toBeNull();
      expect(inst(state, kept).controllerId).toBe(keeper);
      expect(inst(state, kept).attachedTo).toBeNull();
    }
  });

  it("the hostage is nobody's: no legal action names it, and its old controller's attack and thwart with it are refused", () => {
    const base = withFreedAllies(game(2), P1, P2);
    const [a, b] = base.allies as [InstanceId, InstanceId];
    const { state } = reveal(base.state, choosing(a));
    const active = activeOf(state);
    const names = (id: InstanceId) => JSON.stringify(legalActions(state, active, DEPS)).includes(`"${id}"`);
    const mine = active === P1 ? a : b;
    // With `a` held, the active player's own ally is offered only if it is not the hostage.
    expect(names(a)).toBe(false);
    if (mine !== a) expect(names(mine)).toBe(true);
    for (const playerId of [P1, P2]) {
      expect(
        applyCommand(
          state,
          { type: "basicAttack", playerId, attackerInstanceId: a, targetInstanceId: villainOf(state) },
          DEPS,
        ).ok,
      ).toBe(false);
      expect(
        applyCommand(
          state,
          { type: "basicThwart", playerId, thwarterInstanceId: a, schemeInstanceId: state.mainScheme.instanceId },
          DEPS,
        ).ok,
      ).toBe(false);
    }
  });

  it("A.I.M. Jailer does not attack the hostage (no player to attack): with no other Rescued ally, the Otherwise places 1 lock counter", () => {
    const base = withFreedAllies(game(1), P1);
    const [a] = base.allies as [InstanceId];
    const taken = dealtPhase(base.state, firstLegal, "50121").state;
    expect(inst(taken, a).controllerId).toBeNull();
    const cell = cellOf(taken);
    const before = lock(taken, cell);
    const { state, events } = dealtPhase(taken, undefended(), "50120", FILL);
    expect(attackedBy(state, events, "50120")).toEqual([]);
    expect(inst(state, a).damage).toBe(0);
    expect(lock(state, cell)).toBe(before + 1);
  });

  it("WHEN DEFEATED: the defeating player takes control of the attached ally; it stays in play with its damage, ready as it was", () => {
    const base = withFreedAllies(game(2), P2);
    const [b] = base.allies as [InstanceId];
    const taken = nearlyDone(reveal(patchInstance(base.state, b, { damage: 2 })).state);
    const hostage = scheme(taken);
    const defeater = activeOf(taken);
    expect(inst(taken, b).exhausted).toBe(false);
    const { state, events } = heroThwarts(DEPS, taken, hostage, { player: defeater });
    expect(cardsInPlay(state)).not.toContain(hostage);
    expect(inst(state, b).attachedTo).toBeNull();
    expect(inst(state, b).controllerId).toBe(defeater);
    expect(playerOf(state, defeater).playArea).toContain(b);
    expect([inst(state, b).damage, inst(state, b).exhausted]).toEqual([2, false]);
    expect(cardsInPlay(state)).toContain(b);
    expect(events.filter((e) => e.type === "controllerChanged")).toEqual([
      { type: "controllerChanged", instanceId: b, from: null, to: defeater, reason: "effect" },
    ]);
    // Its new controller can use it at once.
    expect(JSON.stringify(legalActions(state, defeater, DEPS)).includes(`"${b}"`)).toBe(true);
  });

  it("WHEN DEFEATED by the other player: they take control, though another player freed the ally; taken exhausted, it is handed over exhausted", () => {
    const base = withFreedAllies(game(2), P1, P2);
    const [a, b] = base.allies as [InstanceId, InstanceId];
    const revealed = reveal(base.state, choosing(a)).state;
    const first = activeOf(revealed);
    const second = first === P1 ? P2 : P1;
    const taken = nearlyDone(patchInstance(revealed, a, { exhausted: true }));
    const atSecond = driveEventsPicking(DEPS, taken, firstLegal, endTurn(first)).state;
    const { state } = heroThwarts(DEPS, atSecond, scheme(atSecond), { player: second });
    expect(inst(state, a).controllerId).toBe(second);
    expect(inst(state, a).exhausted).toBe(true);
    expect(playerOf(state, second).playArea).toContain(a);
    expect(playerOf(state, first).playArea).not.toContain(a);
    expect(inst(state, b).attachedTo).toBeNull();
  });

  it("WHEN DEFEATED with nothing attached: nothing happens beyond the defeat", () => {
    const { state: withScheme, id: hostage } = encounterCardInVillainArea(game(2), "50121", 1);
    const { state } = heroThwarts(DEPS, withScheme, hostage, { player: P1 });
    expect(cardsInPlay(state)).not.toContain(hostage);
  });
});

describe("Psionic Enhancement (50122)", () => {
  it("data: a side scheme with 3 threat, 1 amplify icon, Hinder 1 per hero, a star and 1 boost icon", () => {
    const card = dataFor("50122");
    expect([
      card.type,
      card.startingThreat,
      card.amplifyIcons,
      card.boostIcons,
      card.starIcon,
      card.quantityInSet,
    ]).toEqual(["side_scheme", { base: 3, perPlayer: 0 }, 1, 1, true, 1]);
    expect(card.keywords).toEqual([{ name: "hinder", value: 0, perPlayer: 1 }]);
  });

  it("revealed it enters play with its 3 threat plus Hinder 1 per hero (2 players: 3 + 2)", () => {
    const { state } = dealtPhase(game(2), firstLegal, "50122", "50121");
    const scheme = state.villainArea.find((i) => codeOf(state, i) === "50122")!;
    expect(inst(state, scheme).threat).toBe(5);
    const solo = dealtPhase(game(1), firstLegal, "50122");
    expect(
      inst(
        solo.state,
        solo.state.villainArea.find((i) => codeOf(solo.state, i) === "50122")!,
      ).threat,
    ).toBe(4);
  });

  it("BOOST: the activating enemy gets an additional boost card: two cards flip (1 icon + the next card's 3), 1 + 1 + 3 damage", () => {
    const s = withoutAdaptoids(game(1));
    // "It's Alive!" (3 boost icons, a treachery with a When Revealed) is only flipped as a boost card here.
    const { state, events } = villainPhase(s, undefended(), "50122", "50123", "50121");
    const flipped = types(events, "boostCardFlipped").map((e) => [codeOf(state, e.instanceId), e.boostIcons]);
    expect(flipped).toEqual([
      ["50122", 1],
      ["50123", 3],
    ]);
    const [attack] = attacksBy(state, events, "50103a");
    expect([attack!.baseAtk, attack!.boostIcons, attack!.damageDealt]).toEqual([1, 4, 5]);
    // Boost cards are discarded, never revealed: "It's Alive!" did not search.
    expect(piles(state).discard.map((i) => codeOf(state, i))).toEqual(expect.arrayContaining(["50122", "50123"]));
  });

  it("without it a boost card flips alone", () => {
    const s = withoutAdaptoids(game(1));
    const { state, events } = villainPhase(s, undefended(), FILL, HARMLESS);
    expect(types(events, "boostCardFlipped")).toHaveLength(1);
    expect(attacksBy(state, events, "50103a")[0]!.boostIcons).toBe(0);
  });

  it("BOOST on a scheme activation (alter-ego): the additional boost card counts for the scheme as well", () => {
    const s = withForm(withoutAdaptoids(game(1)), "alterEgo", P1);
    const { state, events } = villainPhase(s, firstLegal, "50122", "50123", "50121");
    const [scheme] = schemesBy(state, events, "50103a");
    expect([scheme!.baseSch, scheme!.boostIcons]).toEqual([2, 4]);
  });
});

describe('"It\'s Alive!" (50123)', () => {
  /**
   * Only `kept` Adaptoids stay in the game (the rest removed), none in play; it is dealt to P1 and, with two players,
   * a harmless card to P2.
   */
  function search(players: number, kept: number, where: "deck" | "discard" = "deck", pick: Picker = firstLegal) {
    const base = withoutAdaptoids(game(players));
    const pile = piles(base);
    const all = [...pile.deck, ...pile.discard].filter((i) => codeOf(base, i) === "50113");
    const keep = new Set(all.slice(0, kept));
    const drop = new Set(all.slice(kept));
    const deck = pile.deck.filter((i) => !drop.has(i) && !(where === "discard" && keep.has(i)));
    const discard = [
      ...pile.discard.filter((i) => !drop.has(i)),
      ...(where === "discard" ? pile.deck.filter((i) => keep.has(i)) : []),
    ];
    const staged: GameState = {
      ...base,
      encounterDecks: { ...base.encounterDecks, [activeEncounterDeckId(base)]: { deck, discard } },
    };
    const stack = players === 2 ? ["50123", HARMLESS] : ["50123"];
    const run = villainPhase(stunned(staged, villainOf(staged)), pick, ...Array(players - 1).fill(FILL), ...stack);
    return { ...run, before: staged };
  }
  const engagedWith = (s: GameState, p: PlayerId) =>
    inPlayCodes(s, "50113").filter((i) => inst(s, i).engagedWith === p);
  const dealtTo = (s: GameState, p: PlayerId) => playerOf(s, p).dealtEncounter;
  /**
   * Encounter cards other than an Adaptoid that were put facedown in front of the player in this phase: the one the
   * villain phase deals each player (step 3), plus any "Deal ... a facedown encounter card" of the ability.
   */
  const dealtCount = (s: GameState, events: readonly import("@mc/engine").GameEvent[], p: PlayerId) =>
    types(events, "cardMoved").filter(
      (e) => e.to.kind === "dealtEncounter" && e.to.playerId === p && codeOf(s, e.instanceId) !== "50113",
    ).length;

  it("data: a treachery with 3 boost icons", () => {
    const card = dataFor("50123");
    expect([card.type, card.boostIcons, card.quantityInSet, card.keywords]).toEqual(["treachery", 3, 1, []]);
  });

  it("WHEN REVEALED (2 players, 4 Adaptoids available): each player finds one and it engages them; nobody is dealt a card", () => {
    const { state, events } = search(2, 4);
    expect([dealtCount(state, events, P1), dealtCount(state, events, P2)]).toEqual([1, 1]);
    expect(engagedWith(state, P1)).toHaveLength(1);
    expect(engagedWith(state, P2)).toHaveLength(1);
    expect(dealtTo(state, P1)).toEqual([]);
    expect(dealtTo(state, P2)).toEqual([]);
  });

  it("the search reaches the discard pile too: both Adaptoids in the discard pile are found", () => {
    const { state } = search(2, 2, "discard");
    expect(engagedWith(state, P1)).toHaveLength(1);
    expect(engagedWith(state, P2)).toHaveLength(1);
  });

  it("only one Adaptoid left: P1 engages it; P2, who engaged none, is dealt a facedown encounter card", () => {
    const { state, events } = search(2, 1);
    expect(engagedWith(state, P1)).toHaveLength(1);
    expect(engagedWith(state, P2)).toEqual([]);
    expect(dealtCount(state, events, P2)).toBe(2);
    expect(dealtCount(state, events, P1)).toBe(1);
  });

  it("no Adaptoid left at all: every player is dealt a facedown encounter card, none engages anything", () => {
    const { state, events } = search(2, 0);
    expect(engagedWith(state, P1)).toEqual([]);
    expect(engagedWith(state, P2)).toEqual([]);
    // The card the villain phase dealt, plus the one this ability dealt; a surge revealed from the second may add one more.
    expect(dealtCount(state, events, P1)).toBe(2);
    expect(dealtCount(state, events, P2)).toBeGreaterThanOrEqual(2);
  });

  it("one player, one Adaptoid: it engages them and nothing is dealt", () => {
    const { state, events } = search(1, 1);
    expect(engagedWith(state, P1)).toHaveLength(1);
    expect(dealtCount(state, events, P1)).toBe(1);
  });
});

describe("Psionic Blast (50124)", () => {
  const confusedOn = (s: GameState, id: InstanceId) => inst(s, id).statuses.confused;
  /** One player with a freed ally; the Blast dealt to P1 (the villain stunned, so it only draws what the Blast needs). */
  function blast(mode: Mode, pick: Picker, setup: (s: GameState, ally: InstanceId) => GameState = (s) => s) {
    // The Flying Inhuman (5 hit points, no toughness) is the top cell.
    const base = withFreedAllies(gameWithCell("50105a", 1, mode), P1);
    const [ally] = base.allies as [InstanceId];
    // Steady (expert) is stunned only with two stunned status cards.
    const staged = setup(ready(base.state), ally);
    const stunnedCards = mode === "expert" ? 2 : 1;
    const run = villainPhase(
      patchInstance(withoutAdaptoids(staged), villainOf(staged), {
        statuses: { stunned: stunnedCards, confused: 0, tough: 0 },
      }),
      pick,
      "50124",
    );
    // Freeing the cell took a blow at M.O.D.O.K.: the hero carries his Retaliate 1 already.
    return { ...run, ally, hero: identityOf(staged, P1), heroBefore: inst(staged, identityOf(staged, P1)).damage };
  }

  it("data: a treachery, 2 boost icons, two copies in the set", () => {
    const card = dataFor("50124");
    expect([card.type, card.boostIcons, card.quantityInSet, card.keywords]).toEqual(["treachery", 2, 2, []]);
  });

  it("HERO: X is M.O.D.O.K.'s SCH (2): 2 indirect damage split 1/1 between the hero and the ally, and each is confused", () => {
    let hero = "" as InstanceId;
    const prompts: number[] = [];
    const run = blast("standard", (s) => {
      if (s.pendingChoice!.prompt.kind === "assignIndirectDamage") {
        prompts.push(s.pendingChoice!.prompt.amount);
        hero = identityOf(s, P1);
        const ally = s
          .pendingChoice!.options.map((o) => o.optionId)
          .find((o) => !o.startsWith(hero))!
          .split("#")[0]!;
        return [`${hero}#1`, `${ally}#1`];
      }
      return undefended()(s);
    });
    expect(prompts).toEqual([2]);
    expect([inst(run.state, hero).damage - run.heroBefore, inst(run.state, run.ally).damage]).toEqual([1, 1]);
    expect([confusedOn(run.state, hero), confusedOn(run.state, run.ally)]).toEqual([1, 1]);
  });

  it("HERO: all 2 on the ally: only the ally takes damage and is confused; the hero is not", () => {
    const run = blast("standard", (s) => {
      if (s.pendingChoice!.prompt.kind === "assignIndirectDamage") {
        const hero = identityOf(s, P1);
        const ally = s
          .pendingChoice!.options.map((o) => o.optionId)
          .find((o) => !o.startsWith(hero))!
          .split("#")[0]!;
        return [`${ally}#1`, `${ally}#2`];
      }
      return undefended()(s);
    });
    expect([inst(run.state, run.ally).damage, confusedOn(run.state, run.ally)]).toEqual([2, 1]);
    expect([inst(run.state, run.hero).damage - run.heroBefore, confusedOn(run.state, run.hero)]).toEqual([0, 0]);
  });

  it("HERO: a character whose damage a tough status absorbs takes none, so it is not confused", () => {
    const run = blast(
      "standard",
      (s) => {
        if (s.pendingChoice!.prompt.kind === "assignIndirectDamage") {
          const hero = identityOf(s, P1);
          const ally = s
            .pendingChoice!.options.map((o) => o.optionId)
            .find((o) => !o.startsWith(hero))!
            .split("#")[0]!;
          return [`${ally}#1`, `${hero}#1`];
        }
        return undefended()(s);
      },
      (s, ally) => withTough(s, ally),
    );
    expect([inst(run.state, run.ally).damage, toughOn(run.state, run.ally), confusedOn(run.state, run.ally)]).toEqual([
      0, 0, 0,
    ]);
    expect([inst(run.state, run.hero).damage - run.heroBefore, confusedOn(run.state, run.hero)]).toEqual([1, 1]);
  });

  it("HERO, expert: SCH 3 means 3 indirect damage", () => {
    const prompts: number[] = [];
    blast("expert", (s) => {
      if (s.pendingChoice!.prompt.kind === "assignIndirectDamage") prompts.push(s.pendingChoice!.prompt.amount);
      return undefended()(s);
    });
    expect(prompts).toEqual([3]);
  });

  it("HERO: X counts his attachments' SCH: Focusing Crystal (+1) makes it 3", () => {
    const prompts: number[] = [];
    const base = withFreedAllies(game(1), P1);
    const staged = attachTo(ready(base.state), "50115").state;
    dealtPhase(
      staged,
      (s) => {
        if (s.pendingChoice!.prompt.kind === "assignIndirectDamage") prompts.push(s.pendingChoice!.prompt.amount);
        return undefended()(s);
      },
      "50124",
    );
    expect(prompts).toEqual([3]);
  });

  it("ALTER-EGO: you are confused and M.O.D.O.K. schemes (SCH 2 + the boost card's 1 icon = 3 threat on the main scheme)", () => {
    const s = withForm(withoutAdaptoids(game(1)), "alterEgo", P1);
    const hero = identityOf(s, P1);
    // The villain's own activation (a scheme: the player is in alter-ego form) takes the first filler as its boost;
    // the Blast is dealt, its scheme draws the one-icon boost card.
    const { state, events } = villainPhase(s, firstLegal, FILL, "50124", "01188");
    const schemes = schemesBy(state, events, "50103a");
    expect(schemes).toHaveLength(2);
    expect([schemes[1]!.baseSch, schemes[1]!.boostIcons, schemes[1]!.threatPlaced]).toEqual([2, 1, 3]);
    expect(confusedOn(state, hero)).toBe(1);
  });
});
