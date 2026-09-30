/** Step 5: main schemes — one card per scenario set, one stage per A/B record pair. */
import type {
  CardText,
  MainSchemeCard,
  MainSchemeStage,
  MainSchemeThreatField,
  ScalingValue,
} from "../../../src/schema/index.ts";

/** `unerrataedText("")` inlined — importing the schema's runtime helper here trips a `.js`-extension resolution
 * issue under `--experimental-strip-types` for this file's dependency graph; the literal is equivalent. */
const emptyText: CardText = { printed: "", current: "" };
import type { RawCard } from "../raw-types.ts";
import { imageOf } from "./art.ts";
import { brand } from "./brand.ts";
import {
  abilityRefs,
  baseFields,
  expectNoAttach,
  expectNoPlayerData,
  parse,
  record,
  type NormalizeContext,
} from "./context.ts";
import { normalizeEncounterCard } from "./encounter-cards.ts";
import { prepare, type Prepared } from "./prepare.ts";
import { scalingOf, schemeIcons } from "./values.ts";

/**
 * Venom Goblin's lettered main scheme chain (docs/phase7-wave5.md §1.1): every stage's linked record is an
 * `environment`, not the ordinary main-scheme B side. Skies Over New York (A) prints only a `Setup:` A side and its
 * "linked" record is its own environment restating the scenario rules; Lower/Midtown/Upper Manhattan (B–D) print
 * their scheme text and threat values directly on the "a" record (MarvelCDB has no real B side for them at all —
 * their "b" is the environment they flip to), with `stage` a bare letter ("A"–"D") rather than the ordinary "1A"
 * form. One `MainSchemeCard` is still emitted (id = the first, "A", record's own code), each stage carrying
 * `otherFaceId` to its own emitted `EnvironmentCard`, and stages B–D carrying `onCompletion: "flipToOtherFace"`
 * (the p. 67 erratum). Stage A never holds threat (its `aSide` is the Setup, top-level fields all `dashedValues`).
 */
function normalizeLetteredSchemeChain(
  ctx: NormalizeContext,
  aSides: readonly RawCard[],
  set: string,
  mainSchemeIdBySet: Map<string, string>,
): void {
  const { errors } = ctx;
  const ordered = [...aSides].sort((x, y) => (x.stage ?? "").localeCompare(y.stage ?? ""));
  const first = ordered[0];
  if (!first) return;
  const firstPrepared = prepare(ctx, first);
  const mainSchemeId = brand("card", first.code);
  const stages: MainSchemeStage[] = [];
  const parts: Prepared[] = [firstPrepared];
  for (const [i, ra] of ordered.entries()) {
    const rb = ra.linked_card;
    if (!rb || rb.type_code !== "environment") {
      errors.push(`${ra.code}: lettered main scheme stage has no linked environment`);
      continue;
    }
    const isFirst = i === 0;
    const a = isFirst ? firstPrepared : prepare(ctx, ra);
    const pa = parse(ctx, a);
    expectNoPlayerData(ctx, a, pa);
    expectNoAttach(ctx, a, pa);
    if (!isFirst) parts.push(a);

    // The environment this stage flips to, emitted through the ordinary encounter-card path with `otherFaceId`
    // cross-referencing this main scheme card (`BaseCard.otherFaceId`, the two-separately-emitted-cards shape).
    const envP = prepare(ctx, rb);
    const envParsed = parse(ctx, envP);
    const envCommon = { ...baseFields(ctx, envP, rb.code, [rb.code]), otherFaceId: mainSchemeId };
    normalizeEncounterCard(
      ctx,
      {
        r: rb,
        p: envP,
        parsed: envParsed,
        set,
        common: envCommon,
        abilities: abilityRefs(ctx, rb.code, envP.name, envParsed.abilities),
      },
      undefined,
      [],
    );
    const envId = brand("card", rb.code);

    const dashed: MainSchemeThreatField[] = [];
    const field = (
      value: number | null | undefined,
      fixed: boolean | undefined,
      key: MainSchemeThreatField,
    ): ScalingValue => {
      if (isFirst) {
        dashed.push(key);
        return { base: 0, perPlayer: 0 };
      }
      if (value === null || value === undefined) {
        if (fixed) dashed.push(key);
        else errors.push(`${ra.code}: missing ${key}`);
        return { base: 0, perPlayer: 0 };
      }
      return scalingOf(value, !fixed);
    };
    const startingThreat = field(ra.base_threat, ra.base_threat_fixed, "startingThreat");
    const targetThreat = field(ra.threat, ra.threat_fixed, "targetThreat");
    const acceleration = field(ra.escalation_threat, ra.escalation_threat_fixed, "acceleration");
    const stageImage = imageOf(ra.imagesrc);

    stages.push({
      stageNumber: i + 1,
      ...(ra.stage ? { stageLetter: ra.stage } : {}),
      ...(a.name !== firstPrepared.name ? { name: a.name } : {}),
      startingThreat,
      targetThreat,
      acceleration,
      ...(dashed.length > 0 ? { dashedValues: dashed } : {}),
      otherFaceId: envId,
      ...(isFirst ? {} : { onCompletion: "flipToOtherFace" as const }),
      icons: isFirst ? [] : schemeIcons(ra),
      text: isFirst ? emptyText : a.text,
      traits: isFirst ? [] : a.traits,
      keywords: isFirst ? [] : pa.keywords,
      abilities: isFirst ? [] : abilityRefs(ctx, ra.code, a.name, pa.abilities),
      // Each stage prints only one physical face (`ra`) — there is no separate A-side scan for stages B–D, and no
      // separate B-side scan for stage A. `checkCoverage` still requires an artwork reference for both halves of
      // every stage, so the one printed image is offered for both.
      ...(stageImage ? { image: stageImage } : {}),
      aSide: {
        text: isFirst ? a.text : emptyText,
        abilities: isFirst ? abilityRefs(ctx, ra.code, a.name, pa.abilities) : [],
        ...(stageImage ? { image: stageImage } : {}),
      },
    });
    ctx.handled.add(ra.code);
  }
  const firstStage = stages[0];
  if (!firstStage) return;
  const card: MainSchemeCard = {
    ...baseFields(
      ctx,
      firstPrepared,
      first.code,
      ordered.map((r) => r.code),
      null,
    ),
    type: "main_scheme",
    encounterSetIds: [brand("encounterSet", set)],
    stages: [firstStage, ...stages.slice(1)],
  };
  mainSchemeIdBySet.set(set, card.id);
  record(ctx, card, set, parts);
}

/** Returns each scheme set's emitted main scheme card id. */
export function normalizeMainSchemes(ctx: NormalizeContext): Map<string, string> {
  const { errors, topLevel } = ctx;
  const mainSchemeIdBySet = new Map<string, string>();
  const schemeSets = [
    ...new Set(topLevel.filter((r) => r.type_code === "main_scheme").map((r) => r.card_set_code ?? "")),
  ];
  for (const set of schemeSets) {
    const aSides = topLevel
      .filter((r) => r.type_code === "main_scheme" && r.card_set_code === set)
      .sort((x, y) => x.code.localeCompare(y.code));
    // docs/phase7-wave5.md §1.1: every stage's linked record is an environment, not an ordinary main-scheme B side.
    if (aSides.length > 0 && aSides.every((r) => r.linked_card?.type_code === "environment")) {
      normalizeLetteredSchemeChain(ctx, aSides, set, mainSchemeIdBySet);
      continue;
    }
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
      for (const [p, parsed] of [
        [a, pa],
        [b, pb],
      ] as const) {
        expectNoPlayerData(ctx, p, parsed);
        expectNoAttach(ctx, p, parsed);
      }
      if (pa.keywords.length > 0) errors.push(`${ra.code}: keywords on a main scheme A side`);
      const stageNumber = Number.parseInt(rb.stage ?? "", 10);
      if (!Number.isInteger(stageNumber) || `${stageNumber}A` !== ra.stage) {
        errors.push(`${ra.code}: stage "${String(ra.stage)}"/"${String(rb.stage)}" not an NA/NB pair`);
      }
      // Dashed values (wave 2, docs/phase7-wave2.md §1.6): MarvelCDB gives a stage with no printed starting/target/
      // acceleration threat a `null` value alongside its own `*_fixed: true` flag — a stage that genuinely has no
      // way to advance by threat, distinct from a data gap (which would carry `_fixed: false`). Curation must
      // confirm the dashes from the card image before a card using this is emitted; flagged there, not here.
      const dashedValues: MainSchemeThreatField[] = [];
      const missingOrDashed = (
        value: number | null | undefined,
        fixed: boolean | undefined,
        field: MainSchemeThreatField,
        label: string,
      ) => {
        if (value !== null && value !== undefined) return;
        if (fixed) dashedValues.push(field);
        else errors.push(`${rb.code}: missing ${label}`);
      };
      missingOrDashed(rb.base_threat, rb.base_threat_fixed, "startingThreat", "starting threat");
      missingOrDashed(rb.threat, rb.threat_fixed, "targetThreat", "target threat");
      missingOrDashed(rb.escalation_threat, rb.escalation_threat_fixed, "acceleration", "acceleration");
      // A later stage with its own title (Klaw's stage 2 is "Secret Rendezvous") keeps it.
      const firstName = parts[0]?.name;
      // The aggregate record carries the B side and the `…b` record the A side
      // (see `aggregateImage`). MarvelCDB's front/back for a main scheme is
      // "the side you play with" / "the side you set up from", not A / B.
      // Not every pack has a bare aggregate record for a main scheme (wave 1's did; several later packs — Mojo
      // Mania and others in `mojo` — have none at all, `byCode.get(aSideCode.replace(/a$/, ""))` returning
      // `undefined`), even though the B-side's own linked record carries a perfectly good `imagesrc` of its own.
      // Falls back to that before giving up, the same direction `aSideImage` already falls back to `rb.imagesrc`
      // then `ra.imagesrc` below — backward compatible: this fallback only fires when the aggregate lookup found
      // nothing, so wave 1's own (aggregate-backed) output is unchanged.
      const bSideImage = ctx.aggregateImage(ra.code) ?? imageOf(rb.imagesrc);
      // The Once and Future Kang's stage records go the other way round from the wave 1 packs this originally
      // matched: the "a" record carries its own image and the linked "b" record's `imagesrc` is null (verified —
      // `11008a.png` exists, `11008b` has no `imagesrc` at all). Falling back to the "a" record's own image when
      // the "b" record has none keeps the existing (already-verified) wave 1 behavior unchanged.
      // A third, lowest-priority fallback to the aggregate record's own `imagesrc` (Mutant Genesis' 21074/21098/
      // 21114/21138/21165 and likely other later packs): confirmed cases where the bare aggregate record (dropped
      // as a duplicate everywhere else) is the *only* place MarvelCDB actually publishes the A side's art — both
      // `ra.imagesrc` and `rb.imagesrc` are genuinely absent, matching the README's own "A side from the aggregate
      // record" documentation (this fallback was previously only wired for `bSideImage`, above). Backward
      // compatible: only fires when both higher-priority lookups already failed, so it cannot change any pack
      // whose A-side image already resolved.
      const aSideImage = imageOf(rb.imagesrc) ?? imageOf(ra.imagesrc) ?? ctx.aggregateImage(ra.code);
      // Threat values printed as X (docs/phase7-wave1.md §1.5, Mutagen Cloud 2B): MarvelCDB encodes a printed X
      // as -1. Held as a flat 0 and the stage's own ability defines it (RRG 1.8 "Non-Numerical Variable").
      const printedX: MainSchemeThreatField[] = [];
      const schemeField = (
        value: number | null | undefined,
        fixed: boolean | undefined,
        field: MainSchemeThreatField,
      ): ScalingValue => {
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
        ...(dashedValues.length > 0 ? { dashedValues } : {}),
        icons: schemeIcons(rb),
        text: b.text,
        traits: b.traits,
        keywords: pb.keywords,
        abilities: abilityRefs(ctx, rb.code, b.name, pb.abilities),
        // docs/phase7-wave3.md §3.37: "If this stage/scheme is completed, the players lose the game." printed
        // anywhere in the B-side text, final stage or not — a final stage already loses by the engine's default
        // rule, so the flag there just restates it; a non-final stage needs it to lose instead of advancing.
        ...(pb.completionLoses ? { completionLoses: true } : {}),
        // docs/phase7-wave4.md §1.5: "Proxima Midnight's Scheme." / "Corvus Glaive's Scheme." (Tower Defense) — a
        // main scheme stage that belongs to one of several villains in the scenario.
        ...(pb.villainOf ? { villainOf: pb.villainOf } : {}),
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
      ...baseFields(
        ctx,
        first,
        first.raw.code,
        parts.map((p) => p.raw.code),
        null,
      ),
      type: "main_scheme",
      encounterSetIds: [brand("encounterSet", set)],
      stages: [firstStage, ...stages.slice(1)],
    };
    mainSchemeIdBySet.set(set, card.id);
    record(ctx, card, set, parts);
  }
  return mainSchemeIdBySet;
}
