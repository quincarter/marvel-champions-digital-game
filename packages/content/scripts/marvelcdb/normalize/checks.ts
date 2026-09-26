/** Whole-pack checks that run after cards are emitted: stale curation, and records or faces left uncovered. */
import { printedFaces } from "./art.ts";
import type { NormalizeContext } from "./context.ts";

/** Step 7: every correction, errata, scripting note and card note must have matched something. */
export function checkStaleCuration(ctx: NormalizeContext): void {
  const { curation, errors } = ctx;
  curation.corrections.forEach((c, i) => {
    if (!ctx.usedCorrections.has(i)) errors.push(`curation correction for ${c.code} matched no record`);
  });
  for (const e of curation.errata)
    if (!ctx.usedErrata.has(e.code)) errors.push(`curation errata for ${e.code} matched no record`);
  for (const id of Object.keys(curation.scriptingNotes)) {
    if (!ctx.usedNotes.has(id)) errors.push(`scripting note for ${id} matches no emitted ability id`);
  }
  const cardIds = new Set(ctx.cards.map((c) => c.id as string));
  for (const id of Object.keys(curation.cardNotes))
    if (!cardIds.has(id)) errors.push(`cardNotes entry ${id} matches no card`);
  for (const code of Object.keys(curation.imageOverrides ?? {})) {
    if (!ctx.usedImageOverrides.has(code))
      errors.push(`curation imageOverride for ${code} matched no face that needed it`);
  }
}

/** Step 11: every non-aggregate record became part of a card, and every printed face has an artwork reference. */
export function checkCoverage(ctx: NormalizeContext): void {
  const { errors } = ctx;
  const dropped = new Set(ctx.dropped.map((d) => d.marvelcdbCode));
  const allCodes = [...ctx.byCode.keys()].filter((c) => !ctx.isAggregate(c) && !dropped.has(c));
  const covered = new Set(ctx.provenance.flatMap((p) => p.marvelcdbCodes));
  for (const c of allCodes) if (!covered.has(c)) errors.push(`MarvelCDB record ${c} was not turned into any card`);

  // `PackCuration.encounterSets` matched something (docs/phase7-wave4.md §1.10) — checked here rather than in
  // `checkStaleCuration` (step 7) because encounter sets don't exist until `normalizeEncounterSets` (steps 8-10),
  // which runs after it.
  for (const id of Object.keys(ctx.curation.encounterSets ?? {})) {
    if (!ctx.usedEncounterSetOverrides.has(id)) errors.push(`curation encounterSets entry for ${id} matched no set`);
  }

  // A hard error rather than a warning: a silently art-less card would only show up as a blank frame in the
  // client, long after ingestion — unless `PackCuration.artUnavailable` names the exact MarvelCDB code that face
  // came from, confirming there really is nothing to reference (a genuine MarvelCDB data gap, not a normalizer
  // bug). Resolved via `faceCodesByCardId`, in `printedFaces`' own per-face order; a card whose code list is
  // missing or a different length than its face list can never be exempted, so this never widens the check by
  // guessing.
  for (const card of ctx.cards) {
    const faces = printedFaces(card);
    const codes = ctx.faceCodesByCardId.get(card.id as string);
    const codesLineUp = codes !== undefined && codes.length === faces.length;
    faces.forEach((face, i) => {
      if (face.image) return;
      const code = codesLineUp ? (codes as readonly string[])[i] : undefined;
      const reason = code !== undefined ? ctx.curation.artUnavailable?.[code] : undefined;
      if (reason !== undefined) {
        ctx.usedArtUnavailable.add(code as string);
        return;
      }
      errors.push(`${card.id}: no artwork reference for ${face.what}`);
    });
  }

  for (const code of Object.keys(ctx.curation.artUnavailable ?? {})) {
    if (!ctx.usedArtUnavailable.has(code)) errors.push(`curation artUnavailable entry for ${code} matched no face`);
  }
}
