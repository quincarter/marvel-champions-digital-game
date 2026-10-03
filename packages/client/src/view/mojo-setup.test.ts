/**
 * MojoMania's three scenarios on the setup screen's own path (docs/phase7-wave6.md §3.63, §4 Q43/Q44): the defaults a
 * draft starts with when the screen has no MojoMania controls (random genre sets, none of Longshot), the restricted
 * candidate list, and a game started through `EngineSessionCore.start` (what Table setup's Start calls) that reaches
 * the first player turn.
 */
import { describe, expect, test } from "vitest";
import { setAsideModularSetCountFor, type AnyCard } from "@mc/content";
import { buildScenario, CARDS_BY_ID, POOL_SCENARIOS } from "../content/pool.js";
import { EngineSessionCore } from "../engine/session-core.js";
import { MemoryGameStorage } from "../engine/game-storage.js";
import { modularSetCandidateIdsFor, modularSetOptionsFor, toggleModularSet } from "./modular-sets.js";
import { initialSetupDraft, setScenario, toSessionConfig, type SetupDraft } from "./setup-draft.js";

const GENRES = ["crime", "fantasy", "horror", "sci-fi", "sitcom", "western"];
const HEROES = ["cap-leadership", "core-spider-man-justice", "core-she-hulk-aggression", "core-iron-man-aggression"];

const scenarioOf = (id: string) => POOL_SCENARIOS.find((s) => (s.id as string) === id)!;
const draftFor = (id: string): SetupDraft =>
  initialSetupDraft({ scenarioId: id, seatDeckId: "precon:cap-leadership", seed: 11 });
const playersOf = (count: number) => HEROES.slice(0, count).map((starterDeckId) => ({ starterDeckId }));

/** The encounter-set ids a list of card ids' cards belong to. */
function setsOf(cardIds: readonly string[]): Set<string> {
  const sets = new Set<string>();
  for (const id of cardIds) {
    const card = CARDS_BY_ID.get(id) as AnyCard | undefined;
    if (card && "encounterSetIds" in card) for (const s of card.encounterSetIds) sets.add(s as string);
  }
  return sets;
}

function composed(id: string, playerCount: number, seed = 11) {
  const scenario = scenarioOf(id);
  const draft = { ...draftFor(id), seed };
  const config = buildScenario(id, toSessionConfig(draft, playersOf(playerCount), scenario));
  const deckSets = setsOf(config.encounterDeck ?? []);
  const setAside = (config.setAsideModularSets ?? []).map((s) => s.encounterSetId);
  return { scenario, config, deckGenres: GENRES.filter((g) => deckSets.has(g)), deckSets, setAside };
}

describe("MojoMania's defaults on the setup screen", () => {
  test("MaGog: one random genre set, nothing set aside, no Longshot", () => {
    const { deckGenres, deckSets, setAside } = composed("magog", 1);
    expect(deckGenres).toHaveLength(1);
    expect(setAside).toEqual([]);
    expect(deckSets.has("longshot")).toBe(false);
    expect(deckSets.has("magog")).toBe(true);
  });

  test("Spiral: three random genre sets, nothing set aside, no Longshot", () => {
    const { deckGenres, deckSets, setAside } = composed("spiral", 2);
    expect(deckGenres).toHaveLength(3);
    expect(setAside).toEqual([]);
    expect(deckSets.has("longshot")).toBe(false);
  });

  test.each([1, 2, 3, 4])("Mojo with %i player(s): 1 + n genre sets set aside, none shuffled in, no Longshot", (n) => {
    const { scenario, config, deckGenres, deckSets, setAside } = composed("mojo", n);
    expect(setAsideModularSetCountFor(scenario, n)).toBe(1 + n);
    expect(setAside).toHaveLength(1 + n);
    expect(setAside.every((id) => GENRES.includes(id))).toBe(true);
    expect(deckGenres).toEqual([]);
    expect(deckSets.has("longshot")).toBe(false);
    expect(config.setAsideModularSets!.every((s) => s.cardIds.length > 0)).toBe(true);
  });

  test("the same seed builds the same genre sets; another seed can differ", () => {
    expect(composed("spiral", 1, 5).deckGenres).toEqual(composed("spiral", 1, 5).deckGenres);
    const picks = new Set([1, 2, 3, 4, 5, 6, 7, 8].map((seed) => composed("spiral", 1, seed).deckGenres.join()));
    expect(picks.size).toBeGreaterThan(1);
  });
});

describe("the modular set picker on a pooled scenario", () => {
  test("Spiral and Mojo offer only the six genre sets (restricted pool); MaGog also offers Core's five", () => {
    expect([...modularSetCandidateIdsFor(scenarioOf("spiral"))].sort()).toEqual([...GENRES].sort());
    expect([...modularSetCandidateIdsFor(scenarioOf("mojo"))].sort()).toEqual([...GENRES].sort());
    const magog = modularSetCandidateIdsFor(scenarioOf("magog"));
    expect(magog).toEqual(expect.arrayContaining(GENRES));
    expect(magog).toContain("bomb_scare");
    expect(magog).not.toContain("longshot");
  });

  test("nothing reads as chosen until a pick (the recommendation is the whole pool, the default is random)", () => {
    for (const id of ["magog", "spiral", "mojo"])
      expect(modularSetOptionsFor(draftFor(id), scenarioOf(id), CARDS_BY_ID).some((o) => o.selected)).toBe(false);
  });

  test("a half-made Spiral pick is not sent, so the game still builds; three picks are sent and honoured", () => {
    const scenario = scenarioOf("spiral");
    let draft = draftFor("spiral");
    draft = toggleModularSet(draft, scenario, "crime");
    expect(toSessionConfig(draft, playersOf(1), scenario).modularSetIds).toBeUndefined();
    expect(
      buildScenario("spiral", toSessionConfig(draft, playersOf(1), scenario)).encounterDeck?.length,
    ).toBeGreaterThan(0);
    draft = toggleModularSet(toggleModularSet(draft, scenario, "horror"), scenario, "western");
    const config = toSessionConfig(draft, playersOf(1), scenario);
    expect(config.modularSetIds).toEqual(["crime", "horror", "western"]);
    const sets = setsOf(buildScenario("spiral", config).encounterDeck ?? []);
    expect(GENRES.filter((g) => sets.has(g))).toEqual(["crime", "horror", "western"]);
  });

  test("changing scenario drops the old scenario's modular picks", () => {
    const rhino = scenarioOf("rhino");
    const draft = toggleModularSet(draftFor("rhino"), rhino, "ransacked_armory");
    expect(draft.modularSetIds).toEqual(
      ["bomb_scare", "ransacked_armory"].slice(0, 2).filter((id) => id !== "bomb_scare"),
    );
    expect(setScenario(draft, scenarioOf("spiral"), "spiral").modularSetIds).toBeNull();
    expect(setScenario(draft, rhino, "rhino").modularSetIds).toEqual(["ransacked_armory"]);
  });
});

describe("a MojoMania game started the way Table setup starts it", () => {
  test.each([
    ["magog", 1],
    ["spiral", 2],
    ["mojo", 1],
  ])("%s with %i player(s) reaches a legal first turn", async (id, n) => {
    const core = new EngineSessionCore({ storage: new MemoryGameStorage() });
    const config = toSessionConfig(draftFor(id), playersOf(n), scenarioOf(id));
    let { snapshot } = await core.start(config);
    // Setup may stop on a mulligan: keep the hand (the first legal answer) until the first player turn begins.
    for (let i = 0; i < 12 && snapshot.state.step.phase === "setup"; i++) {
      const who = snapshot.legal!.playerId;
      const legal = core.legalActions(who);
      const command =
        legal.kind === "choice"
          ? {
              type: "resolveChoice" as const,
              playerId: legal.choice.playerId,
              choiceId: legal.choice.choiceId,
              selectedOptionIds: [legal.choice.options[0]!.optionId],
            }
          : legal.kind === "turn"
            ? legal.legal[0]!.example
            : null;
      expect(command).not.toBeNull();
      const result = core.dispatch(command!);
      expect(result.ok).toBe(true);
      if (result.ok) snapshot = result.snapshot;
    }
    expect(snapshot.state.step).toMatchObject({ phase: "player", kind: "turn" });
    expect(snapshot.legal).not.toBeNull();
    expect(snapshot.config?.scenarioId).toBe(id);
  });
});
