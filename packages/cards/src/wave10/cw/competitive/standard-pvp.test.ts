import { CORE_CARDS, CW_CARDS, CW_ENCOUNTER_SETS, CORE_ENCOUNTER_SETS, CW_SCENARIOS } from "@mc/content";
import { validateScenarioEncounterSets } from "@mc/content";
import {
  activeEncounterDeckId,
  applyCommand,
  createGame,
  resolveValue,
  type AbilityDefinition,
  type GameEvent,
  type GameState,
  type InstanceId,
} from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { competitiveOnlyTexts, validateDefinition } from "../../../dsl/validate.js";
import { modularPickProblem } from "../../../modular-pool.js";
import { P1, endTurn, firstLegal, inst, settle, stackEncounterDeck, use } from "../../../testing/harness.js";
import { driveEventsPicking, encounterCardInVillainArea } from "../../../testing/staging.js";
import {
  BLANK,
  CAPTAIN_MARVEL,
  FILLER_A,
  FILLER_B,
  ONE_ICON,
  IRON_MAN,
  SHE_HULK,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  flippedBoosts,
  heroAttacks,
  heroForm,
  schemesBy,
  types,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS } from "../../testing.js";
import { COMPETITIVE_STANDARD_PVP, COMPETITIVE_STANDARD_PVP_SKIPPED } from "./standard-pvp.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The engine's two-team fixture (`twoTeamState`) is a test-only module of the engine package: `@mc/engine` does not
 * export it, and a static import by path would put engine files outside this package's `rootDir` and break its
 * typecheck. It is loaded by a computed path instead, typed here by what is used.
 */
const TEAM_FIXTURE = new URL("../../../../../engine/src/testing/team.ts", import.meta.url).href;
interface TwoTeamFixture {
  readonly twoTeamState: (options?: {
    readonly sizes?: readonly [number, number];
    readonly seed?: number;
  }) => GameState;
  readonly LEADER_ONE: { readonly id: string };
  readonly LEADER_TWO: { readonly id: string };
}
const fixture = (await import(/* @vite-ignore */ TEAM_FIXTURE)) as TwoTeamFixture;
const { LEADER_ONE, LEADER_TWO, twoTeamState } = fixture;

/**
 * The Civil War Standard PvP set (MC56 pp. 3, 4, 14, 16; docs/competitive-mode-plan.md sections 1.6, 2.1, 4 tasks 10
 * and 13). The set replaces the Standard set only in competitive play, which `createGame` refuses, and every scenario
 * record refuses the set, so none of these cards can appear in a real game. The tests run at the levels the engine
 * allows:
 *
 * - registry: every ref registered once per printing, valid, and the marker sentences pinned;
 * - the cooperative guard: scenario records, modular picks and the engine's mode refusal;
 * - two-team values: the script's own "players on your team" read on the engine's two-team fixture;
 * - STAGED: this card cannot appear cooperatively. A Core Rhino game with the card put into the encounter deck by
 *   hand, showing what the cooperative reading of MC56 p. 6 does ("the enemy leader" is the villain, "the enemy team"
 *   is the players, "your leader" cannot be resolved).
 *
 * Missing from the fixture, so not tested: a resolving ability in a two-team state (the fixture has no main scheme
 * and no card pool for Civil War cards) and the leader-versus-leader attack.
 */
const PRINTINGS = [
  { name: "registration", rc: "56125", wit: "56126", ts: "56127", cs: "56128a", nip: "56128b" },
  { name: "resistance", rc: "56203", wit: "56204", ts: "56205", cs: "56206a", nip: "56206b" },
] as const;
const REFS = [
  "56125.when-revealed",
  "56126.when-revealed-alter-ego",
  "56126.when-revealed-hero",
  "56127.when-revealed",
  "56127.boost",
  "56128a.choosing-sides-constant",
  "56128a.choosing-sides-forced-response",
  "56128b.now-its-personal-constant",
  "56128b.now-its-personal-action",
  "56203.when-revealed",
  "56204.when-revealed-alter-ego",
  "56204.when-revealed-hero",
  "56205.when-revealed",
  "56205.boost",
  "56206a.choosing-sides-constant",
  "56206a.choosing-sides-forced-response",
  "56206b.now-its-personal-constant",
  "56206b.now-its-personal-action",
];
const dataOf = (code: string) => CW_CARDS.find((c) => (c.id as string) === code)! as unknown as Record<string, unknown>;
const def = (ref: string): AbilityDefinition => COMPETITIVE_STANDARD_PVP[ref]!;

describe("registry", () => {
  it("registers the 18 refs, each a valid definition, and skips nothing", () => {
    expect(Object.keys(COMPETITIVE_STANDARD_PVP).sort()).toEqual([...REFS].sort());
    for (const [id, definition] of Object.entries(COMPETITIVE_STANDARD_PVP))
      expect(validateDefinition(definition), id).toEqual([]);
    expect(COMPETITIVE_STANDARD_PVP_SKIPPED).toEqual({});
  });

  it("the data names exactly these refs for the ten faces", () => {
    const codes = PRINTINGS.flatMap((p) => [p.rc, p.wit, p.ts, p.cs, p.nip]);
    const refs = codes.flatMap((code) => ((dataOf(code).abilities ?? []) as { id: string }[]).map((a) => a.id));
    expect(refs.sort()).toEqual([...REFS].sort());
  });

  it("the two printings are the same cards: one shared definition each", () => {
    const [a, b] = PRINTINGS;
    expect(def(`${b.rc}.when-revealed`)).toBe(def(`${a.rc}.when-revealed`));
    expect(def(`${b.wit}.when-revealed-hero`)).toBe(def(`${a.wit}.when-revealed-hero`));
    expect(def(`${b.wit}.when-revealed-alter-ego`)).toBe(def(`${a.wit}.when-revealed-alter-ego`));
    expect(def(`${b.ts}.when-revealed`)).toBe(def(`${a.ts}.when-revealed`));
    expect(def(`${b.ts}.boost`)).toBe(def(`${a.ts}.boost`));
    expect(def(`${b.cs}.choosing-sides-constant`)).toBe(def(`${a.cs}.choosing-sides-constant`));
    expect(def(`${b.cs}.choosing-sides-forced-response`)).toBe(def(`${a.cs}.choosing-sides-forced-response`));
    expect(def(`${b.nip}.now-its-personal-action`)).toBe(def(`${a.nip}.now-its-personal-action`));
  });

  it("carries the printed timing of each ability", () => {
    expect(def("56125.when-revealed").trigger).toMatchObject({ kind: "whenRevealed" });
    // The form is the first thing the script checks (whenRevealedHero / whenRevealedAlterEgo).
    expect(def("56126.when-revealed-hero").trigger).toMatchObject({ kind: "whenRevealed" });
    expect(def("56126.when-revealed-alter-ego").trigger).toMatchObject({ kind: "whenRevealed" });
    expect(def("56126.when-revealed-hero").effects[0]).toMatchObject({
      kind: "if",
      condition: { kind: "form", form: "hero" },
    });
    expect(def("56126.when-revealed-alter-ego").effects[0]).toMatchObject({
      kind: "if",
      condition: { kind: "form", form: "alterEgo" },
    });
    expect(def("56127.when-revealed").trigger).toMatchObject({ kind: "whenRevealed" });
    expect(def("56127.boost").trigger).toMatchObject({ kind: "boost" });
    expect(def("56128a.choosing-sides-constant").trigger).toMatchObject({ kind: "constant" });
    expect(def("56128a.choosing-sides-forced-response").trigger).toMatchObject({ kind: "response", forced: true });
    expect(def("56128b.now-its-personal-constant").trigger).toMatchObject({ kind: "constant" });
    expect(def("56128b.now-its-personal-action").trigger).toMatchObject({ kind: "action" });
  });

  it("competitiveOnlyTexts lists no sentence: every competitive one is scripted (M3, M6)", () => {
    const listed = Object.fromEntries(
      Object.entries(COMPETITIVE_STANDARD_PVP)
        .map(([ref, definition]) => [ref, competitiveOnlyTexts(definition)] as const)
        .filter(([, texts]) => texts.length > 0),
    );
    // The leader-versus-leader attack is scripted (M3), and so is Now It's Personal's reward (M6).
    expect(JSON.stringify(def("56126.when-revealed-alter-ego"))).toContain("enemyAttacksEnemy");
    expect(JSON.stringify(def("56128b.now-its-personal-action"))).toContain("yourLeadersCards");
    expect(listed).toEqual({});
  });

  it("Choosing Sides' cap names the villain (no query yet names a team's enemy leader): pinned so it is not forgotten", () => {
    const rule = (def("56128a.choosing-sides-constant").trigger as { rules?: unknown[] }).rules?.[0];
    expect(rule).toMatchObject({ kind: "maxDamageTakenPerAttack", amount: 2 });
    expect(JSON.stringify(rule)).toContain("villain");
  });
});

describe("the cooperative guard", () => {
  const sets = [...CORE_ENCOUNTER_SETS, ...CW_ENCOUNTER_SETS];
  const SET_IDS = ["standard_pvp_registration", "standard_pvp_resistance"];

  it("the data marks both printings competitive-only and every card carries its set", () => {
    for (const id of SET_IDS) expect(sets.find((s) => s.id === id)?.competitiveOnly, id).toBe(true);
    for (const p of PRINTINGS) {
      const setId = `standard_pvp_${p.name}`;
      for (const code of [p.rc, p.wit, p.ts, p.cs, p.nip])
        expect((dataOf(code).encounterSetIds as string[]).includes(setId), code).toBe(true);
    }
  });

  it("every scenario record refuses a set of the Standard PvP, as a standard set or in a modular pool", () => {
    for (const scenario of CW_SCENARIOS) {
      for (const id of SET_IDS) {
        const asStandard = validateScenarioEncounterSets({ ...scenario, standardEncounterSetIds: [id as never] }, sets);
        expect(
          asStandard.errors.some((e) => e.includes(`names competitive-only set ${id}; competitive mode is not built`)),
          `${scenario.id} ${id}`,
        ).toBe(true);
        const inPool = validateScenarioEncounterSets(
          { ...scenario, modularSetPool: { setIds: [id as never], count: 1 } as never },
          sets,
        );
        expect(inPool.errors.some((e) => e.includes(`modularSetPool names ${id}, which is not a modular set`))).toBe(
          true,
        );
      }
    }
  });

  it("a player cannot pick either printing as a modular set", () => {
    for (const scenario of CW_SCENARIOS)
      for (const id of SET_IDS) expect(modularPickProblem(scenario, id, sets), `${scenario.id} ${id}`).not.toBeNull();
  });

  it("createGame refuses competitive mode outright", () => {
    const config = coreScenario("rhino", { players: [SPIDER_MAN], seed: 1 } as never);
    const refused = createGame({ ...config, gameMode: "competitive" } as never, WAVE10_DEPS);
    expect(refused.ok).toBe(false);
    if (!refused.ok) expect(refused.error.code).toBe("mode_unavailable");
  });
});

describe("two-team values (the engine's fixture)", () => {
  // The script's own count of "players on your team", resolved for a seat of each team.
  const count = (state: GameState, seat: "p1" | "p2" | "p3" | "p4") =>
    resolveValue(state, PLAYERS_ON_TEAM, {
      selfInstanceId: null,
      controllerId: seat as never,
      event: null,
      bindings: {},
      deps: WAVE10_DEPS,
    });
  const condition = (def("56125.when-revealed").effects[0] as { condition: { left: unknown } }).condition;
  const PLAYERS_ON_TEAM = condition.left as never;

  it("Righteous Cause and Targeted Strike read the team of the player, not the table", () => {
    const state = twoTeamState({ sizes: [2, 1] });
    expect(count(state, "p1")).toBe(2);
    expect(count(state, "p2")).toBe(2);
    expect(count(state, "p3")).toBe(1);
    const other = twoTeamState({ sizes: [1, 2] });
    expect(count(other, "p1")).toBe(1);
    expect(count(other, "p3")).toBe(2);
    // Targeted Strike's boost reads the same value.
    const delta = (def("56127.boost").effects[0] as unknown as { delta: never }).delta;
    expect(
      resolveValue(state, delta, {
        selfInstanceId: null,
        controllerId: "p3" as never,
        event: null,
        bindings: {},
        deps: WAVE10_DEPS,
      }),
    ).toBe(1);
  });

  it("the fixture has two leaders, each in its own team's area", () => {
    const state = twoTeamState({ sizes: [2, 2] });
    expect(state.gameAreas).toHaveLength(2);
    expect(state.villains.map((v) => state.instances[v.instanceId]!.cardId)).toEqual([LEADER_ONE.id, LEADER_TWO.id]);
  });
});

// ---------------------------------------------------------------------------
// STAGED: this card cannot appear cooperatively. Core's Rhino game with the card in the encounter deck by hand.
// ---------------------------------------------------------------------------

const RHINO = "01094";
const CHARGE = "01099";
type Seat = typeof SPIDER_MAN | typeof CAPTAIN_MARVEL | typeof SHE_HULK | typeof IRON_MAN;

/** Rhino's game against Core decks with two copies of every PvP card in the encounter deck; everyone in hero form. */
function game(seats: readonly Seat[] = [SPIDER_MAN], form: "hero" | "alterEgo" = "hero"): GameState {
  const config = coreScenario("rhino", {
    players: seats,
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const codes: string[] = PRINTINGS.flatMap((p) => [p.rc, p.wit, p.ts, p.cs]);
  const copies = CW_CARDS.filter((c) => codes.includes(c.id as string)).flatMap((c) =>
    Array.from({ length: c.quantityInSet }, () => c.id),
  );
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...copies] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return form === "hero" ? heroForm(settled, ...settled.players.map((p) => p.playerId)) : settled;
}

/** Every player ends the turn and the villain phase runs on the stacked deck (top first), every choice the first legal. */
function villainPhase(state: GameState, stack: readonly string[]) {
  return driveEventsPicking(
    WAVE10_DEPS,
    stackEncounterDeck(state, ...stack),
    firstLegal,
    ...state.players.map((p) => endTurn(p.playerId)),
  );
}
const rhinoOf = (state: GameState): InstanceId => state.activeVillainId;
/** Cards behind the ones under test: none acts on its own, and none repeats beyond the copies a Rhino game holds. */
const BLANKS = [ONE_ICON, CHARGE, CHARGE, "01104"];

describe("STAGED Righteous Cause (56125, 56203): the enemy leader (Rhino) schemes; a second boost card with 2+ on the team", () => {
  // Control: the same phase with a filler where the card would be; the difference is the card's own scheme.
  for (const p of PRINTINGS) {
    it(`${p.name}: one player, Rhino schemes once with one boost card`, () => {
      const start = game([SPIDER_MAN]);
      const withCard = villainPhase(start, [BLANK, p.rc, ...BLANKS]);
      const control = villainPhase(start, [BLANK, FILLER_A, ...BLANKS]);
      expect(schemesBy(withCard.state, withCard.events, RHINO)).toHaveLength(1);
      expect(schemesBy(control.state, control.events, RHINO)).toHaveLength(0);
      expect(flippedBoosts(withCard.events).length - flippedBoosts(control.events).length).toBe(1);
    });
  }

  it("two players: Rhino schemes once with two boost cards (the additional one)", () => {
    const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
    const withCard = villainPhase(start, [BLANK, "01104", "56125", FILLER_A, ONE_ICON, CHARGE, CHARGE]);
    const control = villainPhase(start, [BLANK, "01104", FILLER_B, FILLER_A, ONE_ICON, CHARGE, CHARGE]);
    expect(schemesBy(withCard.state, withCard.events, RHINO)).toHaveLength(1);
    expect(flippedBoosts(withCard.events).length - flippedBoosts(control.events).length).toBe(2);
  });
});

describe("STAGED Whatever It Takes (56126, 56204): the Hero face attacks you; the Alter-Ego face needs your leader", () => {
  for (const p of PRINTINGS) {
    it(`${p.name}, hero form: Rhino attacks you, once more than the control`, () => {
      const start = game([SPIDER_MAN]);
      const withCard = villainPhase(start, [BLANK, p.wit, ...BLANKS]);
      const control = villainPhase(start, [BLANK, FILLER_A, ...BLANKS]);
      expect(attacksBy(withCard.state, withCard.events, RHINO)).toHaveLength(2);
      expect(attacksBy(control.state, control.events, RHINO)).toHaveLength(1);
      expect(schemesBy(withCard.state, withCard.events, RHINO)).toHaveLength(0);
    });

    it(`${p.name}, alter-ego form: "your leader" cannot be resolved, so nothing happens (MC56 p. 6)`, () => {
      const start = game([SPIDER_MAN], "alterEgo");
      const withCard = villainPhase(start, [BLANK, p.wit, ...BLANKS]);
      const control = villainPhase(start, [BLANK, FILLER_A, ...BLANKS]);
      expect(attacksBy(withCard.state, withCard.events, RHINO)).toHaveLength(0);
      // Rhino's own scheme activation is all that happened, as in the control.
      expect(schemesBy(withCard.state, withCard.events, RHINO)).toHaveLength(1);
      expect(schemesBy(control.state, control.events, RHINO)).toHaveLength(1);
      expect(flippedBoosts(withCard.events).length).toBe(flippedBoosts(control.events).length);
    });
  }
});

/** Runs `commands` and the choices after them first-legal, stopping at the enemy team's prompt (or the end). */
function untilEnemyTeamChoice(state: GameState, ...commands: Parameters<typeof applyCommand>[1][]) {
  let current = state;
  const events: GameEvent[] = [];
  const apply = (command: Parameters<typeof applyCommand>[1]): void => {
    const result = applyCommand(current, command, WAVE10_DEPS);
    if (!result.ok) throw new Error(`${command.type}: ${result.error.message}`);
    current = result.state;
    events.push(...result.events);
  };
  const settleChoices = (): void => {
    for (let guard = 0; guard < 200; guard++) {
      const choice = current.pendingChoice;
      if (!choice || choice.authority === "enemyTeam") return;
      apply({
        type: "resolveChoice",
        playerId: choice.playerId,
        choiceId: choice.choiceId,
        selectedOptionIds: firstLegal(current),
      });
    }
    throw new Error("choices did not settle");
  };
  for (const command of commands) {
    apply(command);
    settleChoices();
  }
  return { state: current, events };
}

/** Every player ends the turn on the stacked deck, up to the enemy team's prompt. */
function villainPhaseUntilEnemyTeamChoice(state: GameState, stack: readonly string[]) {
  const stacked = stackEncounterDeck(state, ...stack);
  return untilEnemyTeamChoice(stacked, ...stacked.players.map((p) => endTurn(p.playerId)));
}

/** Answers the pending choice with the option for the card with code `code`. */
function pickCard(state: GameState, code: string) {
  const choice = state.pendingChoice!;
  const option = choice.options.find((o) => o.ref.kind === "card" && codeOf(state, o.ref.instanceId) === code);
  if (!option) throw new Error(`no option for ${code}`);
  const picked = untilEnemyTeamChoice(state, {
    type: "resolveChoice",
    playerId: choice.playerId,
    choiceId: choice.choiceId,
    selectedOptionIds: [option.optionId],
  });
  return picked;
}
const optionCodes = (state: GameState): string[] =>
  state.pendingChoice!.options.map((o) => (o.ref.kind === "card" ? codeOf(state, o.ref.instanceId) : "?")).sort();

const encounterDeckOf = (state: GameState): readonly InstanceId[] =>
  state.encounterDecks[activeEncounterDeckId(state)]!.deck;

const TOP_FIVE = [FILLER_A, FILLER_B, CHARGE, ONE_ICON, BLANK];
const AFTER = ["01101", "01102"];

describe("STAGED Targeted Strike (56127, 56205)", () => {
  for (const p of PRINTINGS) {
    it(`${p.name}: the first player, as the enemy team, picks one of exactly the 5 cards under it; it is dealt to you`, () => {
      const start = game([SPIDER_MAN]);
      // Rhino's activation takes its boost card (BLANK) first; Targeted Strike is then revealed.
      const asked = villainPhaseUntilEnemyTeamChoice(start, [BLANK, p.ts, ...TOP_FIVE, ...AFTER]);
      expect(asked.state.pendingChoice).toMatchObject({ playerId: P1, authority: "enemyTeam" });
      expect(optionCodes(asked.state)).toEqual([...TOP_FIVE].sort());
      const picked = pickCard(asked.state, CHARGE);
      const revealed = types(picked.events, "encounterCardRevealed").map((e) => codeOf(picked.state, e.instanceId));
      // Dealt to the player facedown and revealed in this encounter step; none of the other four was.
      expect(revealed).toContain(CHARGE);
      for (const other of [FILLER_A, FILLER_B, ONE_ICON]) expect(revealed).not.toContain(other);
    });

    it(`${p.name}: the search of the top 5 shuffles the whole encounter deck once, after the card is dealt (RRG 1.8 "Search" p. 39)`, () => {
      const asked = villainPhaseUntilEnemyTeamChoice(game([SPIDER_MAN]), [BLANK, p.ts, ...TOP_FIVE, ...AFTER]);
      const before = encounterDeckOf(asked.state);
      const charge = before.find((id) => codeOf(asked.state, id) === CHARGE)!;
      const picked = pickCard(asked.state, CHARGE);
      const shuffles = types(picked.events, "deckShuffled");
      expect(shuffles).toHaveLength(1);
      expect(shuffles[0]!.zone.kind).toBe("encounterDeck");
      // Every card but the one dealt is in the shuffled deck, and it is no longer in the stacked order.
      const left = before.filter((id) => id !== charge);
      expect([...shuffles[0]!.order].sort()).toEqual([...left].sort());
      expect(shuffles[0]!.order).not.toEqual(left);
      const dealtAt = picked.events.findIndex(
        (e) => e.type === "cardMoved" && e.instanceId === charge && e.to.kind === "dealtEncounter",
      );
      expect(dealtAt).toBeGreaterThanOrEqual(0);
      expect(dealtAt).toBeLessThan(picked.events.findIndex((e) => e.type === "deckShuffled"));
    });

    it(`${p.name}: Boost, one player on the team: +1 boost icon on Rhino's attack`, () => {
      const run = villainPhase(game([SPIDER_MAN]), [p.ts, ...BLANKS]);
      expect(attacksBy(run.state, run.events, RHINO)[0]).toMatchObject({ boostIcons: 1 });
    });

    it(`${p.name}: Boost, two players on the team: +2 boost icons`, () => {
      const run = villainPhase(game([SPIDER_MAN, CAPTAIN_MARVEL]), [p.ts, ...BLANKS]);
      expect(attacksBy(run.state, run.events, RHINO)[0]).toMatchObject({ boostIcons: 2 });
    });
  }
});

describe("STAGED Choosing Sides (56128a, 56206a)", () => {
  for (const p of PRINTINGS) {
    it(`${p.name}: Rhino cannot take more than 2 damage from one attack (ATK 3 deals 2)`, () => {
      const start = encounterCardInVillainArea(game([SHE_HULK]), p.cs, 4).state;
      const attacked = heroAttacks(WAVE10_DEPS, start, rhinoOf(start));
      expect(inst(attacked.state, rhinoOf(start)).damage).toBe(2);
    });

    it(`${p.name}: a 1-damage attack (Iron Man, ATK 1) still deals 1`, () => {
      const start = encounterCardInVillainArea(game([IRON_MAN]), p.cs, 4).state;
      const attacked = heroAttacks(WAVE10_DEPS, start, rhinoOf(start));
      expect(inst(attacked.state, rhinoOf(start)).damage).toBe(1);
    });

    it(`${p.name}: control, without it She-Hulk's ATK 3 deals all 3`, () => {
      const start = game([SHE_HULK]);
      const attacked = heroAttacks(WAVE10_DEPS, start, rhinoOf(start));
      expect(inst(attacked.state, rhinoOf(start)).damage).toBe(3);
    });

    it(`${p.name}: the last threat removed searches the top 5 once, deals a different card to each of 2 players, and flips`, () => {
      const placed = encounterCardInVillainArea(game([SPIDER_MAN, CAPTAIN_MARVEL]), p.cs, 1);
      const start = stackEncounterDeck(placed.state, ...TOP_FIVE, ...AFTER);
      const asked = untilEnemyTeamChoice(start, {
        type: "basicThwart",
        playerId: P1,
        thwarterInstanceId: start.players[0]!.identity.instanceId,
        schemeInstanceId: placed.id,
      });
      // First pick, for the first player: all five.
      expect(asked.state.pendingChoice).toMatchObject({ playerId: P1, authority: "enemyTeam" });
      expect(optionCodes(asked.state)).toEqual([...TOP_FIVE].sort());
      const first = pickCard(asked.state, CHARGE);
      // Second pick, for the second player: the four left, Charge no longer among them.
      expect(first.state.pendingChoice).toMatchObject({ playerId: P1, authority: "enemyTeam" });
      expect(optionCodes(first.state)).toEqual([FILLER_A, FILLER_B, ONE_ICON, BLANK].sort());
      // No shuffle between the two picks: the second player's search reads what is left of the same five.
      expect(types([...asked.events, ...first.events], "deckShuffled")).toEqual([]);
      const before = encounterDeckOf(first.state);
      const second = pickCard(first.state, ONE_ICON);
      const dealt = second.state.players.map((pl) => pl.dealtEncounter.map((id) => codeOf(second.state, id)));
      expect(dealt).toEqual([[CHARGE], [ONE_ICON]]);
      // One shuffle of the whole deck when the search is done (RRG 1.8 "Search" p. 39).
      const shuffles = types(second.events, "deckShuffled");
      expect(shuffles).toHaveLength(1);
      expect(shuffles[0]!.zone.kind).toBe("encounterDeck");
      const left = before.filter((id) => !second.state.players[1]!.dealtEncounter.includes(id));
      expect(left).toHaveLength(before.length - 1);
      expect([...shuffles[0]!.order].sort()).toEqual([...left].sort());
      expect(shuffles[0]!.order).toEqual(encounterDeckOf(second.state));
      // Flipped to Now It's Personal.
      const flipped = types([...first.events, ...second.events], "cardFlippedToOtherFace");
      expect(flipped.map((e) => [e.from, e.to])).toEqual([[p.cs, p.nip]]);
    });
  }
});

describe("STAGED Now It's Personal (56128b, 56206b)", () => {
  // The Action is used on the card in a player's play area. Cooperatively "your leader" cannot be resolved, so the only
  // thing that happens is the removal from the game (MC56 p. 6).
  for (const p of PRINTINGS) {
    it(`${p.name}: Action removes the card from the game and adds nothing to any hand`, () => {
      const start = game([SPIDER_MAN, CAPTAIN_MARVEL]);
      const placed = encounterCardInVillainArea(start, p.cs, 0);
      const handsBefore = placed.state.players.map((pl) => pl.hand.length);
      const flippedState: GameState = {
        ...placed.state,
        instances: {
          ...placed.state.instances,
          [placed.id]: { ...placed.state.instances[placed.id]!, cardId: p.nip as never },
        },
      };
      const used = driveEventsPicking(
        WAVE10_DEPS,
        flippedState,
        firstLegal,
        use(P1, placed.id, `${p.nip}.now-its-personal-action`),
      );
      expect(used.state.removedFromGame).toContain(placed.id);
      expect(used.state.players.map((pl) => pl.hand.length)).toEqual(handsBefore);
    });
  }
});
