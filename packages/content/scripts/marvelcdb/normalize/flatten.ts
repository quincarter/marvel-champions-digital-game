/**
 * Step 1: index every raw record by code and drop MarvelCDB's aggregate records.
 *
 * An aggregate is a bare code like `01097` or `01144` whose suffixed variants `01097a`/`01144a…` also exist: it
 * duplicates the real cards and would double-count copies.
 */
import type { DroppedSourceRecord } from "../../../src/data/types.ts";
import type { ImageRef } from "../../../src/schema/index.ts";
import type { Correction, PackCuration } from "../curation/types.ts";
import type { RawCard } from "../raw-types.ts";
import { imageOf } from "./art.ts";

export interface Flattened {
  /** Every raw record by code, linked (back-face) records included. */
  readonly byCode: ReadonlyMap<string, RawCard>;
  /** The records that become cards: `raw` without the aggregates. */
  readonly topLevel: readonly RawCard[];
  readonly dropped: DroppedSourceRecord[];
  readonly isAggregate: (code: string) => boolean;
  /**
   * The front-face image of an A-side record's aggregate twin: MarvelCDB gives
   * `01097a` no image of its own, but `01097` (dropped as a duplicate of
   * the 01097a/01097b pair) carries one.
   *
   * That image is the **B** side, not the A side. Verified against the printed
   * collector numbers on the scans themselves: `/bundles/cards/01097.png` is
   * stamped "97B" and `/bundles/cards/01116.png` is stamped "116B", and both
   * show the threat value and acceleration that only the B side prints. Read
   * the other way round — which is the intuitive reading, and was the original
   * one — every main scheme on the table drew its setup/contents side.
   */
  readonly aggregateImage: (aSideCode: string) => ImageRef | undefined;
}

/**
 * Applies `Correction.cardType`: returns the records with the corrected `type_code` (the record itself and any linked
 * face carrying the code). A type that already matches is an error, so a MarvelCDB fix upstream is noticed instead of
 * leaving a dead correction. Records without a type correction are returned as-is.
 */
export function applyTypeCorrections(
  raw: readonly RawCard[],
  corrections: readonly Correction[],
  errors: string[],
): readonly RawCard[] {
  const typed = corrections.filter((c) => c.cardType !== undefined);
  if (typed.length === 0) return raw;
  const fix = (r: RawCard): RawCard => {
    let out = r;
    for (const c of typed) {
      if (c.code !== r.code) continue;
      if (c.cardType === r.type_code)
        errors.push(`${r.code}: type correction to ${c.cardType} matches MarvelCDB already`);
      else out = { ...out, type_code: c.cardType as RawCard["type_code"] };
    }
    return out;
  };
  return raw.map((r) => {
    const top = fix(r);
    return r.linked_card ? { ...top, linked_card: fix(r.linked_card) } : top;
  });
}

/**
 * Applies `PackCuration.addedRecords` then `linkOverrides` (both errors-not-silence, see their types). Returns the
 * input unchanged when the curation has neither.
 */
export function applyAddedRecords(
  raw: readonly RawCard[],
  curation: PackCuration,
  errors: string[],
): readonly RawCard[] {
  const added = curation.addedRecords ?? [];
  const overrides = curation.linkOverrides ?? [];
  if (added.length === 0 && overrides.length === 0) return raw;
  const known = new Set<string>();
  for (const r of raw) {
    known.add(r.code);
    if (r.linked_card) known.add(r.linked_card.code);
  }
  const addedByCode = new Map<string, RawCard>();
  for (const a of added) {
    const code = a.record.code;
    if (known.has(code) || addedByCode.has(code)) {
      errors.push(`added record ${code}: MarvelCDB already has a record with this code`);
      continue;
    }
    addedByCode.set(code, a.record);
  }
  const nested = new Set<string>();
  const linkedTo = new Map<string, RawCard>();
  for (const o of overrides) {
    const front = raw.find((r) => r.code === o.front);
    if (!front) {
      errors.push(`link override ${o.front} -> ${o.back}: front record ${o.front} is missing`);
      continue;
    }
    const target =
      addedByCode.get(o.back) ??
      raw.flatMap((r) => (r.linked_card ? [r.linked_card] : [])).find((c) => c.code === o.back) ??
      raw.find((r) => r.code === o.back);
    if (!target) {
      errors.push(`link override ${o.front} -> ${o.back}: target record ${o.back} is missing`);
      continue;
    }
    if (front.linked_card?.code === o.back) {
      errors.push(`link override ${o.front} -> ${o.back}: MarvelCDB already links ${o.front} to ${o.back}`);
      continue;
    }
    linkedTo.set(o.front, target);
    if (addedByCode.has(o.back)) nested.add(o.back);
  }
  const out: RawCard[] = raw.map((r) => {
    const target = linkedTo.get(r.code);
    return target ? { ...r, linked_to_code: target.code, linked_card: target } : r;
  });
  for (const [code, record] of addedByCode) if (!nested.has(code)) out.push(record);
  return out;
}

export function flatten(raw: readonly RawCard[], errors: string[]): Flattened {
  const byCode = new Map<string, RawCard>();
  for (const r of raw) {
    if (byCode.has(r.code)) errors.push(`duplicate MarvelCDB code ${r.code}`);
    byCode.set(r.code, r);
    if (r.linked_card) byCode.set(r.linked_card.code, r.linked_card);
  }
  const dropped: DroppedSourceRecord[] = [];
  const isAggregate = (code: string) => /\d$/.test(code) && byCode.has(`${code}a`);
  const aggregateImage = (aSideCode: string): ImageRef | undefined =>
    imageOf(byCode.get(aSideCode.replace(/a$/, ""))?.imagesrc);
  const topLevel: RawCard[] = [];
  for (const r of raw) {
    if (!isAggregate(r.code)) {
      topLevel.push(r);
      continue;
    }
    const variants = [...byCode.values()].filter((v) => new RegExp(`^${r.code}[a-z]$`).test(v.code));
    if (r.type_code === "main_scheme") {
      const b = byCode.get(`${r.code}b`);
      // MarvelCDB represents "no printed value" inconsistently between the aggregate and its B-side twin: a
      // dashed stage's aggregate record simply omits the field (`undefined`) while the B-side record carries an
      // explicit `null` (The Once and Future Kang's 11008/11008b, docs/phase7-wave2.md §1.6/§5.1). Both mean the
      // same thing — normalize before comparing, so a genuinely dashed stage isn't reported as a mismatch.
      const sameOrBothAbsent = (x: number | null | undefined, y: number | null | undefined) =>
        (x ?? null) === (y ?? null);
      if (!b || !sameOrBothAbsent(b.threat, r.threat) || !sameOrBothAbsent(b.escalation_threat, r.escalation_threat)) {
        errors.push(`aggregate ${r.code} does not match its B side — inspect before dropping`);
      }
      dropped.push({
        marvelcdbCode: r.code,
        reason: `MarvelCDB aggregate record duplicating main scheme stage ${r.code}a/${r.code}b.`,
      });
    } else {
      // A double-sided pair of the *same physical card* (one variant's `linked_card` points at the other, the
      // same A/B shape `main_scheme` gets above, just for another type — The Hood's Formidable Foe 24049a/b,
      // Mutant Genesis' 21100a/b) is not two printed copies: summing both faces' `quantity` double-counts the one
      // physical card. Detected structurally, not by type: exactly two variants, mutually linked.
      const doubleSidedFace =
        variants.length === 2 ? variants.find((v) => variants.some((o) => o.code === v.linked_card?.code)) : undefined;
      const sum = doubleSidedFace ? doubleSidedFace.quantity : variants.reduce((n, v) => n + v.quantity, 0);
      if (sum !== r.quantity) errors.push(`aggregate ${r.code} quantity ${r.quantity} != variants' total ${sum}`);
      dropped.push({
        marvelcdbCode: r.code,
        reason: doubleSidedFace
          ? `MarvelCDB aggregate record duplicating the double-sided card ${r.code}a/${r.code}b (quantity ${r.quantity} = one physical card, not both faces summed).`
          : `MarvelCDB aggregate record for the printed variants ${variants.map((v) => v.code).join(", ")} (quantity ${r.quantity} = their total).`,
      });
    }
  }
  return { byCode, topLevel, dropped, isAggregate, aggregateImage };
}
