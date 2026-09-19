/**
 * Step 1: index every raw record by code and drop MarvelCDB's aggregate records.
 *
 * An aggregate is a bare code like `01097` or `01144` whose suffixed variants `01097a`/`01144a…` also exist: it
 * duplicates the real cards and would double-count copies.
 */
import type { DroppedSourceRecord } from "../../../src/data/types.ts";
import type { ImageRef } from "../../../src/schema/index.ts";
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

export function flatten(raw: readonly RawCard[], errors: string[]): Flattened {
  const byCode = new Map<string, RawCard>();
  for (const r of raw) {
    if (byCode.has(r.code)) errors.push(`duplicate MarvelCDB code ${r.code}`);
    byCode.set(r.code, r);
    if (r.linked_card) byCode.set(r.linked_card.code, r.linked_card);
  }
  const dropped: DroppedSourceRecord[] = [];
  const isAggregate = (code: string) => /\d$/.test(code) && byCode.has(`${code}a`);
  const aggregateImage = (aSideCode: string): ImageRef | undefined => imageOf(byCode.get(aSideCode.replace(/a$/, ""))?.imagesrc);
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
      const sameOrBothAbsent = (x: number | null | undefined, y: number | null | undefined) => (x ?? null) === (y ?? null);
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
      const doubleSidedFace = variants.length === 2 ? variants.find((v) => variants.some((o) => o.code === v.linked_card?.code)) : undefined;
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
