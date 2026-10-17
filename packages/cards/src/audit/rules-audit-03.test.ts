/**
 * Rules audit chunk 03 (Glossary: ALTERATION EFFECT ... ATTACK (ENEMY ACTIVATION)). Audit proofs only: each `it.fails`
 * marks a place the engine does something an official source forbids, and flips to a failure when it is fixed.
 *
 * Infinite Prelate (45067): FFG Game Rules Specialist (Alex), November 19, 2024, "Latest FFG Rulings post RRG 1.6"
 * ruling 43: "For Infinite Prelate, you resolve each bullet before resolving Unus' activation." RRG 1.8 "Alteration
 * Effect" (p. 6) is the rule the ruling rests on. The engine (owner decision Q8 = A, docs/phase7-wave8-handoff.md)
 * resolves the tough status card and the heal after the activation.
 */
import { AOA_CARDS, CORE_CARDS, encounterSetId } from "@mc/content";
import { createGame, type EngineDeps, type GameEvent, type GameState, type InstanceId } from "@mc/engine";
import { describe, expect, it, vi } from "vitest";
import { coreScenario } from "../core/setup.js";
import { mergeRegistries } from "../dsl/index.js";
import { P1, endTurn, firstLegal, patchInstance, settle, stackEncounterDeck } from "../testing/harness.js";
import { driveEventsPicking, withForm } from "../testing/staging.js";
import { INFINITES } from "../wave8/aoa/infinites.js";
import { UNUS } from "../wave8/aoa/unus.js";
import { WAVE7_ABILITIES } from "../wave7/index.js";

vi.setConfig({ testTimeout: 120_000 });

const DEPS: EngineDeps = { abilities: mergeRegistries(WAVE7_ABILITIES, INFINITES, UNUS) };
const PRELATE = "45067";
const GENE_POOL = "45071";
const BLANK_A = "01186";
const BLANK_B = "01187";

function setupGame(): GameState {
  const config = coreScenario("rhino", {
    players: [{ starterDeckId: "core-spider-man-justice" }],
    seed: 1,
    difficulty: "standard",
    modularSetIds: [],
    cardPool: [...CORE_CARDS, ...AOA_CARDS],
  });
  const sets = [encounterSetId("unus"), encounterSetId("infinites")];
  const copies = AOA_CARDS.filter(
    (c) => "encounterSetIds" in c && c.encounterSetIds.some((id) => sets.includes(id)),
  ).flatMap((c) => Array.from({ length: (c as { quantityInSet: number }).quantityInSet }, () => c.id));
  const created = createGame(
    {
      ...config,
      villainCardId: "45059" as typeof config.villainCardId,
      villainSide: "A",
      villainStartStageIndex: 0,
      villainLastStageIndex: 2,
      mainSchemeCardId: "45062a" as typeof config.mainSchemeCardId,
      encounterDeck: [...config.encounterDeck, ...copies],
    },
    DEPS,
  );
  if (!created.ok) throw new Error(created.error.message);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", DEPS);
}

describe("Infinite Prelate (45067): FFG ruling 2024-11-19 (post RRG 1.6 #43)", () => {
  it.fails("at 6 threat, the tough status card and the 3 heal resolve before Unus' activation, not after", () => {
    const base = setupGame();
    const unus = base.activeVillainId!;
    const pool = base.villainArea.find((id) => (base.instances[id]!.cardId as string) === GENE_POOL)!;
    // Step one of the villain phase adds 1 acceleration threat: 5 -> 6. Unus starts with no tough card and 5 damage.
    const staged = patchInstance(patchInstance(base, pool, { threat: 5 }), unus, {
      damage: 5,
      statuses: { stunned: 0, confused: 0, tough: 0 },
    });
    // Unus' own activation takes BLANK_A, then the Prelate is revealed (P1's dealt card) and Unus activates again (BLANK_B).
    const stacked = stackEncounterDeck(staged, BLANK_A, PRELATE, BLANK_B);
    const hero = withForm(stacked, { heroForm: 0 });
    const { events } = driveEventsPicking(
      DEPS,
      hero,
      (s) => (s.pendingChoice!.prompt.kind === "declareDefender" ? ["decline"] : firstLegal(s)),
      endTurn(P1),
    );
    const of = (type: GameEvent["type"], pred: (e: never) => boolean = () => true) =>
      events.flatMap((e, i) => (e.type === type && pred(e as never) ? [i] : []));
    const attacks = of(
      "attackResolved",
      (e: Extract<GameEvent, { type: "attackResolved" }>) => e.enemyInstanceId === unus,
    );
    const toughGiven = of(
      "statusGiven",
      (e: Extract<GameEvent, { type: "statusGiven" }>) => e.instanceId === (unus as InstanceId) && e.status === "tough",
    );
    expect(attacks).toHaveLength(2);
    expect(toughGiven).toHaveLength(1);
    // The ruling: each bullet resolves before the activation the first sentence starts (the Prelate's, the second).
    expect(toughGiven[0]!).toBeLessThan(attacks[1]!);
  });
});
