/**
 * A raw record with its hand corrections and errata applied: the name, text, traits and stats every card-type module
 * reads instead of the raw fields.
 */
import type { AttachmentHost, CardText, MainSchemeThreatField, SpecialCost, Trait } from "../../../src/schema/index.ts";
import type { Errata } from "../curation/types.ts";
import type { RawCard } from "../raw-types.ts";
import { parseTraits, toPlainText, unknownTokens } from "../text.ts";
import { traitOf } from "./brand.ts";
import type { NormalizeContext } from "./context.ts";

export interface Prepared {
  readonly raw: RawCard;
  readonly name: string;
  /** MarvelCDB's `subname`, or a curated `Correction.subtitle`. */
  readonly subtitle?: string;
  /** MarvelCDB's `is_unique`, or a curated `Correction.unique` where the scan disagrees. */
  readonly unique: boolean;
  readonly traits: Trait[];
  readonly boost: number;
  readonly attack: number | null | undefined;
  /** A `Correction.attack` supplied the value, so -1 is the printed number and not MarvelCDB's printed-X encoding. */
  readonly attackIsCurated: boolean;
  /** `Correction.thwart`: the attachment's stat box prints THW (it attaches to a character that thwarts). */
  readonly thwart?: number;
  /** `Correction.scheme`: a minion's printed SCH where MarvelCDB omits it. */
  readonly scheme?: number;
  /** `Correction.dashedMinionStats`: the minion stats that print a dash and emit `null`. */
  readonly dashedMinionStats?: readonly ("atk" | "sch")[];
  /** `Correction.schemeIcons`: a side scheme's printed icon counts, replacing raw's (absent for every ordinary card). */
  readonly schemeIcons?: { readonly crisis?: number; readonly acceleration?: number; readonly hazard?: number };
  /** `Correction.startingThreatPerPlayer`: replaces `!base_threat_fixed` for a side scheme (absent: raw decides). */
  readonly startingThreatPerPlayer?: boolean;
  readonly text: CardText;
  readonly flavor?: string;
  readonly errata?: Errata;
  readonly notes: string[];
  readonly ignored: ReadonlySet<string>;
  /**
   * `"X"` when MarvelCDB's own `cost: -1` encoding says so (unambiguous, no correction needed); `"dash"` only
   * when a curated `Correction.specialCost` confirms it from the card image (see that field's doc comment).
   */
  readonly specialCost?: SpecialCost;
  /** A curated `Correction.cardBack` — absent for every card whose back is its type's default. */
  readonly cardBack?: "encounter" | "player";
  /** MarvelCDB's `quantity`, or a curated `Correction.quantityInSet` override (see that field's doc comment). */
  readonly quantityInSet: number;
  /** A curated `Correction.dashedThreatFields` (main scheme B sides only) — absent for every ordinary card. */
  readonly dashedThreatFields?: readonly MainSchemeThreatField[];
  /** A curated `Correction.impliedAttachHost` (see that field's doc comment) — absent for every ordinary card. */
  readonly unheadedWhenRevealed?: string;
  /** A curated `Correction.extraConstantFrom` — absent for every ordinary card. */
  readonly extraConstantFrom?: string;
  /** A curated `Correction.preambleWhenRevealed` — absent for every ordinary card. */
  readonly preambleWhenRevealed?: string;
  readonly impliedAttachHost?: "mainScheme" | "ally" | "minion" | "ownWhenRevealed" | AttachmentHost;
}

/** Prepares a record once per run (cached by code), marking which corrections and errata matched. */
export function prepare(ctx: NormalizeContext, r: RawCard): Prepared {
  const { curation, errors } = ctx;
  const cached = ctx.prepared.get(r.code);
  if (cached) return cached;
  let text = toPlainText(r.real_text ?? r.text);
  let name = r.name;
  let subtitle: string | undefined = r.subname || undefined;
  let unique = Boolean(r.is_unique);
  let traits = parseTraits(r.real_traits ?? r.traits);
  let boost = r.boost ?? 0;
  let attack = r.attack;
  let attackIsCurated = false;
  let thwart: number | undefined;
  let scheme: number | undefined;
  let dashedMinionStats: readonly ("atk" | "sch")[] | undefined;
  let schemeIcons: Prepared["schemeIcons"];
  let startingThreatPerPlayer: boolean | undefined;
  // MarvelCDB's own `cost: -1` is an unambiguous encoding of a printed "X" cost (docs/phase7-wave2.md §1.3) —
  // read automatically, before any correction is consulted.
  let specialCost: SpecialCost | undefined = r.cost === -1 ? "X" : undefined;
  let quantityInSet = r.quantity;
  let cardBack: "encounter" | "player" | undefined;
  let impliedAttachHost: "mainScheme" | "ally" | "minion" | "ownWhenRevealed" | AttachmentHost | undefined;
  let dashedThreatFields: readonly MainSchemeThreatField[] | undefined;
  let unheadedWhenRevealed: string | undefined;
  let extraConstantFrom: string | undefined;
  let preambleWhenRevealed: string | undefined;
  const notes: string[] = [];
  const ignored = new Set<string>();
  curation.corrections.forEach((c, i) => {
    if (c.code !== r.code) return;
    ctx.usedCorrections.add(i);
    if (c.impliedAttachHost !== undefined) impliedAttachHost = c.impliedAttachHost;
    if (c.unheadedWhenRevealed !== undefined) unheadedWhenRevealed = c.unheadedWhenRevealed;
    if (c.extraConstantFrom !== undefined) extraConstantFrom = c.extraConstantFrom;
    if (c.preambleWhenRevealed !== undefined) preambleWhenRevealed = c.preambleWhenRevealed;
    if (c.textReplace) {
      // Wave 5 (docs/phase7-wave5.md §1.9 — Nova's "Bring the War!", 28022): MarvelCDB's own `text`/`real_text`
      // is null for this card (an empty source, not a typo to find-and-replace inside), transcribed from the
      // card image instead. `find: ""` reads as "the source has no text at all" rather than an ordinary
      // find-once-and-replace, since `"".split(needle).length - 1` is never `1` for any non-empty `needle` and
      // would otherwise always fail this check.
      if (c.textReplace.find === "") {
        if (text !== "") errors.push(`${r.code}: correction textReplace expects no printed text, found "${text}"`);
        else text = c.textReplace.replace;
      } else {
        const count = text.split(c.textReplace.find).length - 1;
        if (count !== 1)
          errors.push(`${r.code}: correction text "${c.textReplace.find}" found ${count} times (expected 1)`);
        else text = text.replace(c.textReplace.find, c.textReplace.replace);
      }
    }
    if (c.name !== undefined) name = c.name;
    if (c.subtitle !== undefined) subtitle = c.subtitle;
    if (c.unique !== undefined) unique = c.unique;
    if (c.traits !== undefined) traits = c.traits.map((t) => t.toUpperCase());
    if (c.boost !== undefined) boost = c.boost;
    if (c.attack !== undefined) {
      attack = c.attack;
      attackIsCurated = true;
    }
    if (c.thwart !== undefined) thwart = c.thwart;
    if (c.scheme !== undefined) scheme = c.scheme;
    if (c.dashedMinionStats !== undefined) dashedMinionStats = c.dashedMinionStats;
    if (c.schemeIcons !== undefined) schemeIcons = c.schemeIcons;
    if (c.startingThreatPerPlayer !== undefined) startingThreatPerPlayer = c.startingThreatPerPlayer;
    if (c.specialCost !== undefined) specialCost = c.specialCost;
    if (c.cardBack !== undefined) cardBack = c.cardBack;
    if (c.quantityInSet !== undefined) quantityInSet = c.quantityInSet;
    if (c.dashedThreatFields !== undefined) dashedThreatFields = c.dashedThreatFields;
    for (const f of c.ignoreFields ?? []) ignored.add(f);
    notes.push(`${r.code}: ${c.reason} [evidence: ${c.evidence}]`);
  });
  for (const t of unknownTokens(text)) errors.push(`${r.code}: unknown text token ${t}`);
  const errata = curation.errata.find((e) => e.code === r.code);
  let printed = text;
  let current = text;
  if (errata) {
    ctx.usedErrata.add(errata.code);
    if (errata.printedReplace && errata.currentReplace) {
      errors.push(`${r.code}: errata sets both printedReplace and currentReplace — set exactly one`);
    } else if (errata.printedReplace) {
      // The common case: MarvelCDB's text is already current (post-errata); reverse it to recover the print.
      printed = text.split(errata.printedReplace.find).join(errata.printedReplace.replace);
      if (printed === text) errors.push(`${r.code}: errata printedReplace "${errata.printedReplace.find}" not found`);
    } else if (errata.currentReplace) {
      // MarvelCDB's text still lags the errata (verified as the original print); derive current text forward.
      current = text.split(errata.currentReplace.find).join(errata.currentReplace.replace);
      if (current === text) errors.push(`${r.code}: errata currentReplace "${errata.currentReplace.find}" not found`);
    }
    // Neither set is valid: an errata that changes a non-text field (e.g. 01184's `changedFields: ["name"]"`)
    // touches nothing here — `text`/`printed` stay equal, and the field itself is corrected elsewhere.
    notes.push(`${r.code}: errata ${errata.version} — ${errata.note} [evidence: ${errata.evidence}]`);
  }
  const flavor = toPlainText(r.flavor);
  const p: Prepared = {
    raw: r,
    name,
    ...(subtitle ? { subtitle } : {}),
    unique,
    traits: traits.map(traitOf),
    boost,
    attack,
    attackIsCurated,
    ...(thwart !== undefined ? { thwart } : {}),
    ...(scheme !== undefined ? { scheme } : {}),
    ...(dashedMinionStats ? { dashedMinionStats } : {}),
    ...(schemeIcons ? { schemeIcons } : {}),
    ...(startingThreatPerPlayer !== undefined ? { startingThreatPerPlayer } : {}),
    text: { printed, current },
    ...(flavor ? { flavor } : {}),
    ...(errata ? { errata } : {}),
    notes,
    ignored,
    quantityInSet,
    ...(specialCost ? { specialCost } : {}),
    ...(cardBack ? { cardBack } : {}),
    ...(impliedAttachHost ? { impliedAttachHost } : {}),
    ...(unheadedWhenRevealed !== undefined ? { unheadedWhenRevealed } : {}),
    ...(extraConstantFrom !== undefined ? { extraConstantFrom } : {}),
    ...(preambleWhenRevealed !== undefined ? { preambleWhenRevealed } : {}),
    ...(dashedThreatFields ? { dashedThreatFields } : {}),
  };
  ctx.prepared.set(r.code, p);
  return p;
}
