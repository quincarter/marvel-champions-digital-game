/** Step 4: villains — one card per villain set, with one or two faces of the stage deck. */
import type { RawCard } from "../raw-types.ts";
import type { VillainCard, VillainDashStat, VillainStage } from "../../../src/schema/index.ts";
import { imageOf } from "./art.ts";
import { brand } from "./brand.ts";
import { abilityRefs, baseFields, checkNoSchemeFields, expectNoAttach, expectNoPlayerData, parse, record, type NormalizeContext } from "./context.ts";
import { prepare, type Prepared } from "./prepare.ts";
import { ROMAN, scalingOf } from "./values.ts";

/**
 * Stage order: a roman numeral (Core, and wave 1's single-sided villains) or, per The Wrecking Crew, a printed
 * version letter (docs/phase7-wave1.md §1.2 — position A=1, B=2, kept as `VillainStage.stageLabel`).
 */
const stageOrder = (rec: RawCard): number => {
  const s = rec.stage ?? "";
  if (ROMAN[s] !== undefined) return ROMAN[s];
  if (/^[A-Z]$/.test(s)) return s.charCodeAt(0) - 64;
  return 0;
};

const stageLabelOf = (rec: RawCard): string | undefined => {
  const s = rec.stage ?? "";
  return ROMAN[s] === undefined && /^[A-Z]$/.test(s) ? s : undefined;
};

function buildVillainStage(ctx: NormalizeContext, r: RawCard): { stage: VillainStage; prepared: Prepared } {
  const { errors } = ctx;
  const p = prepare(ctx, r);
  checkNoSchemeFields(ctx, p);
  const parsed = parse(ctx, p);
  expectNoPlayerData(ctx, p, parsed);
  expectNoAttach(ctx, p, parsed);
  const stageNumber = stageOrder(r);
  const stageLabel = stageLabelOf(r);
  const stageImage = imageOf(r.imagesrc);
  if (stageNumber === 0) errors.push(`${r.code}: villain stage "${String(r.stage)}" is not a roman numeral`);
  if (r.health === null || r.health === undefined) errors.push(`${r.code}: villain without hit points`);
  // Printed dashes (docs/phase7-wave1.md §1.3): MarvelCDB encodes a printed "—" ATK/SCH as an absent field.
  // Risky Business's Norman Osborn prints no ATK; its Green Goblin face prints no SCH.
  const dashedStats: VillainDashStat[] = [];
  if (r.attack === null || r.attack === undefined) dashedStats.push("atk");
  if (r.scheme === null || r.scheme === undefined) dashedStats.push("sch");
  const stage: VillainStage = {
    stageNumber,
    ...(stageLabel ? { stageLabel } : {}),
    hp: scalingOf(r.health ?? 0, Boolean(r.health_per_hero)),
    atk: r.attack ?? 0,
    sch: r.scheme ?? 0,
    ...(dashedStats.length > 0 ? { dashedStats } : {}),
    text: p.text,
    traits: p.traits,
    keywords: parsed.keywords,
    abilities: abilityRefs(ctx, r.code, p.name, parsed.abilities),
    ...(stageImage ? { image: stageImage } : {}),
  };
  ctx.handled.add(r.code);
  return { stage, prepared: p };
}

/** Returns each villain set's emitted villain card id. */
export function normalizeVillains(ctx: NormalizeContext): Map<string, string> {
  const { errors, topLevel } = ctx;
  const villainSets = [...new Set(topLevel.filter((r) => r.type_code === "villain").map((r) => r.card_set_code ?? ""))];
  const villainIdBySet = new Map<string, string>();
  for (const set of villainSets) {
    const stageRecords = topLevel
      .filter((r) => r.type_code === "villain" && r.card_set_code === set)
      .sort((x, y) => stageOrder(x) - stageOrder(y));

    const doubleSided = stageRecords.some((r) => r.linked_card?.type_code === "villain");
    if (doubleSided) {
      // Risky Business: MarvelCDB's visible top-level record is the Green Goblin face; the linked, hidden record
      // is Norman Osborn. The rulebook has it the other way round (main scheme 1A "Contents": "Norman Osborn (I)
      // and Norman Osborn (II)") — Norman's side is the one face up at setup, so it becomes side A here, and the
      // card id is Norman's stage-1 code (docs/phase7-wave1.md §1.3, §1.12).
      const stagesA: VillainStage[] = [];
      const stagesB: VillainStage[] = [];
      const partsA: Prepared[] = [];
      const partsB: Prepared[] = [];
      const codes: string[] = [];
      for (const r of stageRecords) {
        const linked = r.linked_card;
        if (!linked || linked.type_code !== "villain") {
          errors.push(`${r.code}: expected a double-sided villain stage linked to another villain record`);
          continue;
        }
        const { stage: stageB, prepared: pB } = buildVillainStage(ctx, r);
        const { stage: stageA, prepared: pA } = buildVillainStage(ctx, linked);
        stagesA.push(stageA);
        stagesB.push(stageB);
        partsA.push(pA);
        partsB.push(pB);
        codes.push(linked.code, r.code);
      }
      const firstA = partsA[0];
      const firstB = partsB[0];
      const firstStageA = stagesA[0];
      const firstStageB = stagesB[0];
      if (!firstA || !firstB || !firstStageA || !firstStageB) continue;
      if (new Set(partsA.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: side A stage names differ`);
      if (new Set(partsB.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: side B stage names differ`);
      const card: VillainCard = {
        // No card-level images: every stage of every side is its own printed card.
        ...baseFields(ctx, firstA, firstA.raw.code, codes, null),
        type: "villain",
        encounterSetIds: [brand("encounterSet", set)],
        sides: [
          { side: "A", name: firstA.name, stages: [firstStageA, ...stagesA.slice(1)] },
          { side: "B", name: firstB.name, stages: [firstStageB, ...stagesB.slice(1)] },
        ],
        startingSide: "A",
      };
      villainIdBySet.set(set, card.id);
      record(ctx, card, set, [...partsA, ...partsB]);
      continue;
    }

    const stages: VillainStage[] = [];
    const parts: Prepared[] = [];
    for (const r of stageRecords) {
      const { stage, prepared } = buildVillainStage(ctx, r);
      stages.push(stage);
      parts.push(prepared);
    }
    const first = parts[0];
    const firstStage = stages[0];
    if (!first || !firstStage) continue;
    if (new Set(parts.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: stage names differ`);
    const labelled = stages.map((s) => s.stageLabel !== undefined);
    if (labelled.some(Boolean) && !labelled.every(Boolean)) {
      errors.push(`villain set ${set}: some stages are labelled ("A"/"B") and some are not`);
    }
    const card: VillainCard = {
      // No card-level images: every stage is a separate printed card.
      ...baseFields(ctx, first, first.raw.code, parts.map((p) => p.raw.code), null),
      type: "villain",
      encounterSetIds: [brand("encounterSet", set)],
      sides: [{ side: "A", name: first.name, stages: [firstStage, ...stages.slice(1)] }],
    };
    villainIdBySet.set(set, card.id);
    record(ctx, card, set, parts);
  }
  return villainIdBySet;
}
