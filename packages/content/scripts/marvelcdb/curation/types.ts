/**
 * Hand-curated, per-pack inputs to ingestion: everything MarvelCDB can't give
 * us (or gives us wrong). Every entry cites the evidence it rests on, so a
 * reviewer can re-check it without re-deriving it.
 */
import type { CoreAspect } from "../../../src/schema/index.ts";

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

export interface ScenarioCuration {
  readonly id: string;
  readonly name: string;
  readonly villainSetCode: string;
  /**
   * The MarvelCDB `card_set_code` the main scheme is filed under, when it differs from `villainSetCode` — The
   * Wrecking Crew's Breakout is its own `wrecking_crew` set, not Wrecker's `wrecker` set (docs/phase7-wave1.md
   * §2.3). Absent = `villainSetCode` (Core and the Green Goblin scenarios: one set holds the villain, main scheme,
   * minions and treacheries together).
   */
  readonly mainSchemeSetCode?: string;
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
}
