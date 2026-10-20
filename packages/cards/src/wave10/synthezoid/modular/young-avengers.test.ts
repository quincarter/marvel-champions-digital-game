import { CORE_CARDS, encounterSetId } from "@mc/content";
import { createGame, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../../../core/setup.js";
import { validateDefinition } from "../../../dsl/validate.js";
import { P1, endTurn, firstLegal, inst, patchInstance, settle, stackEncounterDeck } from "../../../testing/harness.js";
import { driveEventsPicking, withForm } from "../../../testing/staging.js";
import {
  BLANK,
  FILLER_A,
  FILLER_B,
  SPIDER_MAN,
  attacksBy,
  codeOf,
  inDiscard,
  inPlayCard,
  revealedCodes,
  tough,
} from "../../../wave9/testing.js";
import { WAVE10_CARDS } from "../../cards.js";
import { WAVE10_DEPS, engageMinion, stagedInPlay } from "../../testing.js";
import { SYNTHEZOID_MODULAR_YOUNG_AVENGERS, SYNTHEZOID_MODULAR_YOUNG_AVENGERS_SKIPPED } from "./young-avengers.js";

vi.setConfig({ testTimeout: 120_000 });

/**
 * The Young Avengers modular set (57055 Patriot, 57056 Hawkeye, 57057 Stature, 57058 Teenage Superheroes, 57059 Young
 * Avengers; docs/phase7-synthezoid.md section 8.3). Tested in Core's Rhino scenario with the set's cards added to the
 * encounter deck: there "the enemy leader" is Rhino (FFG ruling July 9, 2026 R3, M13).
 */
const PATRIOT = "57055";
const HAWKEYE = "57056";
const STATURE = "57057";
const TEENAGE = "57058";
const YOUNG = "57059";
const SHOCKER = "01103"; // Core minion, ATK 2, SCH 1 (it has a When Revealed; staged engaged it does not resolve)
const PLAIN = "01101"; // Core minion with Guard and no When Revealed
const REFS = [
  "57055.when-revealed",
  "57056.hawkeye-constant",
  "57056.when-revealed",
  "57057.when-revealed",
  "57058.when-revealed",
  "57059.young-avengers-constant",
];

type Loose = Record<string, unknown>;
const typeOfCode = (code: string): string =>
  (CORE_CARDS.find((c) => (c.id as string) === code) as unknown as Loose).type as string;

function game(): GameState {
  const config = coreScenario("rhino", {
    players: [SPIDER_MAN],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...WAVE10_CARDS],
  } as never);
  const set = WAVE10_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.includes(encounterSetId("young_avengers")),
  ).flatMap((c) => Array.from({ length: c.quantityInSet }, () => c.id));
  const created = createGame({ ...config, encounterDeck: [...config.encounterDeck, ...set] }, WAVE10_DEPS);
  if (!created.ok) throw new Error(created.error.message);
  const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE10_DEPS);
  return withForm(settled, { heroForm: 0 }, P1);
}
const villainPhase = (state: GameState, ...stack: readonly string[]) =>
  driveEventsPicking(WAVE10_DEPS, stackEncounterDeck(state, ...stack), firstLegal, endTurn(P1));
const villainOf = (s: GameState) => s.activeVillainId!;
const hero = (s: GameState) => s.players[0]!.identity.instanceId;
/** P1's first deck card of `type`, put into play under P1's control. */
function inPlay(state: GameState, type: string) {
  const owner = state.players.find((p) => p.playerId === P1)!;
  const code = [...owner.deck, ...owner.discard].map((i) => codeOf(state, i)).find((c) => typeOfCode(c) === type);
  if (!code) throw new Error(`no ${type} in the deck`);
  return stagedInPlay(state, code);
}
const discardedByP1 = (s: GameState) => s.players[0]!.discard;
const attackedEvents = (events: readonly GameEvent[]) =>
  events.flatMap((e) =>
    e.type === "triggerEvent" && e.phase === "resolved" && e.event.kind === "characterAttacked" ? [e.event] : [],
  );
const withStatus = (s: GameState, id: InstanceId, status: "stunned" | "tough"): GameState => ({
  ...s,
  instances: {
    ...s.instances,
    [id]: { ...s.instances[id]!, statuses: { ...s.instances[id]!.statuses, [status]: 1 } },
  },
});

describe("registry", () => {
  it("registers the six refs, each valid, and skips nothing", () => {
    expect(Object.keys(SYNTHEZOID_MODULAR_YOUNG_AVENGERS).sort()).toEqual([...REFS].sort());
    for (const [id, def] of Object.entries(SYNTHEZOID_MODULAR_YOUNG_AVENGERS))
      expect(validateDefinition(def), id).toEqual([]);
    expect(SYNTHEZOID_MODULAR_YOUNG_AVENGERS_SKIPPED).toEqual({});
  });

  it("the card data names exactly these refs", () => {
    const refs = [PATRIOT, HAWKEYE, STATURE, TEENAGE, YOUNG].flatMap((code) =>
      (
        (WAVE10_CARDS.find((c) => (c.id as string) === code) as unknown as { abilities: { id: string }[] }).abilities ??
        []
      ).map((a) => a.id),
    );
    expect(refs.sort()).toEqual([...REFS].sort());
  });
});

describe("Patriot (57055)", () => {
  it("WHEN REVEALED: a tough status on the villain (Rhino), Patriot has only its own Toughness, the hero none", () => {
    const run = villainPhase(game(), BLANK, PATRIOT, FILLER_A);
    expect(inPlayCard(run.state, PATRIOT)).toBeDefined();
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(tough(run.state, inPlayCard(run.state, PATRIOT)!)).toBe(1); // its own Toughness keyword, not the ability
    expect(tough(run.state, hero(run.state))).toBe(0);
  });
});

describe("Hawkeye (57056)", () => {
  it("WHEN REVEALED: discards the upgrade you control, and not a support", () => {
    const support = inPlay(game(), "support");
    const upgrade = inPlay(support.state, "upgrade");
    const run = villainPhase(upgrade.state, BLANK, HAWKEYE, FILLER_A);
    expect(discardedByP1(run.state)).toContain(upgrade.id);
    expect(discardedByP1(run.state)).not.toContain(support.id);
  });

  it("WHEN REVEALED with no upgrade: nothing is discarded (a support stays)", () => {
    const support = inPlay(game(), "support");
    const run = villainPhase(support.state, BLANK, HAWKEYE, FILLER_A);
    expect(discardedByP1(run.state)).not.toContain(support.id);
    expect(inPlayCard(run.state, HAWKEYE)).toBeDefined();
  });

  it("CONSTANT: with Hawkeye and a Shocker engaged, only Hawkeye's attack is ranged", () => {
    const base = game();
    const start = withStatus(base, villainOf(base), "stunned");
    const both = engageMinion(engageMinion(start, HAWKEYE, "hawk"), SHOCKER, "shocker");
    const run = villainPhase(both, BLANK, FILLER_A);
    const attacked = attackedEvents(run.events);
    const of = (id: string) => attacked.find((a) => a.attackerInstanceId === (id as InstanceId))!;
    expect(attacked).toHaveLength(2);
    expect(of("hawk").ranged).toBe(true);
    expect(of("shocker").ranged).toBeUndefined();
  });

  it("CONSTANT: his piercing lands ATK 2 on a tough hero and uses up the tough status", () => {
    const base = game();
    const start = withStatus(withStatus(base, villainOf(base), "stunned"), hero(base), "tough");
    const run = villainPhase(engageMinion(start, HAWKEYE, "hawk"), BLANK, FILLER_A);
    expect(attacksBy(run.state, run.events, HAWKEYE)).toMatchObject([{ baseAtk: 2, damageDealt: 2 }]);
    expect(inst(run.state, hero(run.state)).damage).toBe(2);
    expect(tough(run.state, hero(run.state))).toBe(0);
    // Control: a Shocker (ATK 2) is stopped by the same tough status and deals nothing.
    const shock = villainPhase(engageMinion(start, SHOCKER, "shocker"), BLANK, FILLER_A);
    expect(inst(shock.state, hero(shock.state)).damage).toBe(0);
    expect(tough(shock.state, hero(shock.state))).toBe(0);
  });
});

describe("Stature (57057)", () => {
  it("WHEN REVEALED: discards the support you control, and not an upgrade", () => {
    const upgrade = inPlay(game(), "upgrade");
    const support = inPlay(upgrade.state, "support");
    const run = villainPhase(support.state, BLANK, STATURE, FILLER_A);
    expect(discardedByP1(run.state)).toContain(support.id);
    expect(discardedByP1(run.state)).not.toContain(upgrade.id);
  });

  it("WHEN REVEALED with no support: nothing is discarded (an upgrade stays)", () => {
    const upgrade = inPlay(game(), "upgrade");
    const run = villainPhase(upgrade.state, BLANK, STATURE, FILLER_A);
    expect(discardedByP1(run.state)).not.toContain(upgrade.id);
    expect(inPlayCard(run.state, STATURE)).toBeDefined();
  });
});

describe("Teenage Superheroes (57058)", () => {
  it("WHEN REVEALED with Patriot in play: resolves his When Revealed (tough on the villain) and does not surge", () => {
    const start = engageMinion(game(), PATRIOT, "patriot");
    const run = villainPhase(start, BLANK, TEENAGE, FILLER_A);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE]);
    expect(inDiscard(run.state, TEENAGE)).toHaveLength(1);
  });

  it("WHEN REVEALED with Stature and Hawkeye in play: both resolve (support and upgrade discarded)", () => {
    const support = inPlay(game(), "support");
    const upgrade = inPlay(support.state, "upgrade");
    const start = engageMinion(engageMinion(upgrade.state, STATURE, "stature"), HAWKEYE, "hawk");
    const run = villainPhase(start, BLANK, TEENAGE, FILLER_A);
    expect(discardedByP1(run.state)).toEqual(expect.arrayContaining([support.id, upgrade.id]));
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE]);
  });

  // RRG 1.8 "Resolve" (p. 37); FFG ruling on Citywide Crisis (RRG 1.0-1.4 era): a When Revealed that changes nothing
  // was not resolved, so it is not counted.
  it("WHEN REVEALED with Hawkeye in play and no upgrade: his discard changes nothing, so none resolved and it surges", () => {
    const run = villainPhase(engageMinion(game(), HAWKEYE, "hawk"), BLANK, TEENAGE, FILLER_A, FILLER_B);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE, FILLER_A]);
  });

  it("WHEN REVEALED with Patriot in play and the villain already tough: no second tough status, so it surges", () => {
    const start = engageMinion(game(), PATRIOT, "patriot");
    const toughened = patchInstance(start, villainOf(start), {
      statuses: { ...inst(start, villainOf(start)).statuses, tough: 1 },
    });
    const run = villainPhase(toughened, BLANK, TEENAGE, FILLER_A, FILLER_B);
    expect(tough(run.state, villainOf(run.state))).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE, FILLER_A]);
  });

  it("WHEN REVEALED with a no-op Hawkeye and Stature discarding a support: one resolved, so no surge", () => {
    const support = inPlay(game(), "support");
    const start = engageMinion(engageMinion(support.state, STATURE, "stature"), HAWKEYE, "hawk");
    const run = villainPhase(start, BLANK, TEENAGE, FILLER_A, FILLER_B);
    expect(discardedByP1(run.state)).toContain(support.id);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE]);
  });

  it("WHEN REVEALED with no minion in play: none resolved, so it gains surge", () => {
    const run = villainPhase(game(), BLANK, TEENAGE, FILLER_A, FILLER_B);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE, FILLER_A]);
  });

  it("WHEN REVEALED with only a minion that has no When Revealed (Core 01101): none resolved, so it gains surge", () => {
    const run = villainPhase(engageMinion(game(), PLAIN, "plain"), BLANK, TEENAGE, FILLER_A, FILLER_B);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE, FILLER_A]);
  });

  // FFG ruling, September 22, 2026: surge and incite are When Revealed abilities, so "resolve the 'When Revealed'
  // ability of each minion" includes them (owner decision 2026-10-20, spec §S7 E37, revising docs/phase7-wave4.md §4
  // Q23 and the M6 reading these tests used to pin).
  it("WHEN REVEALED with Weapons Runner (surge) in play: its surge resolves and counts, so Teenage does not gain surge", () => {
    const RUNNER = "01121"; // Core minion: Surge, no printed When Revealed
    const run = villainPhase(engageMinion(game(), RUNNER, "runner"), BLANK, TEENAGE, FILLER_A, FILLER_B);
    // One card dealt, by the runner's surge; Teenage's own "gains surge" fallback did not fire.
    const surges = run.events.flatMap((e) => (e.type === "surgeTriggered" ? [e.instanceId] : []));
    expect(surges).toEqual(["runner"]);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE, FILLER_A]);
  });

  it("WHEN REVEALED with Wiccan (incite 1) in play: his incite and his printed When Revealed both resolve", () => {
    const WICCAN = "57061"; // Incite 1. When Revealed: You are confused. Otherwise, place 2 threat on the main scheme.
    const run = villainPhase(engageMinion(game(), WICCAN, "wiccan"), BLANK, TEENAGE, FILLER_A);
    const fromWiccan = run.events.flatMap((e) =>
      e.type === "threatPlaced" && e.sourceInstanceId === "wiccan" ? [e.amount] : [],
    );
    expect(fromWiccan).toEqual([1]);
    expect(inst(run.state, hero(run.state)).statuses.confused).toBe(1);
    expect(revealedCodes(run.state, run.events)).toEqual([TEENAGE]);
  });
});

describe("Young Avengers (57059)", () => {
  it("the first minion revealed each round gains surge; the second does not", () => {
    const placed = villainPhase(game(), BLANK, YOUNG).state;
    expect(inPlayCard(placed, YOUNG)).toBeDefined();
    const run = villainPhase(placed, BLANK, PLAIN, PLAIN, FILLER_A);
    expect(revealedCodes(run.state, run.events)).toEqual([PLAIN, PLAIN]);
  });

  it("without it the first minion draws no surge", () => {
    const run = villainPhase(game(), BLANK, PLAIN, PLAIN, FILLER_A);
    expect(revealedCodes(run.state, run.events)).toEqual([PLAIN]);
  });
});
