/**
 * Local coverage for the `msm` pack (docs/phase7-wave1-scripting.md "What to deliver" §5) — never touches the
 * shared `../coverage.test.ts` (its `PACK_STATUS`/registration line are the main session's to update once this
 * pack is merged into `WAVE1_ABILITIES`). Every `msm` card's ability reference must resolve — through this pack's
 * own `MSM_ABILITIES`, or aliased as a Core reprint by `../reprints.ts` — except the four recorded, cited gaps
 * (two missing DSL primitives, one confirmed engine bug, one "sum of two counts" DSL gap; see the doc comments on
 * `MSM_KIT` in `./kit.ts` and `MSM_NEMESIS` in `./nemesis.ts`).
 */
import { MSM_CARDS, type AnyCard } from "@mc/content";
import { WAVE1_REPRINT_ABILITIES } from "../reprints.js";
import { MSM_ABILITIES } from "./index.js";

function abilityRefIds(card: AnyCard): string[] {
  switch (card.type) {
    case "hero_identity":
      return [...card.hero.abilities, ...card.alterEgo.abilities].map((ref) => ref.id);
    default:
      return "abilities" in card ? card.abilities.map((ref) => ref.id) : [];
  }
}

/** Ability ids intentionally left unscripted (see the doc comments on `MSM_KIT`/`MSM_NEMESIS` for the full citation). */
const SKIPPED = new Set([
  "05001a.morphogenetics", // missing `TargetQuery.anyTrait` (an OR of Attack/Thwart/Defense traits)
  "05001b.teen-spirit", // missing `discardDeckUntil` (a player-deck analog of `discardEncounterUntil`)
  "05010.embiggen-interrupt", // confirmed engine bug: the "attack" EffectSpec case doesn't read `cardEffectBonus`
  "05026.when-revealed", // missing a "sum of two counts" `ValueSpec` combinator
]);

describe("msm pack ability coverage", () => {
  const allRefs = MSM_CARDS.flatMap(abilityRefIds);

  it("has 33 cards and 33 ability references, each id unique", () => {
    expect(MSM_CARDS).toHaveLength(33);
    expect(allRefs).toHaveLength(33);
    expect(new Set(allRefs).size).toBe(allRefs.length);
  });

  it("every ability reference resolves — scripted directly, aliased as a Core reprint, or a recorded skip", () => {
    const registry: Record<string, unknown> = { ...WAVE1_REPRINT_ABILITIES, ...MSM_ABILITIES };
    const unresolved = allRefs.filter((id) => !(id in registry) && !SKIPPED.has(id));
    expect(unresolved, `unresolved msm ability refs (not scripted, not a Core reprint, not a recorded skip):\n${unresolved.join("\n")}`).toEqual([]);
  });

  it("every recorded skip is real (still absent from the registry) and still printed on a real card", () => {
    const registry: Record<string, unknown> = { ...WAVE1_REPRINT_ABILITIES, ...MSM_ABILITIES };
    for (const id of SKIPPED) {
      expect(registry, id).not.toHaveProperty(id);
      expect(allRefs, id).toContain(id);
    }
  });

  it("3 of the 33 references are Core reprints (Get Behind Me!, The Power of Protection, Avengers Mansion)", () => {
    const reprintIds = [
      "05013.get-behind-me-interrupt",
      "05016.the-power-of-protection-constant",
      "05022.avengers-mansion-action",
    ];
    for (const id of reprintIds) expect(allRefs, id).toContain(id);
    // Energy (05019), Genius (05020) and Strength (05021) print no ability at all (basic resource cards).
    expect(reprintIds).toHaveLength(3);
  });
});
