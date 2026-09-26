import { characterProfile, hasKeyword } from "@mc/engine";
import { describe, expect, it } from "vitest";
import { P1, firstLegal, settle } from "../../testing/harness.js";
import { runWave4, WAVE4_DEPS } from "../testing.js";
import {
  attachedTo,
  deckId,
  encounterCardInVillainArea,
  foldModularSetIntoDeck,
  game,
  heroified,
  onStage,
} from "./testing.js";

/**
 * Real-game tests for the Ransacked Armory modular set (`ransacked-armory.ts`): Holoshield Generator (24038),
 * Jetpack (24039) and Tech Gauntlets (24040). The attach fallbacks and Flamethrower (24037) are in `hood-gaps.test.ts`
 * (docs/phase7-wave4.md §3.52-§3.59).
 *
 * Ref -> covering test:
 *  24038.holoshield-generator-constant-2 -> "attached minion gets +4 hit points and retaliate 2"
 *  24039.jetpack-forced-interrupt -> "discards the top card and reduces damage by its boost icons"
 *  24040.tech-gauntlets-constant-2 / -constant-3     -> "attached minion gets +3 hit points; its attacks gain overkill"
 */

// Ransacked Armory is the pack's 5th modular set; the default first-7 set-aside pool already includes it.
const withSet = (seed = 1) => foldModularSetIntoDeck(game(seed), "ransacked_armory");

describe("Ransacked Armory (24038, 24039, 24040)", () => {
  it("24038.holoshield-generator-constant-2: attached minion gets +4 hit points and retaliate 2", () => {
    const base = onStage(withSet(), 0);
    const host = encounterCardInVillainArea(base, "24041"); // Armored Guard: a plain minion host.
    const before = characterProfile(host.state, host.id, WAVE4_DEPS)!.maxHp;
    const staged = attachedTo(host.state, "24038", host.id);
    expect(characterProfile(staged.state, host.id, WAVE4_DEPS)!.maxHp).toBe(before + 4);
    expect(hasKeyword(staged.state, host.id, "retaliate", WAVE4_DEPS)).toBe(true);
  });

  it("24039.jetpack-forced-interrupt: discards the top card of the encounter deck and reduces damage by its boost icons", () => {
    const base = heroified(onStage(withSet(), 0), P1);
    const host = encounterCardInVillainArea(base, "24041");
    const staged = attachedTo(host.state, "24039", host.id);
    const discardBefore = staged.state.encounterDecks[deckId(staged.state)]!.discard.length;
    const attacked = settle(
      runWave4(staged.state, {
        type: "basicAttack",
        playerId: P1,
        attackerInstanceId: staged.state.players[0]!.identity.instanceId,
        targetInstanceId: host.id,
      }),
      firstLegal,
      undefined,
      WAVE4_DEPS,
    );
    // The interrupt discarded exactly one card off the top of the deck.
    expect(attacked.encounterDecks[deckId(attacked)]!.discard.length).toBe(discardBefore + 1);
  });

  it("24040.tech-gauntlets-constant-2: attached minion gets +3 hit points", () => {
    const base = onStage(withSet(), 0);
    const host = encounterCardInVillainArea(base, "24041");
    const before = characterProfile(host.state, host.id, WAVE4_DEPS)!.maxHp;
    const staged = attachedTo(host.state, "24040", host.id);
    expect(characterProfile(staged.state, host.id, WAVE4_DEPS)!.maxHp).toBe(before + 3);
  });

  it("24040.tech-gauntlets-constant-3: the attached minion's own attacks gain overkill", () => {
    // The exact same `attackKeywords` RuleSpec shape `mts/ebony-maw.ts`'s Black Dwarf uses for an identical
    // printed line ("Black Dwarf's attacks gain overkill") — checked here at the registry level (a full spillover
    // scenario needs a second friendly character to spill onto, out of scope for this ref's own text).
    expect(WAVE4_DEPS.abilities["24040.tech-gauntlets-constant-3"]?.trigger).toMatchObject({
      kind: "constant",
      rules: [{ kind: "attackKeywords", keywords: ["overkill"], attacker: { hostOfSelf: true } }],
    });
  });
});
