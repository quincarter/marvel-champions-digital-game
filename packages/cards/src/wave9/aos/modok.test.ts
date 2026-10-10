import { AOS_CARDS, CORE_CARDS } from "@mc/content";
import {
  activeEncounterDeckId,
  createGame,
  hasKeyword,
  keywordsOf,
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
import { defeatWithAttack, driveEventsPicking, withForm } from "../../testing/staging.js";
import { WAVE8_ABILITIES } from "../../wave8/index.js";
import {
  BLANK,
  IRON_MAN,
  ONE_ICON,
  SPIDER_MAN,
  codeOf,
  dataOf,
  heroAttacks,
  onlyDeck,
  picking,
  piles,
  types,
} from "../testing.js";
import { wave9Scenario } from "../setup.js";
import { MODOK, MODOK_SKIPPED } from "./modok.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * M.O.D.O.K. (docs/phase7-wave9.md sections 2.4, 3.5, 3.6, 3.15, 3.17, 3.18), first half: the villain 50103a/b, the main
 * scheme 50104a/b, the four Holding Cells 50105a to 50108a with their allies 50105b to 50108b, the Adaptoid upgrades
 * 50109 to 50112 and the Adaptoid 50113. The real `modok` scenario (Spider-Man and Iron Man preconstructed decks from
 * Core), every seat in hero form.
 */
const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE8_ABILITIES, MODOK) };
const SEATS = [SPIDER_MAN, IRON_MAN] as const;
const SECOND_HALF = ["50114", "50115", "50116", "50117", "50118", "50119", "50120", "50121", "50122", "50123", "50124"];
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
  it("registers every ref of the first half, each a valid definition; the second half is skipped with a reason", () => {
    expect(Object.keys(MODOK).sort()).toEqual([...REGISTERED].sort());
    for (const [id, def] of Object.entries(MODOK)) expect(validateDefinition(def), id).toEqual([]);
    const skipped = SECOND_HALF.flatMap((code) => abilityRefIds(AOS_CARDS.find((c) => c.id === code)!));
    expect(Object.keys(MODOK_SKIPPED).sort()).toEqual([...skipped].sort());
    for (const reason of Object.values(MODOK_SKIPPED)) expect(reason).toBe("second half of the module, not started");
  });

  it("the data names exactly the registered refs for the first half's cards", () => {
    const ids = AOS_CARDS.filter((c) => /^5010[3-9]|^5011[0-3]/.test(c.id)).map((c) => c.id);
    const refs = ids.flatMap((id) => abilityRefIds(AOS_CARDS.find((c) => c.id === id)!));
    expect([...new Set(refs)].sort()).toEqual([...REGISTERED].sort());
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

  it.todo(
    "Q3 = A (docs/phase7-wave9.md section 4.1): with the '+5 hit points' attachment 50114 on him, his hit points reset to 10, then the attachment leaves and he drops to 5 (second half of the module)",
  );
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
