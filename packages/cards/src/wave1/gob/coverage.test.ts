import { GOB_CARDS, type AbilityReference, type AnyCard } from "@mc/content";
import { wave1ReprintPairs } from "../reprints.js";
import { GOB_ABILITIES } from "./index.js";

/**
 * Local coverage check for the Green Goblin (`gob`) pack (docs/phase7-wave1-scripting.md "What to deliver" #5):
 * every `gob` card with ability text resolves, either via `GOB_ABILITIES` or via `../reprints.ts`'s automatic Core
 * reprint aliasing, except the documented skips (this file's `KNOWN_SKIPPED`, and the comments beside each ability
 * in `risky-business.ts` / `mutagen-formula.ts` / `goblin-gimmicks.ts` / `power-drain.ts` / `running-interference.ts`).
 * The main session's `wave1/coverage.test.ts` does the same check across every pack once this one is registered in
 * `WAVE1_ABILITIES` — this file is the pack-local version a pack agent owns in the meantime.
 */

function abilityRefIds(card: AnyCard): string[] {
  switch (card.type) {
    case "hero_identity":
      return [...card.hero.abilities, ...card.alterEgo.abilities].map((ref) => ref.id);
    case "villain":
      return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities.map((ref) => ref.id)));
    case "main_scheme":
      return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities].map((ref) => ref.id));
    default: {
      const abilities = "abilities" in card ? (card.abilities as readonly AbilityReference[]).map((ref) => ref.id) : [];
      const flipAbilities = "flipSide" in card && card.flipSide ? (card.flipSide.abilities as readonly AbilityReference[]).map((ref) => ref.id) : [];
      return [...abilities, ...flipAbilities];
    }
  }
}

const reprintIds = new Set<string>();
{
  const packIds = new Set(GOB_CARDS.map((c) => c.id as string));
  for (const { wave1 } of wave1ReprintPairs()) {
    if (!packIds.has(wave1.id as string)) continue;
    for (const ref of abilityRefIds(wave1)) reprintIds.add(ref);
  }
}

/**
 * Recorded gap — `02041.when-defeated` (`power-drain.ts`) only: a per-player hand discard whose count is a live
 * value (summed boost icons) *and* whose candidates are filtered to resource-type cards — see `power-drain.ts`'s
 * doc comment for the exact primitive shape proposed. `02007.when-revealed`/`02035.when-revealed` ("give the
 * villain a facedown boost card" outside an activation), `02044.when-revealed`/`02045.when-revealed` (the same
 * boost-icon-sum gap `02041` used to share), and `02047.tombstone-forced-response` (an OR of printed resource
 * types) were all skips until the wave B primitives batch (docs/phase7-wave1-scripting.md §6) landed
 * `giveBoostCard`, `discardEncounterCards`'s own `<bind>.boostIcons`, and `TargetQuery.anyPrintedResource`
 * respectively; they're scripted now in `risky-business.ts`/`goblin-gimmicks.ts`, `power-drain.ts`, and
 * `running-interference.ts`.
 */
const KNOWN_SKIPPED = new Set<string>(["02041.when-defeated"]);

describe("Green Goblin (gob) pack ability coverage", () => {
  const allRefs = GOB_CARDS.flatMap(abilityRefIds);

  it("every ability reference resolves, is a Core reprint alias, or is a documented skip", () => {
    const unresolved = allRefs.filter((id) => !(id in GOB_ABILITIES) && !reprintIds.has(id) && !KNOWN_SKIPPED.has(id));
    expect(unresolved, `unresolved gob ability refs:\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("every documented skip really is unresolved (not stale)", () => {
    for (const id of KNOWN_SKIPPED) {
      expect(allRefs, `${id} is no longer a real gob ability ref — update KNOWN_SKIPPED`).toContain(id);
      expect(id in GOB_ABILITIES, `${id} is scripted now — remove it from KNOWN_SKIPPED`).toBe(false);
    }
  });

  it("has 43 distinct card records (some, like the two villains' 3 stages each, share one record)", () => {
    expect(GOB_CARDS).toHaveLength(43);
  });
});
