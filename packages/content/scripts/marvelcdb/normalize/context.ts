/**
 * The shared state of one `normalizePack` run, and the helpers every card-type module uses.
 *
 * Every step appends to `errors` rather than throwing, so a pack reports all its problems at once. Steps run in a
 * fixed order (see `normalize.ts`), and ability ids are assigned in call order, so the order of calls into these
 * helpers is part of the output.
 */
import type { AbilityReference, AnyCard, CardImages } from "../../../src/schema/index.ts";
import type { CardProvenance } from "../../../src/data/types.ts";
import type { PackCuration } from "../curation/types.ts";
import { assignAbilityIds, parseCardText, type ParsedAbility, type ParsedText } from "../parse-text.ts";
import type { RawCard } from "../raw-types.ts";
import { imagesOf, reprintImages } from "./art.ts";
import { brand } from "./brand.ts";
import { flatten, type Flattened } from "./flatten.ts";
import type { Prepared } from "./prepare.ts";
import { collector, errataStatus, stripQuotes } from "./values.ts";

export interface NormalizeContext extends Flattened {
  readonly curation: PackCuration;
  /** Every problem found so far; `normalizePack` throws them together at the end. */
  readonly errors: string[];
  readonly setCode: AnyCard["setCode"];
  readonly cycleId: AnyCard["cycleId"];
  readonly villainNames: ReadonlySet<string>;
  /**
   * Whether any of this pack's scenarios puts several villains in play at once (The Wrecking Crew) — a pack
   * property of curation, not "this pack happens to contain more than one villain name" (Core has three
   * single-villain scenarios). See `ParseOptions.multipleVillains`.
   */
  readonly packHasMultipleVillains: boolean;
  /** Each hero kit's identity record, by card set code. */
  readonly heroBySet: ReadonlyMap<string, RawCard>;
  readonly cards: AnyCard[];
  readonly provenance: CardProvenance[];
  /** Raw codes already turned into (part of) a card, so the one-card-per-record step skips them. */
  readonly handled: Set<string>;
  /** `prepare`'s cache. */
  readonly prepared: Map<string, Prepared>;
  // What curation matched, for the stale-curation check.
  readonly usedCorrections: Set<number>;
  readonly usedErrata: Set<string>;
  readonly usedNotes: Set<string>;
  readonly usedAbilityIds: Set<string>;
}

export function createContext(raw: readonly RawCard[], curation: PackCuration): NormalizeContext {
  const errors: string[] = [];
  const flat = flatten(raw, errors);
  const heroBySet = new Map<string, RawCard>();
  for (const r of flat.topLevel) if (r.type_code === "hero" && r.card_set_code) heroBySet.set(r.card_set_code, r);
  const handled = new Set<string>();
  // A record curation has hand-verified isn't a printed card at all (`IgnoredRecord`) is dropped up front, the
  // same way a MarvelCDB aggregate is — `checkCoverage` exempts it via `ctx.dropped`, not by lowering the bar.
  for (const ignored of curation.ignoredRecords ?? []) {
    handled.add(ignored.code);
    flat.dropped.push({ marvelcdbCode: ignored.code, reason: `${ignored.reason} [evidence: ${ignored.evidence}]` });
  }
  return {
    ...flat,
    curation,
    errors,
    setCode: brand("set", curation.packCode),
    cycleId: brand("cycle", curation.cycle.id),
    villainNames: new Set(flat.topLevel.filter((r) => r.type_code === "villain").map((r) => r.name)),
    packHasMultipleVillains: curation.scenarios.some((s) => s.multipleVillains !== undefined),
    heroBySet,
    cards: [],
    provenance: [],
    handled,
    prepared: new Map(),
    usedCorrections: new Set(),
    usedErrata: new Set(),
    usedNotes: new Set(),
    usedAbilityIds: new Set(),
  };
}

/** Parses a prepared record's current text, reporting unclassified sentences and a boost flag that disagrees with it. */
export function parse(ctx: NormalizeContext, p: Prepared): ParsedText {
  const parsed = parseCardText(p.text.current, {
    obligation: p.raw.type_code === "obligation",
    villainNames: ctx.villainNames,
    multipleVillains: ctx.packHasMultipleVillains,
  });
  for (const u of parsed.unclassified) ctx.errors.push(`${p.raw.code}: ${u}`);
  const hasBoostAbility = parsed.abilities.some((a) => a.kind === "boost");
  if (Boolean(p.raw.boost_star) !== hasBoostAbility) {
    ctx.errors.push(`${p.raw.code}: boost_star=${String(p.raw.boost_star)} but text ${hasBoostAbility ? "has" : "has no"} a Boost ability`);
  }
  return parsed;
}

/** Ability ids for one face, with any curated scripting note attached. */
export function abilityRefs(ctx: NormalizeContext, code: string, cardName: string, abilities: readonly ParsedAbility[]): AbilityReference[] {
  return assignAbilityIds(code, cardName, abilities, ctx.usedAbilityIds).map(({ id, ability }) => {
    const note = ctx.curation.scriptingNotes[id];
    if (note !== undefined) ctx.usedNotes.add(id);
    return {
      id: brand("ability", id),
      ...(ability.name ? { label: stripQuotes(ability.name) } : {}),
      ...(note !== undefined ? { notesForScripting: note } : {}),
    };
  });
}

/** Emits a card with its provenance: the raw records it came from and every correction applied to them. */
export function record(ctx: NormalizeContext, card: AnyCard, cardSetCode: string, parts: readonly Prepared[]): void {
  ctx.cards.push(card);
  const note = ctx.curation.cardNotes[card.id];
  // MarvelCDB's `duplicate_of_code` on a verbatim reprint (see `RawCard`'s doc comment) — recorded, not resolved
  // against the reprint's pack, since that pack isn't loaded here; a consumer treats it as a hint.
  const duplicateOf = parts.map((p) => p.raw.duplicate_of_code).find((c): c is string => Boolean(c));
  ctx.provenance.push({
    cardId: card.id,
    cardSetCode,
    marvelcdbCodes: parts.map((p) => p.raw.code),
    corrections: [...parts.flatMap((p) => p.notes), ...(note ? [`data decision: ${note}`] : [])],
    ...(duplicateOf ? { duplicateOfCardId: brand("card", duplicateOf) } : {}),
  });
}

/**
 * The fields every card type shares.
 *
 * `images` defaults to the record's own front/back. Pass an explicit pair for
 * a card whose two faces come from linked records (a hero identity), or
 * `null` for one whose faces the schema models separately (villain stages,
 * main scheme A/B sides) — those carry the ref on the face instead.
 */
export function baseFields(
  ctx: NormalizeContext,
  p: Prepared,
  id: string,
  codes: readonly string[],
  images: CardImages | null = imagesOf(p.raw.imagesrc, p.raw.backimagesrc) ?? reprintImages(p.raw) ?? null,
) {
  return {
    id: brand("card", id),
    name: p.name,
    ...(p.raw.subname ? { subtitle: p.raw.subname } : {}),
    setCode: ctx.setCode,
    cycleId: ctx.cycleId,
    collectorNumber: collector(codes),
    quantityInSet: p.raw.quantity,
    unique: Boolean(p.raw.is_unique),
    ...(images ? { images } : {}),
    ...(p.errata ? { errata: errataStatus(p.errata) } : {}),
  };
}

export type BaseFields = ReturnType<typeof baseFields>;

/** One raw record already prepared and parsed, with the fields every one-record card type shares. */
export interface SingleRecord {
  readonly r: RawCard;
  readonly p: Prepared;
  readonly parsed: ParsedText;
  /** The provenance set code: the record's card set, or its faction for cards without one. */
  readonly set: string;
  readonly common: BaseFields;
  readonly abilities: AbilityReference[];
}

/**
 * Fields that have no printed counterpart on villains/minions: if MarvelCDB sets them, a human must look at the card
 * and record an `ignoreFields` correction.
 */
export function checkNoSchemeFields(ctx: NormalizeContext, p: Prepared): void {
  for (const f of ["base_threat", "scheme_crisis", "scheme_acceleration", "scheme_hazard"] as const) {
    const v = p.raw[f];
    if (v !== null && v !== undefined && !p.ignored.has(f)) {
      ctx.errors.push(`${p.raw.code} (${p.raw.type_code}) has ${f}=${String(v)} — not a printed field on this card type; verify and add an ignoreFields correction`);
    }
  }
}

export function expectNoPlayerData(ctx: NormalizeContext, p: Prepared, parsed: ParsedText): void {
  if (Object.keys(parsed.restrictions).length > 0 || parsed.maxPerDeckText !== undefined) {
    ctx.errors.push(`${p.raw.code}: play/deck restriction on a non-player card`);
  }
}

export function expectNoAttach(ctx: NormalizeContext, p: Prepared, parsed: ParsedText): void {
  if (parsed.attachesTo) ctx.errors.push(`${p.raw.code}: attach rule on a ${p.raw.type_code}`);
}
