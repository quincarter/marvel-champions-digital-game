import { describe, expect, it } from "vitest";
import { parseCardText } from "./parse-text.ts";

/**
 * "Max 1 per phase." (maxperphase fix): Maximum Velocity (`qsv` 14005) and "Bring It!" (`drax` 19030) are the
 * only two printed instances across all emitted data. Before this fix the sentence fell through
 * `parseRestriction` unclassified and was misread as a bogus `<slug>-constant` ability.
 */
describe("parseRestriction: Max N per phase", () => {
  it("sets restrictions.maxPerPhase and does not emit a stray constant ability", () => {
    const text = "Max 1 per phase.\nHero Action: You get +2 THW, +2 ATK, and +2 DEF until the end of the round.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.restrictions.maxPerPhase).toBe(1);
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities).toEqual([
      {
        kind: "action",
        form: "hero",
        text: "Hero Action: You get +2 THW, +2 ATK, and +2 DEF until the end of the round.",
      },
    ]);
  });
});

/**
 * MarvelCDB drops the trailing period on a "Max N per …" sentence when it is immediately followed by a line
 * break instead of another sentence: "Max 1 per deck" (Flora and Fauna, `gmw` 16020/16048, no trailing period)
 * and "Max 1 per player" (X-Gene, `jubilee` 47020 / `rogue` 38019, no trailing period). Both used to fall
 * through `parseRestriction` unclassified and become a bogus `<slug>-constant` ability.
 */
describe("parseRestriction: Max N per deck/player, no trailing period", () => {
  it('"Max N per deck" (no period) resolves to maxPerDeckText, not a stray constant ability', () => {
    const text = "Team-Up (Groot and Rocket Raccoon).\nMax 1 per deck\nHero Action: Place 2 growth counters on Groot.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.maxPerDeckText).toBe(1);
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities).toEqual([
      { kind: "action", form: "hero", text: "Hero Action: Place 2 growth counters on Groot." },
    ]);
  });

  it('"Max N per player" (no period) resolves to restrictions.maxPerPlayer, not a stray constant ability', () => {
    const text =
      "Play only if your identity has the MUTANT trait. Max 1 per player\nResource: Exhaust X-Gene → generate a [wild] resource for an identity-specific event.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.restrictions.maxPerPlayer).toBe(1);
    expect(parsed.restrictions.requiresIdentityTrait).toBe("MUTANT");
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities).toEqual([
      {
        kind: "resource",
        text: "Resource: Exhaust X-Gene → generate a [wild] resource for an identity-specific event.",
      },
    ]);
  });
});
