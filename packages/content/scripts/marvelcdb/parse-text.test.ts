import { describe, expect, it } from "vitest";
import { parseCardText } from "./parse-text.ts";
import { toPlainText } from "./text.ts";

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

/**
 * docs/phase7-wave2-data.md "Part 8": a persistent constant clause printed alongside exactly one triggered clause
 * under a single obligation splits into a `constant` ref + the triggered ref, since an `AbilityDefinition` carries
 * exactly one trigger. Martial Law (`trors` 04165) prints the trigger header bare, at a sentence boundary, so
 * `HEADER_RE`'s ordinary boundaries (line start / `.`/`)`/`!` + space) already find it.
 */
describe("obligation preamble split: a bare trigger header (trors 04165 Martial Law)", () => {
  it("splits into a constant ref (the hand-size clause) and an alter-ego-action ref (the trigger)", () => {
    const text =
      "Your hand size is reduced by 1.\nAlter-Ego Action: Deal yourself an encounter card and spend a [energy] resource → discard this card.";
    const parsed = parseCardText(text, { obligation: true, villainNames: new Set() });

    expect(parsed.abilities).toEqual([
      { kind: "constant", text: "Your hand size is reduced by 1." },
      {
        kind: "action",
        form: "alter-ego",
        text: "Alter-Ego Action: Deal yourself an encounter card and spend a [energy] resource → discard this card.",
      },
    ]);
  });
});

/**
 * System Shock (`mts` 21185) prints the same constant + single-trigger shape as Martial Law, but the trigger
 * header is nested inside a quoted "it gains: '…'" clause rather than printed bare — `HEADER_RE`'s ordinary
 * boundaries never match a header immediately after an opening quote mark with no following space, so this shape
 * fell through to the whole-text `obligation` catchall (one ref, unscriptable: an `AbilityDefinition` has exactly
 * one trigger) until `QUOTED_HEADER_RE` added the quote-mark boundary for obligation parsing specifically.
 */
describe("obligation preamble split: a quoted trigger header (mts 21185 System Shock)", () => {
  it("splits into a constant ref (the discard restriction) and an alter-ego-action ref (the quoted trigger)", () => {
    const text =
      'You cannot choose to discard this card from your hand.\nWhile this card is in your hand, it gains: "Alter-Ego Action: Spend a [mental] resource → remove this card from the game."';
    const parsed = parseCardText(text, { obligation: true, villainNames: new Set() });

    expect(parsed.abilities).toEqual([
      { kind: "constant", text: "You cannot choose to discard this card from your hand." },
      {
        kind: "action",
        form: "alter-ego",
        text: 'Alter-Ego Action: Spend a [mental] resource → remove this card from the game."',
      },
    ]);
  });
});

/**
 * Wave 6 attach shapes (docs/phase7-wave6.md §1.3): Homo Superior / Energy Barrier (`mut_gen` 32077, 32103) end the
 * attach sentence with "and give it a tough status card", and Targeted for Elimination (32107) attaches to "your
 * identity if a copy of … is not attached to you".
 */
describe("attach shapes: tough status clause and identity without a named attachment", () => {
  it('"Attach to a minion and give it a tough status card." parses the host and keeps the clause as its own sentence', () => {
    const parsed = parseCardText(
      "Attach to a minion and give it a tough status card. Otherwise, this card gains surge.",
      {
        villainNames: new Set(),
      },
    );
    expect(parsed.attachesTo).toEqual({ kind: "minion" });
    expect(parsed.unclassified.filter((u) => u.includes("attach rule"))).toEqual([]);
  });

  it('"Attach to your identity if a copy of X is not attached to you." is a yourIdentity host without X', () => {
    const parsed = parseCardText(
      "Attach to your identity if a copy of Targeted for Elimination is not attached to you. Otherwise, this card gains surge.",
      { villainNames: new Set() },
    );
    expect(parsed.attachesTo).toEqual({ kind: "yourIdentity", withoutAttachmentNamed: "Targeted for Elimination" });
  });
});

/**
 * MarvelCDB writes some ability names with U+2212 ("Charge de Card − Action": Gambit 37001a, Rogue 38001a); the scans
 * print an em dash. Before the normalization the name was missed and the ability came out as an unlabeled constant.
 */
describe("U+2212 separator in ability names", () => {
  it("reads a named action behind a minus sign as a labeled action", () => {
    const html = "<b><i>Charge de Card</i> − Action</b>: Place 1 charge counter on Gambit.";
    const parsed = parseCardText(toPlainText(html), { villainNames: new Set() });

    expect(toPlainText(html)).toBe("Charge de Card — Action: Place 1 charge counter on Gambit.");
    expect(parsed.abilities).toHaveLength(1);
    expect(parsed.abilities[0]).toMatchObject({ kind: "action", name: "Charge de Card" });
  });

  it("leaves an unspaced minus sign alone", () => {
    expect(toPlainText("-1 ATK −1")).toBe("-1 ATK −1");
  });
});

/** Touched (`rogue` 38002): the "If Touched is attached to a:" lead-in joins its first bullet (four rules, not five). */
describe("bullet list lead-in", () => {
  it("emits one constant per bullet, the lead-in folded into the first", () => {
    const text =
      "If Touched is attached to a:\nMinion — Rogue's attacks gain overkill.\nVillain — Rogue gains retaliate 1.\nAlly — Rogue gains the AERIAL trait.\nHero — Rogue gains stalwart.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.abilities.map((a) => a.kind)).toEqual(["constant", "constant", "constant", "constant"]);
    expect(parsed.abilities[0]?.text).toBe("If Touched is attached to a: Minion — Rogue's attacks gain overkill.");
  });
});

describe("obligation: unheaded When Revealed sentence (Permanently Phased, mut_gen 32055)", () => {
  const text =
    "Give to the Kitty Pryde player.\nFlip your mass form upgrade to Phased. You cannot attack, defend or change mass form.\nAlter-Ego Action: Exhaust Kitty Pryde → remove Permanently Phased from the game.";
  const villainNames = new Set<string>();

  it("splits the named sentence into a when-revealed ability and keeps the rest constant", () => {
    const parsed = parseCardText(text, {
      obligation: true,
      villainNames,
      unheadedWhenRevealed: "Flip your mass form upgrade to Phased.",
    });
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities.map((a) => [a.kind, a.text])).toEqual([
      ["when-revealed", "Flip your mass form upgrade to Phased."],
      ["constant", "Give to the Kitty Pryde player. You cannot attack, defend or change mass form."],
      ["action", "Alter-Ego Action: Exhaust Kitty Pryde → remove Permanently Phased from the game."],
    ]);
    expect(parsed.abilities[0]?.cardQualifiedId).toBe(true);
  });

  it("reports a sentence that is not in the text", () => {
    const parsed = parseCardText(text, { obligation: true, villainNames, unheadedWhenRevealed: "Nope." });
    expect(parsed.unclassified).toHaveLength(1);
  });
});

describe("triggered lead-in owns its bullets (Lockheed mut_gen 32032)", () => {
  it("emits one response ability, not a constant per bullet", () => {
    const text =
      "Response: After Lockheed enters play, if you are in:\n• Solid mass form, deal 2 damage to an enemy.\n• Phased mass form, remove 2 threat from a scheme.";
    const parsed = parseCardText(text, { villainNames: new Set() });
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities.map((a) => a.kind)).toEqual(["response"]);
    expect(parsed.abilities[0]?.text).toContain("Phased mass form");
  });
});

/** docs/phase7-wave6.md §3.28: a maximum over a trait ("Max 1 TRAINING upgrade per ally.", "Max 1 TEAM card per player."). */
describe("parseRestriction: Max N [TRAIT] upgrade per ally / card per player", () => {
  it("'Max 1 Training upgrade per ally.' is maxWithTrait per host, uppercased, not a constant ability", () => {
    const text = "Attach to an X-MEN ally. Max 1 Training upgrade per ally.\nAttached ally gets +3 hit points.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.restrictions.maxWithTrait).toEqual({ trait: "TRAINING", per: "host", max: 1 });
    expect(parsed.restrictions.maxPerHost).toBeUndefined();
    expect(parsed.unclassified).toEqual([]);
    expect(parsed.abilities).toEqual([{ kind: "constant", text: "Attached ally gets +3 hit points." }]);
  });

  it("'Max 1 TEAM card per player.' is maxWithTrait per player", () => {
    const text =
      "Play under any player's control. Max 1 TEAM card per player.\nEach of your X-MEN allies gets +1 hit point.";
    const parsed = parseCardText(text, { villainNames: new Set() });

    expect(parsed.restrictions.maxWithTrait).toEqual({ trait: "TEAM", per: "player", max: 1 });
    expect(parsed.restrictions.anyPlayerControl).toBe(true);
    expect(parsed.restrictions.maxPerPlayer).toBeUndefined();
  });
});
