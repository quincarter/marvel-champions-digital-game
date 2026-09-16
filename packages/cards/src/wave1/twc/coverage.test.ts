import { TWC_CARDS, type AbilityReference, type AnyCard } from "@mc/content";
import { wave1ReprintPairs } from "../reprints.js";
import { TWC_ABILITIES } from "./index.js";

/**
 * Local coverage check for The Wrecking Crew (`twc`) pack (docs/phase7-wave1-scripting.md "What to deliver" #5):
 * every `twc` card with ability text resolves, either via `TWC_ABILITIES` or via `../reprints.ts`'s automatic Core
 * reprint aliasing, except the documented skips below (also noted beside each ability in
 * `breakout.ts`/`wrecker.ts`/`thunderball.ts`/`piledriver.ts`/`bulldozer.ts`). Copied from `wave1/gob/coverage.test.ts`
 * (the pack-local version a pack agent owns; `TWC_ABILITIES` is not merged into the shared `wave1/index.ts` in this
 * pass, so there is no session-wide `wave1/coverage.test.ts` row for `twc` to flip yet).
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
  const packIds = new Set(TWC_CARDS.map((c) => c.id as string));
  for (const { wave1 } of wave1ReprintPairs()) {
    if (!packIds.has(wave1.id as string)) continue;
    for (const ref of abilityRefIds(wave1)) reprintIds.add(ref);
  }
}

/**
 * No recorded gaps left. `07004.hard-hitter`, `07019.gamma-blast`, `07034.pile-drive`, `07048.charge` (each side
 * scheme's own file) were skips because "if there is 10 or more threat here" reads a scheme's *live* threat total
 * against a threshold, which no `Predicate` expressed, until the wave B primitives batch
 * (docs/phase7-wave1-scripting.md §6) landed `threatAtLeast` (`Predicate` `compare`). `07022.radioactive-buildup-
 * constant` ("excess damage dealt by Thunderball is placed as threat on his corresponding side scheme") was a skip
 * until that same batch landed `RuleSpec.excessDamageAsThreat`. `07027.boost` (Energy Projectiles, "deal 1 damage
 * to the defending character" mid-boost) was a skip until it landed `defendingCharacter`. All are scripted now, in
 * each side scheme's own file / `thunderball.ts`.
 * `07006.magic-crowbar-action`, `07020.ball-and-chain-action` and `07049.bulldozers-helmet-action` were skips for
 * a different reason (`AbilityCost.discardFromHand` had no random option) until `discardRandomFromHandCost` landed
 * 2026-09-15; all three are scripted now (`wrecker.ts`/`thunderball.ts`/`bulldozer.ts`).
 */
const KNOWN_SKIPPED = new Set<string>([]);

describe("The Wrecking Crew (twc) pack ability coverage", () => {
  const allRefs = TWC_CARDS.flatMap(abilityRefIds);

  it("every ability reference resolves, is a Core reprint alias, or is a documented skip", () => {
    const unresolved = allRefs.filter((id) => !(id in TWC_ABILITIES) && !reprintIds.has(id) && !KNOWN_SKIPPED.has(id));
    expect(unresolved, `unresolved twc ability refs:\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("every documented skip really is unresolved (not stale)", () => {
    for (const id of KNOWN_SKIPPED) {
      expect(allRefs, `${id} is no longer a real twc ability ref — update KNOWN_SKIPPED`).toContain(id);
      expect(id in TWC_ABILITIES, `${id} is scripted now — remove it from KNOWN_SKIPPED`).toBe(false);
    }
  });

  it("no twc card is a reprint alias (Wrecking Crew has no Core-namesake cards)", () => {
    expect(reprintIds.size).toBe(0);
  });

  it("has 55 distinct card records (each two-sided villain stage shares one record)", () => {
    expect(TWC_CARDS).toHaveLength(55);
  });
});
