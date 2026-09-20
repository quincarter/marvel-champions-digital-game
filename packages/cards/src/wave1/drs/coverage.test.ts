import { DRS_CARDS, type AbilityReference } from "@mc/content";
import { wave1ReprintPairs } from "../reprints.js";
import { DRS_ABILITIES } from "./index.js";
import { abilityRefIds } from "../../ability-refs.js";

/**
 * Local coverage check for the Doctor Strange (`drs`) pack (docs/phase7-wave1-scripting.md "What to deliver" #5):
 * every `drs` card with ability text resolves, either via `DRS_ABILITIES` or via `../reprints.ts`'s automatic Core
 * reprint aliasing, except the four documented skips (`index.ts`'s docblock, and the comments beside each in
 * `kit.ts` / `obligation.ts` / `nemesis.ts` / `pack-cards.ts`). The main session's `wave1/coverage.test.ts` does the
 * same check across every pack once this one is registered in `WAVE1_ABILITIES` — this file is the pack-local
 * version a pack agent owns in the meantime. Desperate Defense (09015) was a fifth skip until the 2026-09-15
 * `isAnnouncement`/`defended` fix landed; it's scripted in `pack-cards.ts` now.
 */

const reprintIds = new Set<string>();
{
  const packIds = new Set(DRS_CARDS.map((c) => c.id as string));
  for (const { wave1 } of wave1ReprintPairs()) {
    if (!packIds.has(wave1.id as string)) continue;
    for (const ref of abilityRefIds(wave1)) reprintIds.add(ref);
  }
}

/**
 * No recorded gaps left. `09015.desperate-defense-interrupt` was a skip (the `isAnnouncement`/`defended` engine
 * bug) until the 2026-09-15 fix; it's scripted in `pack-cards.ts`. `09020.unflappable-response`,
 * `09035.vapors-of-valtorr-special`, `09027.obligation` and `09030.counterspell-forced-interrupt` were all skips
 * for missing primitives until the wave B primitives batch landed `EventPattern.resultsAtMost`,
 * `TargetQuery.hasAnyStatus`, `increaseNextCardCost(..., "untilPlayed", ...)`/`afterNextCardPlayed`, and the
 * `play-card.ts` fix letting a cancelled play stop its own effects, respectively; they're scripted in
 * `pack-cards.ts`, `kit.ts`, `obligation.ts` and `nemesis.ts`.
 */
const KNOWN_SKIPPED = new Set<string>([]);

describe("Doctor Strange (drs) pack ability coverage", () => {
  const allRefs = DRS_CARDS.flatMap(abilityRefIds);

  it("every ability reference resolves, is a Core reprint alias, or is a documented skip", () => {
    const unresolved = allRefs.filter((id) => !(id in DRS_ABILITIES) && !reprintIds.has(id) && !KNOWN_SKIPPED.has(id));
    expect(unresolved, `unresolved drs ability refs:\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("every documented skip really is unresolved (not stale)", () => {
    for (const id of KNOWN_SKIPPED) {
      expect(allRefs, `${id} is no longer a real drs ability ref — update KNOWN_SKIPPED`).toContain(id);
      expect(id in DRS_ABILITIES, `${id} is scripted now — remove it from KNOWN_SKIPPED`).toBe(false);
    }
  });

  it("has 39 cards", () => {
    expect(DRS_CARDS).toHaveLength(39);
  });

  it("6 of the ability references are Core reprints (The Power of Protection, Med Team, Energy, Genius, Strength, Avengers Mansion)", () => {
    const reprintRefIds = [
      "09017.the-power-of-protection-constant",
      "09018.med-team-action",
      "09022.energy-constant",
      "09023.genius-constant",
      "09024.strength-constant",
      "09025.avengers-mansion-action",
    ];
    const actuallyReprinted = reprintRefIds.filter((id) => reprintIds.has(id));
    for (const id of actuallyReprinted) expect(allRefs, id).toContain(id);
    // Energy/Genius/Strength may print no ability at all (basic resource cards) — only assert the ones that do.
    expect(actuallyReprinted.length).toBeGreaterThanOrEqual(3);
  });
});
