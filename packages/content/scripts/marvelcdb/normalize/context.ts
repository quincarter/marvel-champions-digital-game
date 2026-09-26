/**
 * The shared state of one `normalizePack` run, and the helpers every card-type module uses.
 *
 * Every step appends to `errors` rather than throwing, so a pack reports all its problems at once. Steps run in a
 * fixed order (see `normalize.ts`), and ability ids are assigned in call order, so the order of calls into these
 * helpers is part of the output.
 */
import type { AbilityReference, AnyCard, CardImages, ImageRef } from "../../../src/schema/index.ts";
import type { CardProvenance } from "../../../src/data/types.ts";
import type { PackCuration } from "../curation/types.ts";
import { assignAbilityIds, parseCardText, type ParsedAbility, type ParsedText } from "../parse-text.ts";
import type { RawCard } from "../raw-types.ts";
import { imageOf, imagesOf, reprintImages } from "./art.ts";
import { brand } from "./brand.ts";
import { flatten, type Flattened } from "./flatten.ts";
import type { Prepared } from "./prepare.ts";
import { amplifyIconsField, collector, errataStatus, stripQuotes } from "./values.ts";

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
  readonly usedImageOverrides: Set<string>;
  /** `PackCuration.encounterSets` keys matched (docs/phase7-wave4.md §1.10) — a stale entry is caught the same way. */
  readonly usedEncounterSetOverrides: Set<string>;
  /** `PackCuration.artUnavailable` keys matched — a stale entry is caught the same way. */
  readonly usedArtUnavailable: Set<string>;
  /**
   * Which MarvelCDB code each of a card's printed faces came from, in the exact order `printedFaces` (`art.ts`)
   * enumerates them — the only way `checkCoverage` can resolve `PackCuration.artUnavailable`'s per-face codes back
   * to a specific missing face, since the finished `AnyCard` carries no MarvelCDB provenance itself (the schema is
   * pure game data). Populated explicitly by whichever card-type module needs exemption support for a
   * many-code card (`normalize/villains.ts`); a single-record card (`record()`'s own `parts.length === 1` case)
   * is filled in automatically, since its one code is always the card's own id. A card absent from this map, or
   * whose code list doesn't match `printedFaces`' length, can never be exempted — `checkCoverage` falls back to
   * its unconditional check, which is always safe (it just can't offer an exemption, not a wrong one).
   */
  readonly faceCodesByCardId: Map<string, readonly string[]>;
}

export function createContext(raw: readonly RawCard[], curation: PackCuration): NormalizeContext {
  const errors: string[] = [];
  const flat = flatten(raw, errors);
  // Wave 2 fix: a three-sided identity's extra hero face (Ant-Man/Wasp's Giant, §1.1) is its own `hero`-type
  // record in the same `card_set_code`, with no linked alter-ego. Before this fix, whichever of the two hero
  // records for a set happened to sort last in the raw array's order won this map — silently making every
  // hero-kit card's `aspect: hero:<code>` point at the extra face (e.g. "hero:12001c") instead of the real
  // identity (e.g. "hero:12001a") whenever the extra face followed the primary in the raw feed. Only a record
  // with a linked alter-ego (the primary identity face, matching `normalizeHeroes`' own test) may claim the set.
  const heroBySet = new Map<string, RawCard>();
  for (const r of flat.topLevel) {
    if (r.type_code !== "hero" || !r.card_set_code) continue;
    // A separated identity's hero record (wave 2, docs/phase7-wave2.md §6.10 — SP//dr) links to its own other
    // side, not an alter-ego, so the ordinary check below doesn't recognize it as the primary identity of its
    // set. `heroes.ts`'s curated `separatedIdentities` is the structural signal that this is one anyway.
    if (r.linked_card?.type_code === "alter_ego" || curation.separatedIdentities?.[r.code])
      heroBySet.set(r.card_set_code, r);
  }
  // A hero-kit card MarvelCDB files under a themed auxiliary set instead of the identity's own
  // (`PackCuration.auxiliaryHeroSetCodes`'s doc comment — Storm's Weather Deck): alias the auxiliary code to
  // whatever hero record the primary code already resolved to. A primary code the pack doesn't actually have
  // (a typo, or a curation entry left over from a copy-paste) resolves to nothing here — no error, so this is
  // conservative by construction, not silent-but-wrong: the auxiliary set's own cards then still fail the
  // ordinary "hero card in a set with no identity" check exactly as before.
  for (const [auxSet, primarySet] of Object.entries(curation.auxiliaryHeroSetCodes ?? {})) {
    const hero = heroBySet.get(primarySet);
    if (hero) heroBySet.set(auxSet, hero);
  }
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
    // Leader records (wave 2, docs/phase7-wave2.md §6.3) are normalized the same way as villains, so a card
    // attaching "to <leader name>" by name resolves the same way "to <villain name>" does.
    villainNames: new Set(
      flat.topLevel.filter((r) => r.type_code === "villain" || r.type_code === "leader").map((r) => r.name),
    ),
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
    usedImageOverrides: new Set(),
    usedEncounterSetOverrides: new Set(),
    usedArtUnavailable: new Set(),
    faceCodesByCardId: new Map(),
  };
}

/**
 * A face's artwork reference, falling back to a curated second-source URL (`PackCuration.imageOverrides`) when
 * MarvelCDB has none for that record at all. See that field's doc comment for the evidence bar.
 */
export function imageOfWithOverride(
  ctx: NormalizeContext,
  code: string,
  src: string | null | undefined,
): ImageRef | undefined {
  const own = imageOf(src);
  if (own) return own;
  const override = ctx.curation.imageOverrides?.[code];
  if (override === undefined) return undefined;
  ctx.usedImageOverrides.add(code);
  return imageOf(override);
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
  // docs/phase7-wave4.md §1.13: Rain Fire (`mts` 21109) sends `boost_star: false` despite printing a Boost
  // ability — confirmed from the card image as MarvelCDB's own flag being wrong, not the text. A curated
  // `ignoreFields: ["boost_star"]` correction silences this cross-check for that one record; the emitted
  // `starIcon` always follows the text (`hasBoostAbility`), never the raw flag, so this only affects validation.
  if (Boolean(p.raw.boost_star) !== hasBoostAbility && !p.ignored.has("boost_star")) {
    ctx.errors.push(
      `${p.raw.code}: boost_star=${String(p.raw.boost_star)} but text ${hasBoostAbility ? "has" : "has no"} a Boost ability`,
    );
  }
  return parsed;
}

/** Ability ids for one face, with any curated scripting note attached. */
export function abilityRefs(
  ctx: NormalizeContext,
  code: string,
  cardName: string,
  abilities: readonly ParsedAbility[],
): AbilityReference[] {
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
  // A single-record card's one printed face is always its own MarvelCDB code — the trivial, always-correct case
  // of `faceCodesByCardId` (a many-code card, e.g. a villain, sets its own richer mapping explicitly instead;
  // this never overwrites one already set).
  if (parts.length === 1 && !ctx.faceCodesByCardId.has(card.id)) {
    ctx.faceCodesByCardId.set(card.id, [(parts[0] as Prepared).raw.code]);
  }
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
    quantityInSet: p.quantityInSet,
    unique: Boolean(p.raw.is_unique),
    ...(images ? { images } : {}),
    ...(p.errata ? { errata: errataStatus(p.errata) } : {}),
    ...amplifyIconsField(p.raw),
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
      ctx.errors.push(
        `${p.raw.code} (${p.raw.type_code}) has ${f}=${String(v)} — not a printed field on this card type; verify and add an ignoreFields correction`,
      );
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
