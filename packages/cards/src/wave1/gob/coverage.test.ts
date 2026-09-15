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
 * Recorded gaps — every one is a missing engine/DSL primitive, cited beside where the ability would go:
 * - `02006a.criminal-enterprise-constant` / `02006b.state-of-madness-constant` (`risky-business.ts`): the real card
 *   data lists only one ability ref per face for a behavior that needs two independent triggers (a persistent
 *   edge-triggered flip-at-zero `stateCheck`, plus a forced response placing starting counters on enter/flip) — a
 *   data curation gap (the schema's own test fixture shows the intended two-ref shape), not an engine/DSL gap, but
 *   unresolvable under the one id the data actually provides.
 * - `02007.when-revealed` (`risky-business.ts`), `02035.when-revealed` (`goblin-gimmicks.ts`): "give the villain N
 *   facedown boost card(s)" outside an activation already in progress — no `CardDestination`/effect stockpiles a
 *   boost card onto the villain ahead of its next activation.
 * - `02041.when-defeated`, `02044.when-revealed` (`power-drain.ts`): `ValueSpec.boostIcons` reads only the first
 *   card a ref names (`select.ts` `case "boostIcons"`), with no sum over several bound cards — both discard 2 cards
 *   and need a total across both.
 * - `02045.when-revealed` (`power-drain.ts`): the same boost-icon-sum gap — it discards `1[per_hero]` cards, more
 *   than one with 2+ heroes.
 * - `02047.tombstone-forced-response` (`running-interference.ts`): no `TargetQuery`/`CardSelector` composition for
 *   "matches either of two printed resource types" (a hand card with a mental *or* physical icon) — the same shape
 *   as the documented "no anyTrait" gap, generalized to resource types.
 */
const KNOWN_SKIPPED = new Set<string>([
  "02006a.criminal-enterprise-constant",
  "02006b.state-of-madness-constant",
  "02007.when-revealed",
  "02035.when-revealed",
  "02041.when-defeated",
  "02044.when-revealed",
  "02045.when-revealed",
  "02047.tombstone-forced-response",
]);

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
