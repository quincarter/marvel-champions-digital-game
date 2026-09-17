import { THOR_CARDS, type AbilityReference, type AnyCard } from "@mc/content";
import { wave1ReprintPairs } from "../reprints.js";
import { THOR_ABILITIES } from "./index.js";

/**
 * Local coverage check for the Thor (`thor`) pack (docs/phase7-wave1-scripting.md "What to deliver" #5): every
 * `thor` card with ability text resolves, either via `THOR_ABILITIES` or via `../reprints.ts`'s automatic Core
 * reprint aliasing, except the one documented skip (`index.ts`'s docblock, and the comment beside it in
 * `pack-cards.ts`). The main session's `wave1/coverage.test.ts` does the same check across every pack once this
 * one is registered in `WAVE1_ABILITIES` — this file is the pack-local version a pack agent owns in the meantime.
 */

function abilityRefIds(card: AnyCard): string[] {
  switch (card.type) {
    case "hero_identity":
      return [...card.hero.abilities, ...card.alterEgo.abilities].map((ref) => ref.id);
    case "villain":
      return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities.map((ref) => ref.id)));
    case "main_scheme":
      return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities].map((ref) => ref.id));
    default:
      return "abilities" in card ? (card.abilities as readonly AbilityReference[]).map((ref) => ref.id) : [];
  }
}

const reprintIds = new Set<string>();
{
  const packIds = new Set(THOR_CARDS.map((c) => c.id as string));
  for (const { wave1 } of wave1ReprintPairs()) {
    if (!packIds.has(wave1.id as string)) continue;
    for (const ref of abilityRefIds(wave1)) reprintIds.add(ref);
  }
}

/** No recorded gaps: Mean Swing (06015) was the pack's last skip, scripted with `TargetQuery.host` (wave B
 * primitives batch, docs/phase7-wave1-scripting.md §6). Valkyrie (06012) was a skip here too until the 2026-09-15
 * `paid.*` frame fix. */
const KNOWN_SKIPPED = new Set<string>([]);

describe("Thor (thor) pack ability coverage", () => {
  const allRefs = THOR_CARDS.flatMap(abilityRefIds);

  it("every ability reference resolves, is a Core reprint alias, or is a documented skip", () => {
    const unresolved = allRefs.filter((id) => !(id in THOR_ABILITIES) && !reprintIds.has(id) && !KNOWN_SKIPPED.has(id));
    expect(unresolved, `unresolved thor ability refs:\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("every documented skip really is unresolved (not stale)", () => {
    for (const id of KNOWN_SKIPPED) {
      expect(allRefs, `${id} is no longer a real thor ability ref — update KNOWN_SKIPPED`).toContain(id);
      expect(id in THOR_ABILITIES, `${id} is scripted now — remove it from KNOWN_SKIPPED`).toBe(false);
    }
  });

  it("has 34 cards", () => {
    expect(THOR_CARDS).toHaveLength(34);
  });
});
