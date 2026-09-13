/** Whole-pack checks that run after cards are emitted: stale curation, and records or faces left uncovered. */
import { printedFaces } from "./art.ts";
import type { NormalizeContext } from "./context.ts";

/** Step 7: every correction, errata, scripting note and card note must have matched something. */
export function checkStaleCuration(ctx: NormalizeContext): void {
  const { curation, errors } = ctx;
  curation.corrections.forEach((c, i) => {
    if (!ctx.usedCorrections.has(i)) errors.push(`curation correction for ${c.code} matched no record`);
  });
  for (const e of curation.errata) if (!ctx.usedErrata.has(e.code)) errors.push(`curation errata for ${e.code} matched no record`);
  for (const id of Object.keys(curation.scriptingNotes)) {
    if (!ctx.usedNotes.has(id)) errors.push(`scripting note for ${id} matches no emitted ability id`);
  }
  const cardIds = new Set(ctx.cards.map((c) => c.id as string));
  for (const id of Object.keys(curation.cardNotes)) if (!cardIds.has(id)) errors.push(`cardNotes entry ${id} matches no card`);
}

/** Step 11: every non-aggregate record became part of a card, and every printed face has an artwork reference. */
export function checkCoverage(ctx: NormalizeContext): void {
  const { errors } = ctx;
  const allCodes = [...ctx.byCode.keys()].filter((c) => !ctx.isAggregate(c));
  const covered = new Set(ctx.provenance.flatMap((p) => p.marvelcdbCodes));
  for (const c of allCodes) if (!covered.has(c)) errors.push(`MarvelCDB record ${c} was not turned into any card`);

  // A hard error rather than a warning: a silently art-less card would only show up as a
  // blank frame in the client, long after ingestion.
  for (const card of ctx.cards) {
    for (const face of printedFaces(card)) {
      if (!face.image) errors.push(`${card.id}: no artwork reference for ${face.what}`);
    }
  }
}
