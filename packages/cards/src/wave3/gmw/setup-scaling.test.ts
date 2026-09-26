import { describe, expect, it } from "vitest";
import { activeEncounterDeck, activeVillain, cardsInPlay, createGame, getInstance } from "@mc/engine";
import { firstLegal, identityOf, inst, instancesOf, mainThreat, settle } from "../../testing/harness.js";
import type { CorePlayer } from "../../core/setup.js";
import { STAR_LORD_LEADERSHIP } from "../stld/testing.js";
import { wave3Scenario } from "../setup.js";
import { WAVE3_DEPS } from "../testing.js";

/**
 * rules-qa-engineer, full QA pass follow-up (docs/phase7-wave3-qa.md "Full QA pass" section): every GMW scenario's
 * own printed `Setup:` sentence (MC16 p. 8/10/12/14/18, cross-checked against `docs/cards/by_pack/gmw.md`'s own
 * transcription of each main scheme's A-side text), driven for real at 1 and 3 players, not just read against the
 * script. Earlier checkpoints drove full games (1p/2p) to a real outcome but never asserted the exact post-setup
 * board state, and never seated 3 players — this file closes both gaps for the setup step specifically (a separate
 * `4-player, to completion` smoke-game pass covers player-count scaling for whole-game outcomes instead).
 *
 * Card ids used below (none printed on the card face, all read directly from `packages/content/src/data/gmw/
 * cards.ts` and cross-checked against `docs/cards/by_pack/gmw.md`'s own per-card entries): Badoon Ship 16063,
 * Library Labyrinth 16085a, Nebula's Ship 16093, Kree Command Ship 16108, Universal Weapon 16109, Milano 16142,
 * Power Stone 16149.
 */

const ONE: readonly ({ readonly starterDeckId: string } | CorePlayer)[] = [{ starterDeckId: "groot-protection" }];
const THREE: readonly ({ readonly starterDeckId: string } | CorePlayer)[] = [
  { starterDeckId: "groot-protection" },
  { starterDeckId: "rocket-raccoon-aggression" },
  STAR_LORD_LEADERSHIP,
];

function setUp(scenarioId: string, players: readonly ({ readonly starterDeckId: string } | CorePlayer)[], seed = 500) {
  const config = wave3Scenario(scenarioId, { players, seed, difficulty: "standard" });
  const created = createGame(config, WAVE3_DEPS);
  if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
  return settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);
}

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC16 p. 8 — Brotherhood of Badoon's Setup, %s", (_label, players, n) => {
  it('"Put the Badoon Ship environment and the Milano support into play" (16061a), and the starting threat', () => {
    const state = setUp("brotherhood-of-badoon", players);
    expect(mainThreat(state)).toBe(2 * n); // Terrestrial Invasion 1B: Base Threat 2 per hero (docs/cards/by_pack/gmw.md)
    const [ship] = instancesOf(state, "16063");
    const [milano] = instancesOf(state, "16142");
    expect(ship).toBeDefined();
    expect(milano).toBeDefined();
    const inPlay = cardsInPlay(state);
    expect(inPlay).toContain(ship);
    expect(inPlay).toContain(milano);
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC16 p. 10 — Infiltrate the Museum's Setup, %s", (_label, players, n) => {
  it('"Create \\"The Collection\\" game area... Put the top card of each player\'s deck faceup into The Collection" (16073a), and the starting threat', () => {
    const state = setUp("infiltrate-the-museum", players);
    expect(mainThreat(state)).toBe(4 * n); // The Grand Collection 1B: Base Threat 4 per hero
    expect(state.scenarioAreas?.["The Collection"]?.length).toBe(n); // exactly one card per player, not per_hero-scaled twice
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC16 p. 12 — Escape the Museum's Setup, %s", (_label, players, n) => {
  it('"Put the Library Labyrinth environment into play. Set aside the Ship Command modular encounter set" (16082a), and the starting threat', () => {
    const state = setUp("escape-the-museum", players);
    expect(mainThreat(state)).toBe(7 * n); // The Missing Milano 1B: Base Threat 7 per hero
    const [labyrinth] = instancesOf(state, "16085a");
    expect(labyrinth).toBeDefined();
    expect(cardsInPlay(state)).toContain(labyrinth);
    // The Milano is *part of* the set-aside Ship Command modular (per-player scenario-specific card, `wave3/setup.ts`'s
    // `scenarioSpecificSetAside`) — Escape the Museum's own printed setup does not put it into play yet (that's
    // stage 2A's own When Revealed, "Put the set-aside Milano support... into play", 16083a). Confirms the setup
    // sentence's own scope: only the environment, not every card `Setup:` merely stages for a later reveal.
    const [milano] = instancesOf(state, "16142");
    expect(milano).toBeDefined();
    expect(cardsInPlay(state)).not.toContain(milano);
    expect(state.encounterSetAside).toContain(milano);
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC16 p. 14 — Nebula's Setup, %s", (_label, players, n) => {
  it('"Put the Nebula\'s Ship environment and the Milano support into play. Attach the Power Stone to Nebula. Discard the top 2[per_hero] cards..." (16091a), and the starting threat', () => {
    const config = wave3Scenario("nebula", { players, seed: 500, difficulty: "standard" });
    const created = createGame(config, WAVE3_DEPS);
    if (!created.ok) throw new Error(`setup failed: ${created.error.message}`);
    const state = settle(created.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);

    expect(mainThreat(state)).toBe(2 * n); // The Art of Evasion 1B: Base Threat 2 per hero

    const [ship] = instancesOf(state, "16093");
    const [milano] = instancesOf(state, "16142");
    expect(ship).toBeDefined();
    expect(milano).toBeDefined();
    expect(cardsInPlay(state)).toContain(ship);
    expect(cardsInPlay(state)).toContain(milano);

    const [stone] = instancesOf(state, "16149");
    expect(stone).toBeDefined();
    expect(inst(state, stone!).attachedTo).toBe(activeVillain(state).instanceId);

    // "Discard the top 2[per_hero] cards of the encounter deck, then attach each Technique attachment discarded
    // this way to Nebula" — the encounter discard pile starts empty on a fresh game (`resolveScenarioSetup` never
    // discards anything else before this), so every card this instruction moved is either still in the discard
    // pile (not a Technique) or now attached to Nebula (a Technique, 16094/16095/16096/16097/16098) — the two
    // totals must sum to exactly 2n regardless of which specific cards the seed happened to draw.
    const TECHNIQUE_IDS = new Set(["16094", "16095", "16096", "16097", "16098"]);
    const techniquesOnNebula = inst(state, activeVillain(state).instanceId).attachments.filter((id) =>
      TECHNIQUE_IDS.has(getInstance(state, id)?.cardId as string),
    ).length;
    const discarded = activeEncounterDeck(state).discard.length;
    expect(discarded + techniquesOnNebula).toBe(2 * n);
  });
});

describe.each([
  ["1 player", ONE, 1],
  ["3 players", THREE, 3],
] as const)("MC16 p. 18 — Ronan the Accuser's Setup, %s", (_label, players, n) => {
  it('"Put the Kree Command Ship environment and the Milano support into play. Attach the Universal Weapon to Ronan the Accuser. Attach the Power Stone to the first player" (16106a), and the starting threat', () => {
    const state = setUp("ronan-the-accuser", players);
    expect(mainThreat(state)).toBe(2 * n); // Interception Imminent 1B: Base Threat 2 per hero

    const [ship] = instancesOf(state, "16108");
    const [milano] = instancesOf(state, "16142");
    expect(ship).toBeDefined();
    expect(milano).toBeDefined();
    expect(cardsInPlay(state)).toContain(ship);
    expect(cardsInPlay(state)).toContain(milano);

    const [weapon] = instancesOf(state, "16109");
    expect(weapon).toBeDefined();
    expect(inst(state, weapon!).attachedTo).toBe(activeVillain(state).instanceId);

    const [stone] = instancesOf(state, "16149");
    expect(stone).toBeDefined();
    expect(inst(state, stone!).attachedTo).toBe(identityOf(state, state.players[0]!.playerId));
  });
});

describe("expert-only setup additions: the starting villain differs from standard, at every scenario", () => {
  // Every scenario's own printed "Contents" line substitutes a later-stage (or, for Escape the Museum, an entirely
  // different-card) villain for expert mode. Rather than hardcode which numbered stage/card each scenario's expert
  // face is (already read once by `wave3/setup.ts`'s own `buildSingleVillain`, from `GMW_SCENARIOS.villainStages`/
  // `expertVillains` data `card-data-pipeline` owns), this compares standard vs expert directly: whichever villain
  // instance a scenario starts on a real expert game must be a different card, stage, or hit point total than the
  // one the same scenario starts a real standard game on.
  const scenarios = [
    "brotherhood-of-badoon",
    "infiltrate-the-museum",
    "escape-the-museum",
    "nebula",
    "ronan-the-accuser",
  ] as const;

  it.each(scenarios)("%s: expert starts on a different villain stage/card than standard", (scenarioId) => {
    const standard = setUp(scenarioId, ONE);
    const expertConfig = wave3Scenario(scenarioId, { players: ONE, seed: 500, difficulty: "expert" });
    const createdExpert = createGame(expertConfig, WAVE3_DEPS);
    if (!createdExpert.ok) throw new Error(`expert setup failed: ${createdExpert.error.message}`);
    const expert = settle(createdExpert.state, firstLegal, (s) => s.step.phase === "player", WAVE3_DEPS);

    const standardVillain = getInstance(standard, activeVillain(standard).instanceId);
    const expertVillain = getInstance(expert, activeVillain(expert).instanceId);
    if (!standardVillain || !expertVillain) throw new Error("no active villain instance");
    const differs =
      standardVillain.cardId !== expertVillain.cardId ||
      activeVillain(standard).stageIndex !== activeVillain(expert).stageIndex;
    expect(differs).toBe(true);
  });
});
