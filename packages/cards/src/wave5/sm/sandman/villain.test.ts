import { encounterSetId } from "@mc/content";
import { activeEncounterDeck, activeVillain, createGame, type GameSetupConfig } from "@mc/engine";
import { describe, expect, it } from "vitest";
import {
  firstLegal,
  identityOf,
  inst,
  instancesOf,
  settle,
  stackEncounterDeck,
  toHero,
  endTurn,
  P1,
} from "../../../testing/harness.js";
import { runWave5, WAVE5_DEPS } from "../../testing.js";
import { ghostSpiderScenario } from "../ghost-spider/support.js";

/** Ghost-Spider's own real precon against Sandman, with Bomb Scare standing in for the box's own Down to Earth
 * modular (not scripted yet, docs/phase7-wave5.md §2.2) — the shared final report's own "already-scripted modular"
 * substitution. */
const sandmanGame = (overrides: Partial<GameSetupConfig> = {}, seed = 1) => {
  const config = ghostSpiderScenario("sandman", { seed, modularSetIds: [encounterSetId("bomb_scare")] });
  const created = createGame({ ...config, ...overrides }, WAVE5_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE5_DEPS);
};

const CITY_STREETS = () => "27065";
const cityStreetsCounters = (state: ReturnType<typeof sandmanGame>) =>
  inst(state, instancesOf(state, CITY_STREETS())[0]!).counters["sand"] ?? 0;

describe("Sandman (27061-27063): Sand Blast / Sand Wave", () => {
  it("27061.sandman-constant: Sandman (I) attacks undefended; that attack is indirect damage to identity, and Surging Sands resolves", () => {
    const state = sandmanGame();
    const before = cityStreetsCounters(state); // 4 from setup
    expect(before).toBe(4);
    const deckBefore = activeEncounterDeck(state).discard.length;
    // Assault (01187, Core's Standard set, included in every `sm` scenario's deck): "When Revealed (Hero): The
    // villain attacks you." Declines every defense (`firstLegal`), so the attack is undefended.
    const after = settle(
      runWave5(stackEncounterDeck(state, "01187"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    expect(inst(after, identityOf(after)).damage).toBeGreaterThanOrEqual(2); // Sandman (I)'s ATK 2, indirect
    // Surging Sands placed 1 more sand counter (4 -> 5) and discarded 5 cards from the top of the encounter deck.
    expect(cityStreetsCounters(after)).toBe(5);
    expect(activeEncounterDeck(after).discard.length).toBeGreaterThanOrEqual(deckBefore + 5);
  });

  it("27062.when-revealed: Sandman (II) starting stage resolves Surging Sands at setup (expert start)", () => {
    const state = sandmanGame({ villainStartStageIndex: 1, villainLastStageIndex: 1 });
    expect(activeVillain(state).stageIndex).toBe(1);
    // Setup put 4 sand counters on City Streets, then Sandman (II)'s own When Revealed (entering play as the
    // starting stage fires it, `core/scenarios/rhino.ts`'s own expert-start precedent) resolved Surging Sands once.
    expect(cityStreetsCounters(state)).toBe(5);
  });

  it("27063.when-revealed + sandman-constant: Sandman (III) places a sand counter, resolves Surging Sands, and his attack gains overkill", () => {
    const state = sandmanGame({ villainStartStageIndex: 2, villainLastStageIndex: 2 });
    expect(activeVillain(state).stageIndex).toBe(2);
    // 4 (setup) + 1 (When Revealed's own counter) + 1 (Surging Sands' own counter) = 6.
    expect(cityStreetsCounters(state)).toBe(6);
    const deckBefore = activeEncounterDeck(state).discard.length;
    const after = settle(
      runWave5(stackEncounterDeck(state, "01187"), toHero(P1), endTurn(P1)),
      firstLegal,
      undefined,
      WAVE5_DEPS,
    );
    // Sand Wave: the attack gains overkill; undefended, so the whole 3 ATK lands on identity and Surging Sands
    // resolves again (6 -> 7), discarding 7 more cards.
    expect(inst(after, identityOf(after)).damage).toBeGreaterThanOrEqual(3);
    expect(cityStreetsCounters(after)).toBe(7);
    expect(activeEncounterDeck(after).discard.length).toBeGreaterThanOrEqual(deckBefore + 7);
  });
});
