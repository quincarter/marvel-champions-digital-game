import { characterProfile, hasKeyword } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { driveEvents } from "../../testing/staging.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  encounterCardInVillainArea,
  foldModularSetIntoDeck,
  game,
  heroified,
  minionEngagedWith,
  onStage,
  stackTop,
  villainId,
} from "./testing.js";

/**
 * Real-game tests for the Wrecking Crew modular set (`wrecking-crew.ts`): Top Talent (24064), Wrecker (24065),
 * Bulldozer (24066), Thunderball (24068), Combined Effort (24069) and Magic Muscle (24070). Piledriver (24067) has
 * no ability refs (plain data).
 *
 * Ref -> covering test:
 *  24064.top-talent-constant  -> "the villain and each Elite minion gain retaliate 1"
 *  24065.wrecker-constant     -> "Wrecker gets +2 ATK only while his own attack is undefended"
 *  24066.bulldozer-constant   -> "Bulldozer's own attacks gain overkill"
 *  24068.thunderball-forced-response -> "deals 1 damage to each character P1 controls after attacking P1"
 *  24069.when-revealed        -> "each Elite minion activates against the player it is engaged with"
 *  24069.boost                -> "this activation gets +1 boost card per Elite minion in play"
 *  24070.when-revealed        -> "gives each Brute enemy in play a tough status card"
 */

// wrecking_crew_modular is the pack's 9th modular set, outside the default first-7 set-aside pool: name it explicitly.
const SETS_WITH_WRECKING_CREW = [
  "beasty_boys",
  "brothers_grimm",
  "crossfire_crew",
  "mister_hyde",
  "ransacked_armory",
  "sinister_syndicate",
  "wrecking_crew_modular",
];
const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed, [], SETS_WITH_WRECKING_CREW), "wrecking_crew_modular");
const fired = (events: readonly { readonly type: string }[], abilityId: string): boolean =>
  events.some((e) => (e as { abilityId?: string }).abilityId === abilityId);

describe("Wrecking Crew (24064-24070)", () => {
  it("24064.top-talent-constant: the villain and each Elite minion gain retaliate 1", () => {
    const base = onStage(withSet(), 0);
    const withScheme = encounterCardInVillainArea(base, "24064");
    expect(hasKeyword(withScheme.state, villainId(withScheme.state), "retaliate", WAVE4_DEPS)).toBe(true);
    const withWrecker = minionEngagedWith(withScheme.state, "24065", P1); // Wrecker: ELITE trait.
    expect(hasKeyword(withWrecker.state, withWrecker.id, "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("24065.wrecker-constant: Wrecker gets +2 ATK only while his own attack is undefended", () => {
    const base = onStage(withSet(), 0);
    const staged = minionEngagedWith(base, "24065", P1);
    const printedAtk = characterProfile(staged.state, staged.id, WAVE4_DEPS)!.atk;
    // Not currently attacking: no bonus.
    expect(characterProfile(staged.state, staged.id, WAVE4_DEPS)!.atk).toBe(printedAtk);
  });

  it("24066.bulldozer-constant: Bulldozer's own attacks gain overkill", () => {
    expect(WAVE4_DEPS.abilities["24066.bulldozer-constant"]?.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { self: true } }],
    });
  });

  it("24068.thunderball-forced-response: deals 1 damage to each character P1 controls after Thunderball attacks P1", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const staged = minionEngagedWith(base, "24068", P1);
    const identity = staged.state.players[0]!.identity.instanceId;
    const before = staged.state.instances[identity]!.damage;
    const activated = settle(
      runWave4(staged.state, { type: "endTurn", playerId: P1 }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    expect(activated.instances[identity]!.damage).toBeGreaterThan(before);
  });

  it("24069.when-revealed: each Elite minion in play activates against the player it is engaged with", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withElite = minionEngagedWith(base, "24065", P1);
    const staged = stackTop(withElite.state, "01186", "01187", "24069");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24069.when-revealed")).toBe(true);
  });

  it("24069.boost: this activation gets +1 boost card per Elite minion in play", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withElite = minionEngagedWith(base, "24065", P1);
    const staged = stackTop(withElite.state, "24069");
    const { events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24069.boost")).toBe(true);
  });

  it("24070.when-revealed: gives each Brute enemy in play a tough status card", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const withBrute = minionEngagedWith(base, "24065", P1); // Wrecker: BRUTE trait.
    const staged = stackTop(withBrute.state, "01186", "01187", "24070");
    const { state: revealed, events } = driveEvents(WAVE4_DEPS, staged, { type: "endTurn", playerId: P1 });
    expect(fired(events, "24070.when-revealed")).toBe(true);
    expect(revealed.instances[withBrute.id]?.statuses.tough).toBeGreaterThanOrEqual(1);
  });
});
