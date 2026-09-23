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

/**
 * docs/phase7-wave3.md §3.37, `MainSchemeStage.completionLoses`: "If this stage/scheme is completed, the players
 * lose the game." is a rules reminder, not an ability — it must not become a bogus ability ref, and the caller
 * (`normalize/main-schemes.ts`) needs `ParsedText.completionLoses` to set the flag whether or not the stage is
 * the scenario's last. Before this fix the plain sentence was already stripped but not surfaced as a flag; the
 * "scheme" wording (mts 21138b, aoa 45062b, trors 04113b/04129b, …) was not recognized at all; and the two-clause
 * compound (Extract Captives `aos` 50089b, Mutant Massacre `next_evol` 40078b, The Grand Collection `gmw` 16073b)
 * was left as an ordinary constant ability with no flag set.
 */
describe("stage-completion loss reminder: MainSchemeStage.completionLoses", () => {
  it('"If this stage is completed, the players lose the game." is stripped and sets completionLoses (gmw 16082b)', () => {
    const text =
      "Forced Interrupt: When the last threat is removed from this scheme, advance to stage 2A (the players win by advancing).\nIf this stage is completed, the players lose the game.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.completionLoses).toBe(true);
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities).toEqual([
      {
        kind: "forced-interrupt",
        text: "Forced Interrupt: When the last threat is removed from this scheme, advance to stage 2A (the players win by advancing).",
      },
    ]);
  });

  it('"If this scheme is completed, the players lose the game." (the "scheme" wording) is also recognized (mts 21138b)', () => {
    const text =
      "Forced Interrupt: When Hela would be defeated, if Odin is attached to this scheme, discard each attachment from Hela and flip her to her wounded side instead.\nIf this scheme is completed, the players lose the game.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.completionLoses).toBe(true);
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities).toHaveLength(1);
    expect(parsed.abilities[0]?.kind).toBe("forced-interrupt");
  });

  it("a plain stage with no printed reminder leaves completionLoses unset (gmw 16061b)", () => {
    const text =
      '[star] Forced Response: After resolving step one of the villain phase, resolve the Badoon Ship\'s "Charge Up" ability.\nFirst Player Action: Exhaust the Milano → remove 3 threat from this scheme.';
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.completionLoses).toBeUndefined();
  });

  it('the two-clause compound sets completionLoses but keeps the other clause as a scriptable ability, "completed" leading (next_evol 40078b)', () => {
    const text =
      "Action: Exhaust a MORLOCK ally → shuffle Hide! from the encounter discard pile into the encounter deck.\nIf there are 3 villains under Routed, the players win the game.\nIf this stage is completed or there are no Morlock allies in play, the players lose the game.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.completionLoses).toBe(true);
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities.some((a) => a.kind === "constant" && a.text.includes("no Morlock allies in play"))).toBe(
      true,
    );
  });

  it('the two-clause compound also fires with the other clause leading, "completed" trailing (gmw 16073b)', () => {
    const text =
      "Hero Action: Choose to either exhaust your hero or spend 2 resources of any type → discard 1 card from The Collection (to its owner's discard pile). (Limit once per round per player.)\nIf there are at least 5[per_hero] cards in The Collection or if this stage is completed, the players lose the game.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.completionLoses).toBe(true);
    expect(parsed.unclassified).toEqual([]);
    const constant = parsed.abilities.find((a) => a.kind === "constant");
    expect(constant?.text).toContain(
      "If there are at least 5[per_hero] cards in The Collection or if this stage is completed",
    );
  });
});
