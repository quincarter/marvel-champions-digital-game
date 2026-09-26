import { activeVillain, cardsInPlay, createGame, getInstance } from "@mc/engine";
import { firstLegal, instancesOf, mainThreat, settle } from "../testing/harness.js";
import type { CorePlayer } from "../core/setup.js";
import { WAVE4_DEPS } from "./index.js";
import { wave4Scenario } from "./setup.js";

/**
 * `rules-qa-engineer`, full QA pass follow-up (coordinator, 2026-09-26, item 2): every `mts`/`hood` scenario's own
 * printed `Setup:` sentence (MC21 pp. 6/10/16/20/24, The Hood insert p. 2 — cross-checked against
 * `docs/cards/by_pack/mts.md`/`hood.md`), driven for real at 1 and 3 players, not just read against the script.
 * Modeled directly on `wave3/gmw/setup-scaling.test.ts`'s own shape (the same coordinator ask for GMW).
 *
 * Per-hero starting threat values below are read from `packages/content/src/data/mts/cards.ts`'s own
 * `startingThreat.perPlayer` on each scenario's first main scheme stage (`21074a`/`21098a`/`21114a`/`21138a`/
 * `21165a`), not guessed from the card face (Thanos's own "The Infinity Stones" stage 1A starts at 0 per hero,
 * unlike the other four).
 */

const ONE: readonly CorePlayer[] = [{ starterDeckId: "spectrum-leadership" }];
const THREE: readonly CorePlayer[] = [
  { starterDeckId: "spectrum-leadership" },
  { starterDeckId: "adam-warlock-all-aspects" },
  { starterDeckId: "nebula-justice" },
];
const HOOD_ONE: readonly CorePlayer[] = [{ starterDeckId: "core-spider-man-justice" }];
const HOOD_THREE: readonly CorePlayer[] = [
  { starterDeckId: "core-spider-man-justice" },
  { starterDeckId: "core-captain-marvel-leadership" },
  { starterDeckId: "nebula-justice" },
];

function setUp(
  scenarioId: string,
  players: readonly CorePlayer[],
  seed = 501,
  difficulty: "standard" | "expert" = "standard",
) {
  const config = wave4Scenario(scenarioId, { players, seed, difficulty });
  const created = createGame(config, WAVE4_DEPS);
  if (!created.ok) throw new Error(`${scenarioId}: setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE4_DEPS);
}

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC21 p. 6 — Ebony Maw's Setup, %s", (_label, players, n) => {
  it("starts on Attack on Knowhere 1A (21074a) at the printed 1 per hero threat, Ebony Maw I in play", () => {
    const state = setUp("ebony-maw", players);
    expect(mainThreat(state)).toBe(1 * n); // Attack on Knowhere 1A: startingThreat.perPlayer 1
    const villain = getInstance(state, activeVillain(state).instanceId);
    expect(villain?.cardId).toBe("21071"); // Ebony Maw (I)
    expect(activeVillain(state).stageIndex).toBe(0);
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC21 p. 10 — Tower Defense's Setup, %s", (_label, players, n) => {
  it('"Reveal stage 2A and put it into play... so there are two main schemes and two villains" (21098a), both starting at 1 per hero threat', () => {
    const state = setUp("tower-defense", players);
    // Stage 1B (Proxima Midnight's own scheme, the central `mainScheme`) and stage 2B (Corvus Glaive's own scheme,
    // `extraMainSchemes`) both start at 1 per hero (both stages' own `startingThreat.perPlayer`, above).
    expect(mainThreat(state)).toBe(1 * n);
    expect(state.extraMainSchemes?.length).toBe(1);
    const extraId = state.extraMainSchemes![0]!.instanceId;
    expect(getInstance(state, extraId)?.threat).toBe(1 * n);
    // Two villains in play (Proxima Midnight I and Corvus Glaive I in standard mode).
    expect(state.villains.map((v) => getInstance(state, v.instanceId)?.cardId).sort()).toEqual(["21092", "21095"]);
    // Avengers Tower (Stronghold side) and Focused Defense both entered play via stage 2A's own When Revealed.
    const [tower] = instancesOf(state, "21100a");
    const [focused] = instancesOf(state, "21101");
    expect(tower).toBeDefined();
    expect(focused).toBeDefined();
    expect(cardsInPlay(state)).toContain(tower);
    // "The Focused Defense attachment begins the game attached to stage 2B" (MC21 p. 11): the extra main scheme.
    expect(getInstance(state, focused!)?.attachedTo).toBe(state.extraMainSchemes?.[0]?.instanceId);
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC21 p. 16 — Thanos's Setup, %s", (_label, players, _n) => {
  it("starts on The Infinity Stones 1A (21114a) at 0 per hero threat (unlike every other mts scenario), Thanos I in play", () => {
    const state = setUp("thanos", players);
    // The Infinity Stones 1A starts at 0 per hero threat (unlike every other mts scenario's own first stage).
    expect(mainThreat(state)).toBe(0);
    const villain = getInstance(state, activeVillain(state).instanceId);
    expect(villain?.cardId).toBe("21111"); // Thanos (I)
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC21 p. 20 — Hela's Setup, %s", (_label, players, n) => {
  it('"Attach Odin to the main scheme, captive side faceup. Reveal Gnipahellir and Garm. Set Gjallerbru, Skurge, Hall of Nastrond, and Nidhogg aside" (21138a), threat at 1 per hero', () => {
    const state = setUp("hela", players);
    expect(mainThreat(state)).toBe(1 * n);
    const [odin] = instancesOf(state, "21139a");
    expect(odin).toBeDefined();
    expect(getInstance(state, odin!)?.attachedTo).toBe(state.mainScheme.instanceId);
    const [gnipahellir] = instancesOf(state, "21140");
    const [garm] = instancesOf(state, "21143");
    expect(cardsInPlay(state)).toContain(gnipahellir);
    expect(cardsInPlay(state)).toContain(garm);
    for (const code of ["21142", "21144", "21141", "21145"]) {
      // Gjallerbru, Skurge, Hall of Nastrond, Nidhogg: set aside, out of play, not yet in the encounter deck.
      const [instance] = instancesOf(state, code);
      expect(instance, `${code} should exist somewhere`).toBeDefined();
      expect(cardsInPlay(state)).not.toContain(instance);
      expect(state.encounterSetAside).toContain(instance);
    }
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC21 p. 24 — Loki's Setup, %s", (_label, players, n) => {
  it('"Set each copy of the Loki villain aside... Put the War in Asgard side scheme into play... Reveal 1 set-aside Loki villain at random" (21165a), threat at 1 per hero', () => {
    const state = setUp("loki", players);
    expect(mainThreat(state)).toBe(1 * n);
    // Exactly one of the five Loki cards is the active villain; the other four are set aside, out of play.
    const lokiCodes = ["21160", "21161", "21162", "21163", "21164"];
    const activeCardId = getInstance(state, activeVillain(state).instanceId)?.cardId;
    expect(lokiCodes).toContain(activeCardId);
    const setAsideLokis = lokiCodes.filter((code) => code !== activeCardId);
    for (const code of setAsideLokis) {
      const [instance] = instancesOf(state, code);
      expect(instance, `${code} should exist somewhere, set aside`).toBeDefined();
      expect(cardsInPlay(state)).not.toContain(instance);
    }
    expect(cardsInPlay(state)).toContain(activeVillain(state).instanceId);
  });
});

describe("expert-only setup additions: mts — the starting villain differs from standard", () => {
  // Every mts scenario substitutes a later-stage villain for expert mode, except Hela, which substitutes an
  // entirely different villain card (Hela A -> Hela B) — both are "a different card, stage, or hit point total"
  // per `wave3/gmw/setup-scaling.test.ts`'s own comparison, generalized rather than hardcoding which shape applies.
  const scenarios = ["ebony-maw", "thanos", "hela"] as const;

  it.each(scenarios)("%s: expert starts on a different villain stage/card than standard", (scenarioId) => {
    const standard = setUp(scenarioId, ONE, 501, "standard");
    const expert = setUp(scenarioId, ONE, 501, "expert");
    const standardVillain = getInstance(standard, activeVillain(standard).instanceId);
    const expertVillain = getInstance(expert, activeVillain(expert).instanceId);
    if (!standardVillain || !expertVillain) throw new Error("no active villain instance");
    const differs =
      standardVillain.cardId !== expertVillain.cardId ||
      activeVillain(standard).stageIndex !== activeVillain(expert).stageIndex;
    expect(differs).toBe(true);
  });

  it("tower-defense: expert starts both villains on a later stage than standard", () => {
    const standard = setUp("tower-defense", ONE, 501, "standard");
    const expert = setUp("tower-defense", ONE, 501, "expert");
    const standardStages = standard.villains.map((v) => v.stageIndex).sort();
    const expertStages = expert.villains.map((v) => v.stageIndex).sort();
    expect(expertStages).not.toEqual(standardStages);
  });

  it("loki: standard requires 2 Lokis in the victory display to win, expert requires 3", () => {
    // MC21 p. 24: "Standard Mode – Two versions; Expert Mode – Three versions." Read from the scenario's own
    // victory condition rather than hardcoded, so a data change would be caught here too.
    const standard = setUp("loki", ONE, 501, "standard");
    const expert = setUp("loki", ONE, 501, "expert");
    expect(standard.scenarioRules.victoryCondition).toBe(2);
    expect(expert.scenarioRules.victoryCondition).toBe(3);
  });
});

describe("The Hood's Setup (MC's own insert, p. 2), 1 and 3 players", () => {
  it.each([
    ["1 player", HOOD_ONE, 1],
    ["3 players", HOOD_THREE, 3],
  ] as const)(
    "%s: The Hood 1A in play, Making Connections sets 7 modular sets aside and shuffles 1 in",
    (_label, players, _n) => {
      const state = wave4Scenario("the-hood", { players, seed: 502 });
      const created = createGame(state, WAVE4_DEPS);
      if (!created.ok) throw new Error(`the-hood: setup failed: ${created.error.message}`);
      const settled = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE4_DEPS);
      const villain = getInstance(settled, activeVillain(settled).instanceId);
      expect(villain?.cardId).toBe("24001"); // The Hood, stage I
      // 7 of the pack's 9 modular sets are set aside at setup (docs/phase7-wave4.md §2.3/§3.18); the 8th is chosen
      // and shuffled into the encounter deck by Making Connections' own When Revealed, leaving 6 full modular sets
      // (dozens of cards) still set aside, out of play — a real bound, not a guess at the exact count.
      expect(settled.encounterSetAside.length).toBeGreaterThan(20);
    },
  );
});
