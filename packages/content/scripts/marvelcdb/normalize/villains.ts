/** Step 4: villains (and leaders) — one card per villain/leader set, with one, two or three faces of the stage deck. */
import type { RawCard } from "../raw-types.ts";
import type { Trait, VillainCard, VillainDashStat, VillainSide, VillainStage } from "../../../src/schema/index.ts";
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

/** MarvelCDB prints a villain's activation order value as a trait ("Activation Order 1") rather than a stat field
 * (docs/phase7-wave2.md §6.7 — The Sinister Six, 27094–27099). Stripped out of the printed trait list into
 * `VillainCard.activationOrder`. */
const ACTIVATION_ORDER_RE = /^ACTIVATION ORDER (\d+)$/;
function extractActivationOrder(traits: readonly Trait[]): { traits: Trait[]; activationOrder?: number } {
  let activationOrder: number | undefined;
  const kept: Trait[] = [];
  for (const t of traits) {
    const m = ACTIVATION_ORDER_RE.exec(t as unknown as string);
    if (m) activationOrder = Number(m[1]);
    else kept.push(t);
  }
  return activationOrder !== undefined ? { traits: kept, activationOrder } : { traits: kept };
}

function buildVillainStage(ctx: NormalizeContext, r: RawCard): { stage: VillainStage; prepared: Prepared; activationOrder?: number } {
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
  const { traits: stageTraits, activationOrder } = extractActivationOrder(p.traits);
  const stage: VillainStage = {
    stageNumber,
    ...(stageLabel ? { stageLabel } : {}),
    hp: scalingOf(r.health ?? 0, Boolean(r.health_per_hero)),
    atk: r.attack ?? 0,
    sch: r.scheme ?? 0,
    ...(dashedStats.length > 0 ? { dashedStats } : {}),
    text: p.text,
    traits: stageTraits,
    keywords: parsed.keywords,
    abilities: abilityRefs(ctx, r.code, p.name, parsed.abilities),
    ...(stageImage ? { image: stageImage } : {}),
  };
  ctx.handled.add(r.code);
  return { stage, prepared: p, ...(activationOrder !== undefined ? { activationOrder } : {}) };
}

/** Returns each villain/leader set's emitted villain card id. */
export function normalizeVillains(ctx: NormalizeContext): Map<string, string> {
  const { errors, topLevel } = ctx;
  // Wave 2 (docs/phase7-wave2.md §6.3): the Leader card type (Civil War, Synthezoid) "follows the same rules as
  // the villain card type for all purposes" (RRG 1.8 "Leader", p. 26) — normalized the same way, with
  // `printedType: "leader"` recorded so card abilities that name "a leader" specifically can find it.
  const isVillainLike = (r: RawCard) => r.type_code === "villain" || r.type_code === "leader";
  const villainSets = [...new Set(topLevel.filter(isVillainLike).map((r) => r.card_set_code ?? ""))];
  const villainIdBySet = new Map<string, string>();
  for (const set of villainSets) {
    const stageRecords = topLevel
      .filter((r) => isVillainLike(r) && r.card_set_code === set)
      .sort((x, y) => stageOrder(x) - stageOrder(y));
    const printedType = stageRecords.some((r) => r.type_code === "leader") ? ("leader" as const) : undefined;

    // A linked pair whose two faces print *different* stages is one card carrying two difficulty versions, not
    // two faces of the same stage: MojoMania's MaGog (39001a "A" / 39001b "B"), main scheme 1A "Contents": "MaGog
    // (A) (MaGog (B) instead for expert mode)". Nothing flips it during play, so its faces are consecutive stages
    // of one side, the same as The Wrecking Crew's separately printed A/B versions. Recognized structurally.
    // When the pairs chain into one stage sequence (Age of Apocalypse's Apocalypse, 45101 I/II and 45102 III/IV)
    // they form one villain; when they collide (Mutant Genesis's "mansion_attack": Avalanche, Blob, Pyro and Toad,
    // each its own A/B card) each pair is its own villain.
    const versionPairs =
      stageRecords.length > 0 &&
      stageRecords.every((r) => r.linked_card?.type_code === "villain" && stageOrder(r.linked_card) !== stageOrder(r));
    if (versionPairs) {
      const faces = stageRecords.flatMap((r) => [r.linked_card as RawCard, r]);
      if (new Set(faces.map(stageOrder)).size !== faces.length) {
        for (const r of stageRecords) {
          const pair = [r, r.linked_card as RawCard].sort((x, y) => stageOrder(x) - stageOrder(y));
          const built = pair.map((face) => buildVillainStage(ctx, face));
          const [first, second] = built;
          if (!first || !second) continue;
          if (first.prepared.name !== second.prepared.name) errors.push(`${r.code}: villain version names differ`);
          const card: VillainCard = {
            ...baseFields(ctx, first.prepared, first.prepared.raw.code, pair.map((face) => face.code), null),
            type: "villain",
            encounterSetIds: [brand("encounterSet", set)],
            sides: [{ side: "A", name: first.prepared.name, stages: [first.stage, second.stage] }],
            ...(printedType ? { printedType } : {}),
          };
          record(ctx, card, set, built.map((b) => b.prepared));
        }
        continue;
      }
      stageRecords.splice(0, stageRecords.length, ...faces.sort((x, y) => stageOrder(x) - stageOrder(y)));
    }
    const doubleSided = !versionPairs && stageRecords.some((r) => r.linked_card?.type_code === "villain");

    // Several distinct, single-stage villains sharing one card_set_code (wave 2, docs/phase7-wave2.md §1.8): The
    // Once and Future Kang's "kang"/"exp_kang" sets each hold six such records — Kang (I), four differently-named
    // Kang (II) variants, and Kang (III) (which shares a title with Kang (I) but is not the next stage after it).
    // The Sinister Six's "sinister_six" set is the same shape: six single-stage villains, each "Activation Order
    // N" instead of a roman-numeral sequence (§6.7). None of these forms one villain's incrementing stage
    // sequence. Recognized structurally, without naming a card: more than one record claims the same stage
    // number, which a genuine single villain's stages never do. Each becomes its own one-stage `VillainCard`
    // instead of being merged into one (and erroring "stage names differ" the way the single-sequence branch
    // below would). `villainIdBySet` is left unset for this set: there is no single "the villain" of it for a
    // scenario to reference by set code, only Scenario.setAsideVillainCardIds pointing at each record's own card
    // id directly.
    if (!doubleSided) {
      const stageNumbers = stageRecords.map(stageOrder);
      const hasCollidingStageNumbers = new Set(stageNumbers).size !== stageNumbers.length;
      if (hasCollidingStageNumbers) {
        for (const r of stageRecords) {
          const { stage, prepared, activationOrder } = buildVillainStage(ctx, r);
          const card: VillainCard = {
            ...baseFields(ctx, prepared, r.code, [r.code], null),
            type: "villain",
            encounterSetIds: [brand("encounterSet", set)],
            sides: [{ side: "A", name: prepared.name, stages: [stage] }],
            ...(printedType ? { printedType } : {}),
            ...(activationOrder !== undefined ? { activationOrder } : {}),
          };
          record(ctx, card, set, [prepared]);
        }
        continue;
      }
    }

    if (doubleSided) {
      // Risky Business: MarvelCDB's visible top-level record is the Green Goblin face; the linked, hidden record
      // is Norman Osborn. The rulebook has it the other way round (main scheme 1A "Contents": "Norman Osborn (I)
      // and Norman Osborn (II)") — Norman's side is the one face up at setup, so it becomes side A here, and the
      // card id is Norman's stage-1 code (docs/phase7-wave1.md §1.3, §1.12).
      //
      // Wave 2 schema pass (docs/phase7-wave2.md §6.9): a foldable, three-sided villain (Age of Apocalypse's
      // Apocalypse, `en_sabah_nur`) prints a third face — Giant — told apart by form trait, published as its own
      // top-level, *unlinked* record per stage (…c) alongside the linked A/B pair (…a linked to hidden …b).
      // Recognized structurally, not by name: every A-side record here has a linked B, and there is exactly one
      // further unlinked villain record per stage.
      const linkedRecords = stageRecords.filter((r) => r.linked_card?.type_code === "villain").sort((x, y) => stageOrder(x) - stageOrder(y));
      const unlinkedExtras = stageRecords.filter((r) => !(r.linked_card?.type_code === "villain")).sort((x, y) => stageOrder(x) - stageOrder(y));
      const threeSided = unlinkedExtras.length > 0 && unlinkedExtras.length === linkedRecords.length;

      const stagesA: VillainStage[] = [];
      const stagesB: VillainStage[] = [];
      const stagesC: VillainStage[] = [];
      const partsA: Prepared[] = [];
      const partsB: Prepared[] = [];
      const partsC: Prepared[] = [];
      const codes: string[] = [];
      let activationOrder: number | undefined;
      for (let i = 0; i < linkedRecords.length; i++) {
        const r = linkedRecords[i] as RawCard;
        const linked = r.linked_card;
        if (!linked || linked.type_code !== "villain") {
          errors.push(`${r.code}: expected a double-sided villain stage linked to another villain record`);
          continue;
        }
        const { stage: stageB, prepared: pB, activationOrder: aoB } = buildVillainStage(ctx, r);
        const { stage: stageA, prepared: pA, activationOrder: aoA } = buildVillainStage(ctx, linked);
        stagesA.push(stageA);
        stagesB.push(stageB);
        partsA.push(pA);
        partsB.push(pB);
        codes.push(linked.code, r.code);
        activationOrder ??= aoA ?? aoB;
        if (threeSided) {
          const c = unlinkedExtras[i] as RawCard;
          if (stageOrder(c) !== stageOrder(r)) {
            errors.push(`${c.code}: three-sided villain stage does not line up with ${r.code}'s stage`);
          }
          const { stage: stageC, prepared: pC, activationOrder: aoC } = buildVillainStage(ctx, c);
          stagesC.push(stageC);
          partsC.push(pC);
          codes.push(c.code);
          activationOrder ??= aoC;
        }
      }
      const firstA = partsA[0];
      const firstB = partsB[0];
      const firstC = partsC[0];
      const firstStageA = stagesA[0];
      const firstStageB = stagesB[0];
      const firstStageC = stagesC[0];
      if (!firstA || !firstB || !firstStageA || !firstStageB) continue;
      if (new Set(partsA.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: side A stage names differ`);
      if (new Set(partsB.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: side B stage names differ`);
      if (threeSided && new Set(partsC.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: side C stage names differ`);
      const sides: [VillainSide, VillainSide, ...VillainSide[]] = [
        { side: "A", name: firstA.name, stages: [firstStageA, ...stagesA.slice(1)] },
        { side: "B", name: firstB.name, stages: [firstStageB, ...stagesB.slice(1)] },
      ];
      if (threeSided && firstC && firstStageC) sides.push({ side: "C", name: firstC.name, stages: [firstStageC, ...stagesC.slice(1)] });
      const card: VillainCard = {
        // No card-level images: every stage of every side is its own printed card.
        ...baseFields(ctx, firstA, firstA.raw.code, codes, null),
        type: "villain",
        encounterSetIds: [brand("encounterSet", set)],
        sides,
        startingSide: "A",
        ...(printedType ? { printedType } : {}),
        ...(activationOrder !== undefined ? { activationOrder } : {}),
      };
      villainIdBySet.set(set, card.id);
      record(ctx, card, set, [...partsA, ...partsB, ...partsC]);
      continue;
    }

    const stages: VillainStage[] = [];
    const parts: Prepared[] = [];
    let activationOrder: number | undefined;
    for (const r of stageRecords) {
      const { stage, prepared, activationOrder: ao } = buildVillainStage(ctx, r);
      stages.push(stage);
      parts.push(prepared);
      activationOrder ??= ao;
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
      ...(printedType ? { printedType } : {}),
      ...(activationOrder !== undefined ? { activationOrder } : {}),
    };
    villainIdBySet.set(set, card.id);
    record(ctx, card, set, parts);
  }
  return villainIdBySet;
}
