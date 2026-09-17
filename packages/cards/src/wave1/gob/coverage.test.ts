import { GOB_CARDS, type AbilityReference, type AnyCard } from "@mc/content";
import { wave1ReprintPairs } from "../reprints.js";
import { GOB_ABILITIES } from "./index.js";

/**
 * Local coverage check for the Green Goblin (`gob`) pack (docs/phase7-wave1-scripting.md "What to deliver" #5):
 * every `gob` card with ability text resolves, either via `GOB_ABILITIES` or via `../reprints.ts`'s automatic Core
 * reprint aliasing. The main session's `wave1/coverage.test.ts` does the same check across every pack once this one
 * is registered in `WAVE1_ABILITIES` — this file is the pack-local version a pack agent owns in the meantime.
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
 * No recorded gaps remain. `02007.when-revealed`/`02035.when-revealed` ("give the villain a facedown boost card"
 * outside an activation), `02044.when-revealed`/`02045.when-revealed` (a boost-icon sum over several discarded
 * cards), `02047.tombstone-forced-response` (an OR of printed resource types), and `02041.when-defeated` (a
 * per-player hand discard with both a live count and a resource-type filter) were all skips until the wave B
 * primitives batch and the 2026-09-17 closing batch (docs/phase7-wave1-scripting.md §6) landed `giveBoostCard`,
 * `discardEncounterCards`'s own `<bind>.boostIcons`, `TargetQuery.anyPrintedResource`, and `discardFromHand`'s own
 * `filter` plus its per-player walk, respectively; they're scripted now in
 * `risky-business.ts`/`goblin-gimmicks.ts`, `power-drain.ts`, and `running-interference.ts`.
 */
describe("Green Goblin (gob) pack ability coverage", () => {
  const allRefs = GOB_CARDS.flatMap(abilityRefIds);

  it("every ability reference resolves, either scripted directly or as a Core reprint alias", () => {
    const unresolved = allRefs.filter((id) => !(id in GOB_ABILITIES) && !reprintIds.has(id));
    expect(unresolved, `unresolved gob ability refs:\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("has 43 distinct card records (some, like the two villains' 3 stages each, share one record)", () => {
    expect(GOB_CARDS).toHaveLength(43);
  });
});
