/** Step 5: main schemes — one card per scenario set, one stage per A/B record pair. */
import type { MainSchemeCard, MainSchemeStage, MainSchemeThreatField, ScalingValue } from "../../../src/schema/index.ts";
import { imageOf } from "./art.ts";
import { brand } from "./brand.ts";
import { abilityRefs, baseFields, expectNoAttach, expectNoPlayerData, parse, record, type NormalizeContext } from "./context.ts";
import { prepare, type Prepared } from "./prepare.ts";
import { scalingOf, schemeIcons } from "./values.ts";

/** Returns each scheme set's emitted main scheme card id. */
export function normalizeMainSchemes(ctx: NormalizeContext): Map<string, string> {
  const { errors, topLevel } = ctx;
  const mainSchemeIdBySet = new Map<string, string>();
  const schemeSets = [...new Set(topLevel.filter((r) => r.type_code === "main_scheme").map((r) => r.card_set_code ?? ""))];
  for (const set of schemeSets) {
    const aSides = topLevel
      .filter((r) => r.type_code === "main_scheme" && r.card_set_code === set)
      .sort((x, y) => x.code.localeCompare(y.code));
    const stages: MainSchemeStage[] = [];
    const parts: Prepared[] = [];
    for (const ra of aSides) {
      const rb = ra.linked_card;
      if (!ra.code.endsWith("a") || !rb || !rb.code.endsWith("b")) {
        errors.push(`${ra.code}: main scheme record is not an A side linked to a B side`);
        continue;
      }
      const a = prepare(ctx, ra);
      const b = prepare(ctx, rb);
      parts.push(a, b);
      const pa = parse(ctx, a);
      const pb = parse(ctx, b);
      for (const [p, parsed] of [[a, pa], [b, pb]] as const) {
        expectNoPlayerData(ctx, p, parsed);
        expectNoAttach(ctx, p, parsed);
      }
      if (pa.keywords.length > 0) errors.push(`${ra.code}: keywords on a main scheme A side`);
      const stageNumber = Number.parseInt(rb.stage ?? "", 10);
      if (!Number.isInteger(stageNumber) || `${stageNumber}A` !== ra.stage) {
        errors.push(`${ra.code}: stage "${String(ra.stage)}"/"${String(rb.stage)}" not an NA/NB pair`);
      }
      if (rb.base_threat === null || rb.base_threat === undefined) errors.push(`${rb.code}: missing starting threat`);
      if (rb.threat === null || rb.threat === undefined) errors.push(`${rb.code}: missing target threat`);
      if (rb.escalation_threat === null || rb.escalation_threat === undefined) errors.push(`${rb.code}: missing acceleration`);
      // A later stage with its own title (Klaw's stage 2 is "Secret Rendezvous") keeps it.
      const firstName = parts[0]?.name;
      // The aggregate record carries the B side and the `…b` record the A side
      // (see `aggregateImage`). MarvelCDB's front/back for a main scheme is
      // "the side you play with" / "the side you set up from", not A / B.
      const bSideImage = ctx.aggregateImage(ra.code);
      const aSideImage = imageOf(rb.imagesrc);
      // Threat values printed as X (docs/phase7-wave1.md §1.5, Mutagen Cloud 2B): MarvelCDB encodes a printed X
      // as -1. Held as a flat 0 and the stage's own ability defines it (RRG 1.8 "Non-Numerical Variable").
      const printedX: MainSchemeThreatField[] = [];
      const schemeField = (value: number | null | undefined, fixed: boolean | undefined, field: MainSchemeThreatField): ScalingValue => {
        if (value === -1) {
          printedX.push(field);
          return { base: 0, perPlayer: 0 };
        }
        return scalingOf(value ?? 0, !fixed);
      };
      stages.push({
        stageNumber,
        ...(firstName !== undefined && b.name !== firstName ? { name: b.name } : {}),
        startingThreat: schemeField(rb.base_threat, rb.base_threat_fixed, "startingThreat"),
        targetThreat: schemeField(rb.threat, rb.threat_fixed, "targetThreat"),
        acceleration: schemeField(rb.escalation_threat, rb.escalation_threat_fixed, "acceleration"),
        ...(printedX.length > 0 ? { printedX } : {}),
        icons: schemeIcons(rb),
        text: b.text,
        traits: b.traits,
        keywords: pb.keywords,
        abilities: abilityRefs(ctx, rb.code, b.name, pb.abilities),
        ...(bSideImage ? { image: bSideImage } : {}),
        aSide: {
          text: a.text,
          abilities: abilityRefs(ctx, ra.code, a.name, pa.abilities),
          // The A-side record (`01097a`) has no image; the setup side is served
          // as the *linked* record's image (`01097b`).
          ...(aSideImage ? { image: aSideImage } : {}),
        },
      });
      ctx.handled.add(ra.code).add(rb.code);
    }
    const first = parts[0];
    const firstStage = stages[0];
    if (!first || !firstStage) continue;
    const card: MainSchemeCard = {
      // No card-level images: the A and B sides carry their own.
      ...baseFields(ctx, first, first.raw.code, parts.map((p) => p.raw.code), null),
      type: "main_scheme",
      encounterSetIds: [brand("encounterSet", set)],
      stages: [firstStage, ...stages.slice(1)],
    };
    mainSchemeIdBySet.set(set, card.id);
    record(ctx, card, set, parts);
  }
  return mainSchemeIdBySet;
}
