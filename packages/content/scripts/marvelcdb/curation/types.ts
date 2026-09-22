/**
 * Hand-curated, per-pack inputs to ingestion: everything MarvelCDB can't give
 * us (or gives us wrong). Every entry cites the evidence it rests on, so a
 * reviewer can re-check it without re-deriving it.
 */
import type { CoreAspect, IdentityDeckbuilding, SeparateGameAreas, SpecialCost } from "../../../src/schema/index.ts";

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
  /** Each villain's signature side scheme MarvelCDB code, parallel to `villainSetCodes`. */
  readonly signatureSideSchemeCodes: readonly string[];
}

/**
 * A scenario's separate deck (wave 2, docs/phase7-wave2.md §1.8) — the curated, MarvelCDB-code form of
 * `ScenarioSeparateDeck` (`contents.encounterSetIds` becomes `contents.encounterSetCodes`, resolved by the
 * normalizer the same way every other encounter-set reference is).
 */
export interface ScenarioSeparateDeckCuration {
  readonly name: string;
  readonly contents: { readonly encounterSetCodes?: readonly string[]; readonly cardType?: "side_scheme" };
  readonly discardPile: "own" | "encounter";
  readonly whenEmpty: "reshuffleDiscardWithoutPenalty" | "remainsEmpty";
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
   * A separated identity's missing alter-ego card, keyed by the hero record's MarvelCDB code (wave 2 schema pass,
   * docs/phase7-wave2.md §6.10 — SP//dr). Only a hero record whose `linked_card` exists but is not type
   * `alter_ego` (the structural signature of a separated identity) ever consults this map.
   */
  readonly separatedIdentities?: Readonly<Record<string, SeparatedIdentitySource>>;
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
}
