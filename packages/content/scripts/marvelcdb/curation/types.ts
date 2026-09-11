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
 * Official errata: the current text differs from the print. MarvelCDB's text
 * is the *current* wording, so the original printed wording is reconstructed
 * here by reversing the errata (`printedReplace` applied to the current text).
 */
export interface Errata {
  readonly code: string;
  readonly version: string;
  readonly changedFields: readonly string[];
  readonly note: string;
  readonly evidence: string;
  /** Applied (all occurrences) to the current text to recover the printed text. */
  readonly printedReplace?: { readonly find: string; readonly replace: string };
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

export interface ScenarioCuration {
  readonly id: string;
  readonly name: string;
  readonly villainSetCode: string;
  readonly recommendedModularSetCodes: readonly string[];
  readonly standardSetCodes: readonly string[];
  readonly expertSetCodes: readonly string[];
  readonly villainStages: { readonly standard: readonly [number, number]; readonly expert: readonly [number, number] };
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
}
