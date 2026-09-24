/**
 * A raw record with its hand corrections and errata applied: the name, text, traits and stats every card-type module
 * reads instead of the raw fields.
 */
import type { CardText, SpecialCost, Trait } from "../../../src/schema/index.ts";
import type { Errata } from "../curation/types.ts";
import type { RawCard } from "../raw-types.ts";
import { parseTraits, toPlainText, unknownTokens } from "../text.ts";
import { traitOf } from "./brand.ts";
import type { NormalizeContext } from "./context.ts";

export interface Prepared {
  readonly raw: RawCard;
  readonly name: string;
  readonly traits: Trait[];
  readonly boost: number;
  readonly attack: number | null | undefined;
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
  /** MarvelCDB's `quantity`, or a curated `Correction.quantityInSet` override (see that field's doc comment). */
  readonly quantityInSet: number;
}

/** Prepares a record once per run (cached by code), marking which corrections and errata matched. */
export function prepare(ctx: NormalizeContext, r: RawCard): Prepared {
  const { curation, errors } = ctx;
  const cached = ctx.prepared.get(r.code);
  if (cached) return cached;
  let text = toPlainText(r.real_text ?? r.text);
  let name = r.name;
  let traits = parseTraits(r.real_traits ?? r.traits);
  let boost = r.boost ?? 0;
  let attack = r.attack;
  // MarvelCDB's own `cost: -1` is an unambiguous encoding of a printed "X" cost (docs/phase7-wave2.md §1.3) —
  // read automatically, before any correction is consulted.
  let specialCost: SpecialCost | undefined = r.cost === -1 ? "X" : undefined;
  let quantityInSet = r.quantity;
  const notes: string[] = [];
  const ignored = new Set<string>();
  curation.corrections.forEach((c, i) => {
    if (c.code !== r.code) return;
    ctx.usedCorrections.add(i);
    if (c.textReplace) {
      const count = text.split(c.textReplace.find).length - 1;
      if (count !== 1)
        errors.push(`${r.code}: correction text "${c.textReplace.find}" found ${count} times (expected 1)`);
      else text = text.replace(c.textReplace.find, c.textReplace.replace);
    }
    if (c.name !== undefined) name = c.name;
    if (c.traits !== undefined) traits = c.traits.map((t) => t.toUpperCase());
    if (c.boost !== undefined) boost = c.boost;
    if (c.attack !== undefined) attack = c.attack;
    if (c.specialCost !== undefined) specialCost = c.specialCost;
    if (c.quantityInSet !== undefined) quantityInSet = c.quantityInSet;
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
    traits: traits.map(traitOf),
    boost,
    attack,
    text: { printed, current },
    ...(flavor ? { flavor } : {}),
    ...(errata ? { errata } : {}),
    notes,
    ignored,
    quantityInSet,
    ...(specialCost ? { specialCost } : {}),
  };
  ctx.prepared.set(r.code, p);
  return p;
}
