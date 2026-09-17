/**
 * Local coverage for the `msm` pack (docs/phase7-wave1-scripting.md "What to deliver" §5) — never touches the
 * shared `../coverage.test.ts` (its `PACK_STATUS`/registration line are the main session's to update once this
 * pack is merged into `WAVE1_ABILITIES`). Every `msm` card's ability reference must resolve — through this pack's
 * own `MSM_ABILITIES`, or aliased as a Core reprint by `../reprints.ts`. Morphogenetics (05001a), Embiggen!
 * (05010) and Generation Why? (05026) were skips here too until `TargetQuery.anyTrait`, the `attack` effect's
 * `cardEffectBonus` fix, and `ValueSpec` `sum` landed (2026-09-15). Teen Spirit (05001b) was the pack's last skip
 * until `discardDeckUntil` landed (2026-09-17) — see the doc comment on `MSM_KIT` in `./kit.ts`.
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

describe("msm pack ability coverage", () => {
  const allRefs = MSM_CARDS.flatMap(abilityRefIds);

  it("has 33 cards and 33 ability references, each id unique", () => {
    expect(MSM_CARDS).toHaveLength(33);
    expect(allRefs).toHaveLength(33);
    expect(new Set(allRefs).size).toBe(allRefs.length);
  });

  it("every ability reference resolves — scripted directly, or aliased as a Core reprint", () => {
    const registry: Record<string, unknown> = { ...WAVE1_REPRINT_ABILITIES, ...MSM_ABILITIES };
    const unresolved = allRefs.filter((id) => !(id in registry));
    expect(unresolved, `unresolved msm ability refs (not scripted, not a Core reprint):\n${unresolved.join("\n")}`).toEqual([]);
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
