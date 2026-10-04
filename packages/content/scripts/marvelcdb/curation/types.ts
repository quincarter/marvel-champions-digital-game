/**
 * Hand-curated, per-pack inputs to ingestion: everything MarvelCDB can't give
 * us (or gives us wrong). Every entry cites the evidence it rests on, so a
 * reviewer can re-check it without re-deriving it.
 */
import type {
  AttachmentHost,
  CoreAspect,
  IdentityDeckbuilding,
  MainSchemeThreatField,
  ResourceIconCounts,
  SeparateGameAreas,
  SpecialCost,
  Trait,
} from "../../../src/schema/index.ts";

/**
 * A correction to MarvelCDB's transcription of the *physical card*. Applies to
 * both printed and current text/stats (it is not errata — the card always said
 * this; MarvelCDB just has it wrong). Each `textReplace.find` must occur in the
 * source text exactly once or ingestion fails, so drift in MarvelCDB (e.g.
 * they fix it upstream) is noticed instead of silently double-applied.
 */
export interface Correction {
  /** MarvelCDB code of the record/face being corrected. */
  readonly code: string;
  readonly reason: string;
  /** Where the correct value was verified (printed card, Learn to Play page, second database). */
  readonly evidence: string;
  readonly textReplace?: { readonly find: string; readonly replace: string };
  readonly name?: string;
  readonly traits?: readonly string[];
  readonly boost?: number;
  /** Attachment stat-box ATK modifier (MarvelCDB `attack` on an attachment). */
  readonly attack?: number;
  /** MarvelCDB fields with no printed counterpart on this card type — ignored, with the reason recorded. */
  readonly ignoreFields?: readonly string[];
  /**
   * Confirms a printed dash cost from the card image (wave 2, docs/phase7-wave2.md §1.3/§5.1): MarvelCDB sends
   * no `cost` at all for a card that "cannot be played and can only enter play through other means" (RRG 1.8
   * "Dash (Value)", p. 15), which is otherwise indistinguishable from a data error. A printed cost of "X" (RRG
   * 1.8 "Non-Numerical Variable", p. 30) never needs this — MarvelCDB's `cost: -1` is unambiguous and is read
   * automatically, with no correction.
   */
  readonly specialCost?: SpecialCost;
  /**
   * The printed card back where it differs from the card type's default (`BaseCard.cardBack`): `"encounter"` for a
   * player-typed card printed with an encounter back (Longshot, `mojo` 39071, MojoMania insert p. 2). MarvelCDB sends no
   * card-back field for a single-faced card, so only a cited insert or back scan can set this.
   */
  readonly cardBack?: "encounter" | "player";
  /**
   * Overrides MarvelCDB's `quantity` (physical copies printed in this pack) — wave 4, Nebula's `22017` ("The
   * Power of Justice") sends `quantity: 1` despite the box's own printed decklist card (Hall of Heroes'
   * `nebula-starter-deck.jpg`) listing "17 The Power of Justice x2" and the card's own errata-free text ("Max 2
   * per deck"); the analogous card in other packs (e.g. Star-Lord's `17018` "The Power of Leadership") sends
   * `quantity: 2` for the same role, so this is MarvelCDB undercounting one pack's duplicate-of record rather
   * than a real one-copy print. Only ever a correction to a MarvelCDB data error, never errata.
   */
  readonly quantityInSet?: number;
  /**
   * The host of an attachment that prints no "Attach to X." sentence at all — its host is established by another
   * card's own effect instead of the ordinary reveal-and-attach rule (wave 4, docs/phase7-wave4.md §1.13): Focused
   * Defense (`mts` 21101) is put into play "attached to this stage" by The Armies of Thanos 2A's own When Revealed;
   * Fallen Warrior (`mts` 21153) puts the ally it discards for into play "with Fallen Warrior attached to it" by
   * its own When Revealed. Unlike every other `Correction` field, this is never applied to text — the printed card
   * really has no attach sentence, and the pipeline must not fabricate one just to satisfy the schema's mandatory
   * `attachesTo` field. Widened (wave 5, docs/phase7-wave5.md §1.9) for two more cards whose "Attach to"/"Attach
   * X to" clause sits inside a `When Revealed:` ability body rather than as its own preamble sentence, so the
   * parser's `sentence.startsWith("Attach to ")` preamble scan never sees it: Manipulated Mind (`sm` 27171,
   * "When Revealed: Attach to the ally you control with the lowest cost...") is `"ally"` (the specific "lowest
   * cost" narrowing is the When Revealed ability's own job, the same way Focused Defense's host is just
   * `"mainScheme"` rather than "the stage this ability names"); Old Grudge (`sm` 27172, "When Revealed: Search
   * ... for your nemesis minion ... Attach Old Grudge to it.") is `"minion"` (the specific minion is the search's
   * own result). Widen further only with another cited card that needs a different structural kind.
   *
   * `"ownWhenRevealed"` (wave 5): the card has no "attach to" text and attaches itself from its own When Revealed, so
   * the emitted card carries **no** `attachesTo` at all. RRG 1.8 "Reveal" (p. 38) step 2: an attachment without
   * "attach to" text is placed in front of the revealing player, not in play; ruling, Feb 20, 2026 (4): "If an
   * attachment lacks 'attach to' text, it attaches when its 'When Revealed' ability triggers". Old Grudge (`sm`
   * 27172) moved to it from `"minion"`, which made the reveal attach it to an arbitrary minion in play before its
   * own search ran; Fallen Warrior (`mts` 21153) moved to it from `"ally"` for the same reason (it attaches to the ally
   * its own When Revealed mills out of the deck).
   *
   * A full `AttachmentHost` (wave 5) for a When Revealed "Attach to X" whose X the plain kinds cannot say: Manipulated
   * Mind (`sm` 27171) moved from `"ally"` to "the ally you control with the lowest cost" (`superlative`, `printedCost`,
   * `controlledBy: "you"`), which `"ally"` let the reveal attach to any player's ally.
   */
  /**
   * Main scheme B-side threat values that print a dash (RRG 1.8 "Dash (Value)", p. 15) although MarvelCDB sends a
   * number or nothing without its `*_fixed: true` flag (wave 6, docs/phase7-wave6.md §1.5/§1.6: `mut_gen` 32063b,
   * 32087b, 32125b). Applied to the stage's `dashedValues` and read as "not missing", so the normalizer neither
   * errors nor emits a threat the card does not print. Only ever on the B-side record (the one carrying the numbers).
   */
  readonly dashedThreatFields?: readonly MainSchemeThreatField[];
  /**
   * An obligation sentence that prints no `When Revealed:` header yet is a one-time instruction run on reveal
   * (wave 6, `mut_gen` 32055 Permanently Phased: "Flip your mass form upgrade to Phased."). Emitted as its own
   * `<card>-when-revealed` ability ref beside the `-constant` ref for the rest. Never applied to text.
   */
  readonly unheadedWhenRevealed?: string;
  readonly impliedAttachHost?: "mainScheme" | "ally" | "minion" | "ownWhenRevealed" | AttachmentHost;
}

/**
 * Official errata: the current text differs from the print. Usually MarvelCDB's text is the *current* wording, so
 * the original printed wording is reconstructed here by reversing the errata (`printedReplace` applied to the
 * current text).
 *
 * Some wave 1 MarvelCDB records lag the errata instead (`real_text`/`text` still carry the *printed* wording, with
 * no `errata` field set — Black Widow 08001a and Synth-Suit 08009, RRG 1.8 p.66 "trigger" → "resolve": MarvelCDB's
 * source text is verified as the original print here, and `currentReplace` derives the up-to-date wording forward
 * from it instead. Set exactly one of `printedReplace`/`currentReplace` per entry.
 */
export interface Errata {
  readonly code: string;
  readonly version: string;
  readonly changedFields: readonly string[];
  readonly note: string;
  readonly evidence: string;
  /** Applied (all occurrences) to MarvelCDB's (current) text to recover the printed text. */
  readonly printedReplace?: { readonly find: string; readonly replace: string };
  /** Applied (all occurrences) to MarvelCDB's (still-printed) text to derive the current, errata'd text. */
  readonly currentReplace?: { readonly find: string; readonly replace: string };
}

export interface StarterDeckCuration {
  readonly id: string;
  readonly name: string;
  readonly identityCode: string;
  readonly aspect: CoreAspect;
  /**
   * Wave 2: a second aspect for a precon that draws from two (Spider-Woman's Double Agent ability, RRG 1.8 p. 60
   * FAQ, docs/phase7-wave2.md §1.2) — every other precon has exactly one aspect and leaves this unset. Both
   * `aspect` and every listed `secondaryAspects` entry accept a plain (non-identity-specific) card in `cards`.
   */
  readonly secondaryAspects?: readonly CoreAspect[];
  /**
   * Wave 3: card codes covered by the identity's own `IdentityDeckbuilding.offAspectAllowance` (Gamora's Skilled
   * Tactician — First Hit/Impede, docs/phase7-wave3.md §1.5), for `normalizeStarterDecks`' per-card aspect check
   * only. Unlike `secondaryAspects`, these do **not** add an aspect to the emitted `StarterDeck.aspects` — the
   * deck still has exactly one *chosen* aspect (`@mc/engine`'s `validateDeck` requires `aspects.length === 1`
   * unless the identity's `deckbuilding.aspectCount` says otherwise, which `offAspectAllowance` never does), and
   * `validateDeck` recognizes these cards through the identity's own `offAspectAllowance` field at runtime, not
   * through anything printed on the `StarterDeck` record itself.
   */
  readonly offAspectAllowanceCodes?: readonly string[];
  /** MarvelCDB code → quantity, exactly as the source lists it (identity excluded). */
  readonly cards: Readonly<Record<string, number>>;
  /** The obligation and nemesis cards the source lists for this deck, cross-checked against the identity links. */
  readonly obligationCode: string;
  readonly nemesisCodes: readonly string[];
  readonly verified: boolean;
  readonly sources: readonly string[];
  readonly note?: string;
}

/**
 * A scenario with several villains at once (The Wrecking Crew, docs/phase7-wave1.md §1.1). Set-code based, like the
 * rest of curation — resolved to card ids by the normalizer, the same way `villainSetCode` is.
 */
export interface MultipleVillainsCuration {
  /** Every villain's encounter set, in printed order. Must start with the curation's own `villainSetCode`. */
  readonly villainSetCodes: readonly string[];
  /**
   * Each villain's signature side scheme MarvelCDB code, parallel to `villainSetCodes` (The Wrecking Crew's
   * "Wrecker's Side Scheme."-style cards). Absent/empty when the scenario's villains have none (Tower Defense,
   * whose villains are told apart by `MainSchemeStage.villainOf` instead, docs/phase7-wave4.md §1.5).
   */
  readonly signatureSideSchemeCodes?: readonly string[];
  /**
   * Direct MarvelCDB villain-card codes, parallel to `villainSetCodes`, overriding the normal per-set lookup
   * (wave 4, docs/phase7-wave4.md §1.6) — Tower Defense's Proxima Midnight and Corvus Glaive share one
   * `card_set_code` (`tower_defense`) with colliding stage numbers (each I–III), the same "several single-stage
   * villains, one set" shape `normalizeVillains` already gives Kang/Sinister-Six, which leaves `villainIdBySet`
   * unset for that set — so each villain must be named by its own stage-I card code instead. Absent = resolve via
   * `villainIdBySet.get(villainSetCodes[i])`, the normal (Wrecking Crew) case.
   */
  readonly villainCardCodes?: readonly string[];
  /**
   * `MultipleVillains.encounterDecks` (docs/phase7-wave4.md §1.6) — Tower Defense's one shared deck built from the
   * scenario's own sets, instead of The Wrecking Crew's one deck per villain. Absent = `"perVillain"`.
   */
  readonly encounterDecks?: "perVillain" | "shared";
  /**
   * `MultipleVillains.winCondition` (wave 5, docs/phase7-wave5.md §1.5 — The Sinister Six): defeating every
   * villain in play does not win by itself; the scenario wins by its own main scheme's card ability (Light at
   * the End's "the players escape and win the game"). Absent = `"allVillainsDefeated"` (The Wrecking Crew,
   * Tower Defense).
   */
  readonly winCondition?: "cardAbility";
  /**
   * `MultipleVillains.atSetup` (wave 5, docs/phase7-wave5.md §1.5): every listed villain starts set aside
   * (`encounterSetAside`) instead of in play; the main scheme's own Setup puts them into play. Absent = every
   * villain starts in play (The Wrecking Crew, Tower Defense, Loki's own set-aside villains are a different,
   * `Scenario.setAsideVillainCardCodes`, shape).
   */
  readonly atSetup?: "setAside";
}

/**
 * A scenario's separate deck (wave 2, docs/phase7-wave2.md §1.8) — the curated, MarvelCDB-code form of
 * `ScenarioSeparateDeck` (`contents.encounterSetIds` becomes `contents.encounterSetCodes`, resolved by the
 * normalizer the same way every other encounter-set reference is).
 */
export interface ScenarioSeparateDeckCuration {
  readonly name: string;
  readonly contents: {
    readonly encounterSetCodes?: readonly string[];
    readonly cardType?: "side_scheme" | "environment";
    /** Wave 4 (docs/phase7-wave4.md §1.10): only cards with this printed trait (the Infinity Stone deck). */
    readonly trait?: Trait;
    /** `ScenarioSeparateDeck.contents.cardIds`, by MarvelCDB code (wave 6 §3.66: Cornered! joins the show deck). */
    readonly cardCodes?: readonly string[];
  };
  readonly discardPile: "own" | "encounter" | "none";
  readonly whenEmpty: "reshuffleDiscardWithoutPenalty" | "remainsEmpty";
  /** `ScenarioSeparateDeck.closedToPlayerCards` (wave 6 §3.66: the show deck, MojoMania insert p. 11). */
  readonly closedToPlayerCards?: true;
}

/**
 * Per-`EncounterSet` overrides keyed by MarvelCDB `card_set_code` (wave 4, docs/phase7-wave4.md §1.10) — fields
 * `EncounterSet` itself carries that no other curation input produces (unlike `classification`, which the
 * normalizer derives structurally from the set id). The Infinity Gauntlet set's own separate deck and
 * single-villain restriction.
 */
export interface EncounterSetCuration {
  readonly separateDecks?: readonly ScenarioSeparateDeckCuration[];
  readonly singleVillainOnly?: true;
  /** `EncounterSet.extraModular` (docs/phase7-wave6.md §3.63, §4 Q43): Longshot's one-card set. */
  readonly extraModular?: true;
  /**
   * `EncounterSet.campaignSpecific` for a set whose cards do not carry MarvelCDB's `campaign` faction: owner decision
   * 2026-10-04 (GMW Campaign Challenge, RRG 1.8 p. 61).
   */
  readonly campaignSpecific?: true;
}

export interface ScenarioCuration {
  readonly id: string;
  readonly name: string;
  readonly villainSetCode: string;
  /**
   * Direct MarvelCDB code for the villain card, overriding the normal `villainSetCode` lookup (wave 2 — The Once
   * and Future Kang). `normalizeVillains` deliberately leaves `villainIdBySet` unset for a set whose stage
   * numbers collide (several single-stage villains sharing one `card_set_code`, e.g. "kang"/"exp_kang" —
   * `normalize/villains.ts`'s own comment on that shape) because there is no single "the villain" of that set;
   * this names one of those records directly instead. Absent = resolve normally via `villainSetCode`.
   */
  readonly villainCardCode?: string;
  /**
   * The MarvelCDB `card_set_code` the main scheme is filed under, when it differs from `villainSetCode` — The
   * Wrecking Crew's Breakout is its own `wrecking_crew` set, not Wrecker's `wrecker` set (docs/phase7-wave1.md
   * §2.3). Absent = `villainSetCode` (Core and the Green Goblin scenarios: one set holds the villain, main scheme,
   * minions and treacheries together).
   */
  readonly mainSchemeSetCode?: string;
  /**
   * Encounter sets always in the deck besides the villain's own set (wave 2 — The Rise of Red Skull's rulebook
   * pages list some scenarios' "Encounter sets (required)" as more than just the villain's own set: Crossbones
   * needs Experimental Weapons, Taskmaster needs Hydra Patrol). Absent = none (every wave 1/Core scenario).
   */
  readonly additionalEncounterSetCodes?: readonly string[];
  readonly recommendedModularSetCodes: readonly string[];
  readonly standardSetCodes: readonly string[];
  readonly expertSetCodes: readonly string[];
  readonly villainStages: { readonly standard: readonly [number, number]; readonly expert: readonly [number, number] };
  readonly evidence: string;
  /** Present for a scenario with several villains in play at once. Absent = one villain. */
  readonly multipleVillains?: MultipleVillainsCuration;
  /** Absent = true (RRG 1.8 Appendix II steps 4-5 run normally). The Wrecking Crew insert sets this false. */
  readonly usesIdentityEncounterSets?: boolean;
  /** Absent = 1 (one modular encounter set). The Wrecking Crew insert sets this 0. */
  readonly modularSetCount?: number;
  /**
   * See `Scenario.setAsideModularSetCount` (docs/phase7-wave4.md §1.12) — The Hood's Making Connections 1A:
   * "Choose 7 modular encounter sets and set them aside (you may choose randomly)." Absent = none set aside.
   */
  readonly setAsideModularSetCount?: number | { readonly base: number; readonly perPlayer: number };
  /**
   * `Scenario.modularSetPool` (docs/phase7-wave6.md §3.63, §4 Q44), with MarvelCDB set codes. Absent: any modular set.
   */
  readonly modularSetPool?: { readonly setCodes: readonly string[]; readonly restricted: boolean };
  /**
   * MarvelCDB codes of villain cards set aside at setup rather than started in the villain deck (wave 2 — The
   * Once and Future Kang insert, "Setup": Kang (II) and Kang (III) are set aside; only Kang (I) starts in the
   * deck). Resolved to card ids the same way `villainCardCode` is. Absent = none.
   */
  readonly setAsideVillainCardCodes?: readonly string[];
  /**
   * Expert-mode villain replacement (wave 2 — Kang insert, "Adjustable Difficulty": expert mode swaps in the six
   * Expert Kang villains and their own encounter set entirely). Absent = standard mode's villain(s) are used in
   * expert mode too (every Core/wave 1/other cycle 1 scenario).
   */
  readonly expertVillains?: { readonly villainCardCode: string; readonly setAsideVillainCardCodes: readonly string[] };
  /** Absent = `"finalVillainStage"`. See `Scenario.victory`. */
  readonly victory?: "finalVillainStage" | "cardAbility";
  /** See `Scenario.separateGameAreas` (wave 2 — Kang). Absent = the scenario has none. */
  readonly separateGameAreas?: SeparateGameAreas;
  /** See `Scenario.separateDecks` (wave 2 — Crossbones' Experimental Weapons deck, Red Skull's side-scheme deck). */
  readonly separateDecks?: readonly ScenarioSeparateDeckCuration[];
  /**
   * MarvelCDB codes of non-villain cards the scenario's own setup needs from outside its encounter sets, resolved to
   * `Scenario.setAsideCardIds` (wave 6, docs/phase7-wave6.md §1.8 — Master Mold's Magneto ally 32172b). Absent = none.
   */
  readonly setAsideCardCodes?: readonly string[];
  /** See `Scenario.startingVillain` (wave 4, docs/phase7-wave4.md §1.11 — Loki). */
  readonly startingVillain?: "random";
  /** See `Scenario.victoryCondition` (wave 4, docs/phase7-wave4.md §1.11 — Loki). */
  readonly victoryCondition?: {
    readonly standard: number;
    readonly expert: number;
    readonly skirmish?: number;
    readonly heroic?: number;
  };
}

/**
 * A card belonging to an identity's separate deck (docs/phase7-wave1.md §1.9 — Doctor Strange's Invocation deck),
 * instead of a player deck. `deckLimit` is forced to 0 and `separateDeck` to `deckName` for every listed code,
 * regardless of what MarvelCDB's `deck_limit` field says (it is typically absent for these records).
 */
export interface SeparateDeckCuration {
  readonly identityCode: string;
  readonly deckName: string;
  readonly cardCodes: readonly string[];
  /**
   * The `IdentitySeparateDeck` rules (docs/phase7-wave6.md §3.45). Each absent field takes Doctor Strange's Invocation
   * deck value (`topCardFaceup: true`, `discardPile: "own"`, `whenEmpty: "reshuffleDiscardWithoutPenalty"`, family
   * `"player"`), so `drs` regenerates unchanged. Storm's Weather deck is facedown with no discard pile and stays empty.
   */
  readonly topCardFaceup?: boolean;
  readonly discardPile?: "own" | "none";
  readonly whenEmpty?: "reshuffleDiscardWithoutPenalty" | "stayEmpty";
  readonly cardFamily?: "player" | "encounter";
}

/**
 * A MarvelCDB record that is not a printed card at all — a spurious duplicate in the raw feed, not a printed-card
 * correction (`Correction`) or a card this pack simply doesn't cover. Distinct from a MarvelCDB *aggregate*
 * record (`flatten.ts`'s `isAggregate`, a structural bare-code/suffixed-variants pattern): this is a hand-verified
 * one-off, so every entry must cite the evidence it rests on, same as a `Correction`.
 *
 * Example: The Rise of Red Skull's `10098` ("Shang-Chi", `faction_code: "hero"`, `card_set_code: "taskmaster"`,
 * `deck_limit: 1`) duplicates the real Captive ally `04098` under a code in Hulk's (`10xxx`) range, and is not a
 * printed card (docs/phase7-wave2.md §5.2).
 */
export interface IgnoredRecord {
  readonly code: string;
  readonly reason: string;
  readonly evidence: string;
}

/**
 * One face's worth of hand-transcribed card data for a separated identity's missing alter-ego card (see
 * `SeparatedIdentitySource`) — plain text, exactly as `prepare()` would produce from a real MarvelCDB record, but
 * sourced from a second-source scan instead since MarvelCDB has no record at all.
 */
export interface SeparatedIdentitySourceFace {
  readonly name: string;
  /** Printed traits, verbatim (e.g. "Civilian." → `["CIVILIAN"]`). */
  readonly traits: readonly string[];
  readonly text: string;
  readonly flavor?: string;
  /** Absolute URL to the second-source scan (see `PackCuration.imageOverrides`'s evidence bar). */
  readonly image?: string;
  /** Printed resource icons, read from the scan (absent: none). Only a non-identity side carries them. */
  readonly resourceIcons?: ResourceIconCounts;
}

/**
 * A separated identity's alter-ego card, sourced entirely from curation because MarvelCDB has no record of it at
 * all (SP//dr's Peni Parker, 31002/31002a/31002b — docs/phase7-wave2.md §6.10). Keyed in
 * `PackCuration.separatedIdentities` by the *hero* record's own MarvelCDB code (e.g. "31001a"), whose
 * `linked_card` points at the card's own other side (a `support`/`upgrade` type, not `alter_ego`) — the
 * structural signal that this is a separated identity rather than an ordinary one.
 */
export interface SeparatedIdentitySource {
  /** The missing card's own collector number ("31002"), with no MarvelCDB record under it at all. */
  readonly alterEgoCardNumber: string;
  readonly alterEgo: SeparatedIdentitySourceFace & { readonly handSize: number; readonly rec: number };
  /** The alter-ego card's own flip side (an upgrade, per `SeparatedIdentity.alterEgoCardOtherSide`). */
  readonly alterEgoOtherSide: SeparatedIdentitySourceFace;
  /** Where every field above was verified (a second-source scan gallery, viewed directly — never stored as bytes). */
  readonly evidence: string;
}

export interface PackCuration {
  readonly packCode: string;
  readonly cycle: { readonly id: string; readonly name: string; readonly order: number };
  readonly pack: { readonly name: string; readonly releaseDate: string; readonly releaseDateSource: string };
  /** Output directory, relative to packages/content. */
  readonly outDir: string;
  /** Prefix for exported constants: "CORE" → CORE_CARDS, CORE_PACK, … */
  readonly exportPrefix: string;
  readonly corrections: readonly Correction[];
  readonly errata: readonly Errata[];
  /** AbilityId → plain-language handoff for `ability-scripting-engineer`. Only where the text is non-obvious. */
  readonly scriptingNotes: Readonly<Record<string, string>>;
  /** CardId → note on a card-level data decision (e.g. a stat the schema can't express). */
  readonly cardNotes: Readonly<Record<string, string>>;
  readonly scenarios: readonly ScenarioCuration[];
  readonly starterDecks: readonly StarterDeckCuration[];
  /** Player cards that belong to an identity's separate deck rather than a player deck. */
  readonly separateDecks?: readonly SeparateDeckCuration[];
  /** MarvelCDB records to drop entirely — not a printed card (see `IgnoredRecord`). Absent = none. */
  readonly ignoredRecords?: readonly IgnoredRecord[];
  /**
   * A stable, absolute URL to use as a face's artwork reference when MarvelCDB has none at all for that record
   * (`imagesrc: null`, confirmed by a direct 404 on MarvelCDB's own bundle path — not merely absent from the
   * cached pack response) — MarvelCDB code → absolute URL. `checkCoverage`'s "no artwork reference" check is a
   * hard error with no other override (CLAUDE.md "Content & IP boundaries": a reference, never image bytes, so
   * this stores a URL exactly the way a MarvelCDB path does, just against a different, cited host). Every use
   * must be independently verified (viewed, not fabricated) against the second source before being entered here —
   * e.g. Quicksilver's alter-ego face (`14001b`), which Hall of Heroes' own release-page gallery scan
   * (https://hallofheroeslcg.com/quicksilver/) shows and MarvelCDB does not host at all.
   */
  readonly imageOverrides?: Readonly<Record<string, string>>;
  /**
   * `HeroIdentityCard.deckbuilding` overrides, MarvelCDB identity code → the field (wave 2, docs/phase7-wave2.md
   * §1.2). RRG 1.8 FAQ "Jessica Drew (#31B)" (p. 60): "Does Jessica Drew's Double Agent ability require her deck
   * to be built with two aspects? A: Yes. An equal number of cards from two different aspects must be included
   * in her deck." No wave 1 identity needed this; the field has no automatic MarvelCDB source (it's a rules
   * exception, not a printed stat), so it's always hand-curated.
   */
  readonly identityDeckbuilding?: Readonly<Record<string, IdentityDeckbuilding>>;
  /**
   * `HeroIdentityCard.progressingIdentity.versions`, keyed by every version's own MarvelCDB hero code (wave 5,
   * docs/phase7-wave5.md §1.4 — Ironheart). The Ironheart insert, "New Rules: Progressing Identity Cards": three
   * complete identity cards share one hit point dial; the weakest is put into play at setup, and only its
   * alter-ego prints "Begin the game with this card." Every version lists the same array, weakest first
   * (`["29001a", "29002a", "29003a"]`); MarvelCDB has no field for this (three unlinked hero/alter-ego pairs), so
   * it is always hand-curated.
   */
  readonly progressingIdentity?: Readonly<Record<string, readonly string[]>>;
  /**
   * A separated identity's missing alter-ego card, keyed by the hero record's MarvelCDB code (wave 2 schema pass,
   * docs/phase7-wave2.md §6.10 — SP//dr). Only a hero record whose `linked_card` exists but is not type
   * `alter_ego` (the structural signature of a separated identity) ever consults this map.
   */
  readonly separatedIdentities?: Readonly<Record<string, SeparatedIdentitySource>>;
  /**
   * Villain sets (`card_set_code`) whose one linked A/B pair prints the standard and expert *versions* of the villain
   * (MojoMania's MaGog, insert p. 8), not two stages of one villain: each face becomes its own one-stage card, the
   * way colliding version pairs already do (Mansion Attack, docs/phase7-wave6.md \u00a77.7). Absent = a lone pair chains
   * into one two-stage villain.
   */
  readonly separateVillainVersions?: readonly string[];
  /**
   * Villain sets whose MarvelCDB top-level record of each double-sided stage is the printed side A (MojoMania's
   * Spiral: 39012a ESCAPED is the face she starts on, its hidden linked record 39012b CORNERED is side B). The default
   * reads the top-level record as side B (Risky Business's Green Goblin face, docs/phase7-wave1.md \u00a71.3).
   */
  readonly villainFrontIsSideA?: readonly string[];
  /**
   * An auxiliary `card_set_code` → the pack's hero identity's own (primary) `card_set_code`, for a hero-kit card
   * MarvelCDB files under a themed sub-set instead of the identity's own set — Storm's four Weather Deck supports
   * (`storm_weather_deck` → `storm`; Clear Skies/Hurricane/Thunderstorm/Blizzard, a "one active weather condition
   * at a time" mechanic) is the confirmed case; the same shape recurs in `fne`/`hercules`/`iceman`'s own gap
   * matrix entries ("hero card in a set with no identity"), not yet individually confirmed. Resolved by aliasing
   * the auxiliary set code to the primary set's own hero record in `heroBySet` — every `aspect: hero:<id>` lookup
   * keyed off `card_set_code` (deckbuilding, `printedAspect`, nemesis-set naming) then works unchanged.
   */
  readonly auxiliaryHeroSetCodes?: Readonly<Record<string, string>>;
  /**
   * Hand-authored sibling modules in `outDir` (basenames, no extension) that the generated `index.ts` barrel must
   * re-export alongside the emitted ones — The Rise of Red Skull's `campaign.ts` (`TRORS_CAMPAIGN`: MarvelCDB has
   * no campaign record at all, docs/campaign-mode-design.md §3, so it can't be emitted). Ingestion fails if a listed
   * file is missing, so the barrel never names a module that doesn't exist. Absent = none.
   */
  readonly handAuthoredModules?: readonly string[];
  /**
   * `EncounterSet` overrides keyed by MarvelCDB `card_set_code` (wave 4, docs/phase7-wave4.md §1.10) — see
   * `EncounterSetCuration`. Absent = no set in this pack needs one.
   */
  readonly encounterSets?: Readonly<Record<string, EncounterSetCuration>>;
  /**
   * MarvelCDB codes that genuinely have no artwork reference anywhere on MarvelCDB (checked on the live API, not
   * merely the cached raw file) and for which no independently-viewable second source could be located either —
   * `checkCoverage`'s "no artwork reference" check treats a listed code as satisfied instead of a hard error, so
   * one missing scan doesn't block an otherwise-complete pack. Each value is the reason, naming what was searched
   * (mirroring `Correction`/`Errata`'s own evidence bar, even though there is no evidence *for* an image — there's
   * evidence that none exists). `checkCoverage` still hard-fails on any art-less face not listed here, and
   * `checkStaleCuration`-style checking (in `checkCoverage`, since encounter-set-level entries need the sets to
   * exist first — see `usedEncounterSetOverrides`) errors if an entry matches a face that does have art, the same
   * way a stale `imageOverrides` entry does. Resolved per-face via `NormalizeContext.faceCodesByCardId`; a card
   * type that doesn't populate that map for a given card can never have one of its faces exempted (a safe
   * fallback: it just can't offer an exemption, never a wrong one).
   */
  readonly artUnavailable?: Readonly<Record<string, string>>;
}
