/** Step 4: villains (and leaders) — one card per villain/leader set, with one, two or three faces of the stage deck. */
import type { RawCard } from "../raw-types.ts";
import type { Trait, VillainCard, VillainDashStat, VillainSide, VillainStage } from "../../../src/schema/index.ts";
import { imageOf } from "./art.ts";
import { brand } from "./brand.ts";
import {
  abilityRefs,
  baseFields,
  checkNoSchemeFields,
  expectNoAttach,
  expectNoPlayerData,
  parse,
  record,
  type NormalizeContext,
} from "./context.ts";
import { prepare, type Prepared } from "./prepare.ts";
import { ROMAN, scalingOf } from "./values.ts";

/**
 * A "mode + face" stage label (docs/phase7-wave3.md §1.1): The Galaxy's Most Wanted's Collector (`gmw` 16080a/b,
 * 16081a/b) and The Mad Titan's Shadow's Hela (`mts` 21136a/b, 21137a/b) print `"A1"`/`"A2"` for their standard
 * double-sided villain card and `"B1"`/`"B2"` for their expert double-sided villain card — **the letter is the
 * mode and the digit is the face**, unlike The Wrecking Crew's bare `"A"`/`"B"` version letters (§ below) or
 * MojoMania's MaGog `"A"`/`"B"` *stage* pair. Comparing whole labels would misfile the Collector as MaGog-style
 * A/B versions (docs/phase7-wave2.md §15.2).
 */
const MODE_LABEL_RE = /^([A-Z])(\d+)$/;

/**
 * A face label with an optional mode letter: `"A1"` (MODE_LABEL_RE) or a bare digit, `"1"`/`"2"` — Trickster
 * Takeover's Loki, God of Lies (`tt` 55027a/b), a double-sided villain whose faces are numbered 1 and 2. A bare digit
 * is a face position in a mode with no letter, handled by the same linked-pair branch as the mode+face labels; unlike
 * them it carries no `stageLabel` (the label is not a printed stage letter).
 */
const FACE_LABEL_RE = /^([A-Z]?)(\d+)$/;

/**
 * Stage order: a roman numeral (Core, and wave 1's single-sided villains), per The Wrecking Crew, a printed
 * version letter (docs/phase7-wave1.md §1.2 — position A=1, B=2, kept as `VillainStage.stageLabel`), or a
 * mode+face label (`MODE_LABEL_RE`), whose digit is the face position within its mode's own double-sided card.
 */
const stageOrder = (rec: RawCard): number => {
  const s = rec.stage ?? "";
  if (ROMAN[s] !== undefined) return ROMAN[s];
  const modeMatch = FACE_LABEL_RE.exec(s);
  if (modeMatch) return Number(modeMatch[2]);
  if (/^[A-Z]$/.test(s)) return s.charCodeAt(0) - 64;
  return 0;
};

const stageLabelOf = (rec: RawCard): string | undefined => {
  const s = rec.stage ?? "";
  if (ROMAN[s] !== undefined) return undefined;
  if (MODE_LABEL_RE.test(s)) return s;
  return /^[A-Z]$/.test(s) ? s : undefined;
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

function buildVillainStage(
  ctx: NormalizeContext,
  r: RawCard,
): { stage: VillainStage; prepared: Prepared; activationOrder?: number } {
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
  // ∞ hit points (docs/phase7-wave3.md §1.1): MarvelCDB encodes a printed ∞ as `health: 0` on a mode+face
  // record's back face — the Collector's and Hela's "Wounded" faces. `hp` is `flat(0)` either way (`scalingOf`
  // below), the same encoding `dashedStats` uses for a printed "—".
  // A curated `Correction.infiniteHp` covers a face MarvelCDB gives a sentinel instead of 0 (`tt` 55029b to 55032b: 99).
  const infiniteHp =
    (MODE_LABEL_RE.test(r.stage ?? "") && r.health === 0) ||
    ctx.curation.corrections.some((c) => c.code === r.code && c.infiniteHp === true);
  const hitPoints = ctx.curation.corrections.find((c) => c.code === r.code && c.hitPoints !== undefined)?.hitPoints;
  const stage: VillainStage = {
    stageNumber,
    ...(stageLabel ? { stageLabel } : {}),
    hp: infiniteHp
      ? scalingOf(0, false, false)
      : scalingOf(hitPoints ?? r.health ?? 0, Boolean(r.health_per_hero), Boolean(r.health_per_group)),
    ...(infiniteHp ? { infiniteHp: true } : {}),
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

    // Mode + face labels (docs/phase7-wave3.md §1.1): the Collector (`gmw`) and Hela (`mts`) each print two
    // double-sided villain cards sharing one `card_set_code` — a standard mode card (`"A1"`/`"A2"`) and an expert
    // mode card (`"B1"`/`"B2"`) — not two stages of one card. Each mode's front record (digit 1, top-level) links
    // to its own hidden back record (digit 2); the mode letter, not the digit, decides which physical card a
    // record belongs to. Handled before `versionPairs`/`doubleSided` below, which would otherwise read the
    // digit as a *stage* number and misfile the pair the MaGog way (docs/phase7-wave2.md §15.2).
    //
    // A set may hold both kinds (Trickster Takeover's `god_of_lies`: the numbered Loki, God of Lies and the four
    // `"A1"`..`"D2"` Avatars of Loki): the face-labelled records are split off and built here, and whatever remains
    // continues through the version-pair/stage-chain paths below, decided per record group and not per set.
    const faceRecords = stageRecords.filter((r) => FACE_LABEL_RE.test(r.stage ?? ""));
    const modeLabelled = faceRecords.length > 0;
    if (modeLabelled) {
      const modeOf = (r: RawCard) => (FACE_LABEL_RE.exec(r.stage ?? "") as RegExpExecArray)[1] as string;
      const modes = [...new Set(faceRecords.map(modeOf))];
      for (const mode of modes) {
        for (const r of faceRecords.filter((rec) => modeOf(rec) === mode)) {
          const linked = r.linked_card;
          if (!linked || linked.type_code !== "villain") {
            errors.push(`${r.code}: expected a mode+face villain stage linked to its other face`);
            continue;
          }
          const front = buildVillainStage(ctx, r);
          const back = buildVillainStage(ctx, linked);
          // Two faces with different titles (the Avatars of Loki flip to Fading Figment) are legitimate only where the
          // pack's curation says so (`PackCuration.villainFaceNamesMayDiffer`); elsewhere a mismatch is a typo.
          if (front.prepared.name !== back.prepared.name && !ctx.curation.villainFaceNamesMayDiffer?.includes(set))
            errors.push(`${r.code}: villain face names differ`);
          // Both faces are the same single stage, flipped (VillainCard doc: "every side lists the same stage
          // numbers"); the printed digit told them apart as records, not as stages.
          const card: VillainCard = {
            ...baseFields(ctx, front.prepared, front.prepared.raw.code, [r.code, linked.code], null),
            type: "villain",
            encounterSetIds: [brand("encounterSet", set)],
            sides: [
              { side: "A", name: front.prepared.name, stages: [{ ...front.stage, stageNumber: 1 }] },
              { side: "B", name: back.prepared.name, stages: [{ ...back.stage, stageNumber: 1 }] },
            ],
            ...(printedType ? { printedType } : {}),
            ...(front.activationOrder !== undefined || back.activationOrder !== undefined
              ? { activationOrder: front.activationOrder ?? back.activationOrder }
              : {}),
          };
          // `printedFaces` enumerates a villain as `sides.flatMap(side => side.stages)` — side A (front) then side
          // B (back), matching this card's own `sides` array above.
          ctx.faceCodesByCardId.set(card.id, [r.code, linked.code]);
          record(ctx, card, set, [front.prepared, back.prepared]);
        }
      }
      // Standard and expert are different physical cards, so there is no single "the villain" of this set for
      // `villainIdBySet` to point at — the scenario names each card id directly (`villainCardId` and
      // `expertVillains.villainCardId`, the same shape The Once and Future Kang's colliding-stage sets use below).
      stageRecords.splice(0, stageRecords.length, ...stageRecords.filter((r) => !faceRecords.includes(r)));
      if (stageRecords.length === 0) continue;
    }

    // A linked pair whose two faces print *different* stages is one card carrying two difficulty versions, not
    // two faces of the same stage: MojoMania's MaGog (39001a "A" / 39001b "B"), main scheme 1A "Contents": "MaGog
    // (A) (MaGog (B) instead for expert mode)". Nothing flips it during play, so its faces are consecutive stages
    // of one side, the same as The Wrecking Crew's separately printed A/B versions. Recognized structurally.
    // When the pairs chain into one stage sequence (Age of Apocalypse's Apocalypse, 45101 I/II and 45102 III/IV)
    // they form one villain; when they collide (Mutant Genesis's "mansion_attack": Avalanche, Blob, Pyro and Toad,
    // each its own A/B card) each pair is its own villain, and each face its own one-stage card (below).
    const versionPairs =
      stageRecords.length > 0 &&
      stageRecords.every((r) => r.linked_card?.type_code === "villain" && stageOrder(r.linked_card) !== stageOrder(r));
    if (versionPairs) {
      const faces = stageRecords.flatMap((r) => [r.linked_card as RawCard, r]);
      if (new Set(faces.map(stageOrder)).size !== faces.length || ctx.curation.separateVillainVersions?.includes(set)) {
        for (const r of stageRecords) {
          const pair = [r, r.linked_card as RawCard].sort((x, y) => stageOrder(x) - stageOrder(y));
          const built = pair.map((face) => buildVillainStage(ctx, face));
          const [first, second] = built;
          if (!first || !second) continue;
          if (first.prepared.name !== second.prepared.name) errors.push(`${r.code}: villain version names differ`);
          // Each version is its own one-stage card (wave 6, docs/phase7-wave6.md §1.4): Mansion Attack's 32121a is
          // the standard-mode villain and 32121b the expert-mode one — mode versions the scenario picks between
          // (`villainCardId` / `expertVillains`, the Kang shape), not forms a card ability flips to.
          for (const [i, one] of built.entries()) {
            const face = pair[i] as RawCard;
            const card: VillainCard = {
              ...baseFields(ctx, one.prepared, face.code, [face.code], null),
              type: "villain",
              encounterSetIds: [brand("encounterSet", set)],
              sides: [{ side: "A", name: one.prepared.name, stages: [one.stage] }],
              ...(printedType ? { printedType } : {}),
            };
            ctx.faceCodesByCardId.set(card.id, [face.code]);
            record(ctx, card, set, [one.prepared]);
          }
        }
        continue;
      }
      stageRecords.splice(0, stageRecords.length, ...faces.sort((x, y) => stageOrder(x) - stageOrder(y)));
    }
    const doubleSided = !versionPairs && stageRecords.some((r) => r.linked_card?.type_code === "villain");

    // Several distinct villains sharing one card_set_code (wave 2, docs/phase7-wave2.md §1.8; wave 4 §1.6): The
    // Once and Future Kang's "kang"/"exp_kang" sets each hold six records — Kang (I), four differently-named
    // Kang (II) variants, and Kang (III) (which shares a title with Kang (I) but is not the next stage after it).
    // The Sinister Six's "sinister_six" set is the same shape: six single-stage villains, each "Activation Order
    // N" instead of a roman-numeral sequence (§6.7). Tower Defense's "tower_defense" set is a third variant: two
    // villains (Proxima Midnight, Corvus Glaive) that each genuinely do advance stage-to-stage (MC21 p. 10), so
    // they must land as two *multi-stage* `VillainCard`s, not six one-stage ones. Recognized structurally, without
    // naming a card: more than one record claims the same stage number, which a genuine single villain's stages
    // never do. Grouping by title (the roman numeral stripped) tells the shapes apart — Kang's "Kang (The
    // Conqueror)" group ({I, III}, skipping the branching II) and Sinister Six's six singleton groups ({I} each)
    // both have a gap or trivially satisfy no ordering claim beyond their own single stage, while Tower Defense's
    // two groups ({I, II, III} each) are complete, gapless stage-1-first runs — only that last shape is combined
    // into one card per group. `villainIdBySet` is left unset for this set either way: there is no single "the
    // villain" of it for a scenario to reference by set code, only `Scenario.setAsideVillainCardIds` /
    // `MultipleVillainsCuration.villainCardCodes` pointing at each group's own card id directly.
    if (!doubleSided) {
      const stageNumbers = stageRecords.map(stageOrder);
      const hasCollidingStageNumbers = new Set(stageNumbers).size !== stageNumbers.length;
      if (hasCollidingStageNumbers) {
        const baseTitleOf = (r: RawCard): string => {
          const m = /^(.*) (I{1,3}|IV|V)$/.exec(r.name ?? "");
          return m && ROMAN[m[2] as string] !== undefined ? (m[1] as string) : (r.name ?? "");
        };
        const groups = new Map<string, RawCard[]>();
        for (const r of stageRecords) {
          const title = baseTitleOf(r);
          const group = groups.get(title) ?? [];
          group.push(r);
          groups.set(title, group);
        }
        const groupList = [...groups.values()];
        const isGaplessRun = (recs: readonly RawCard[]): boolean => {
          const nums = recs.map(stageOrder).sort((x, y) => x - y);
          return nums.every((n, i) => n === i + 1);
        };
        const parallelVillains = groupList.length > 1 && groupList.every(isGaplessRun);
        for (const group of parallelVillains ? groupList : stageRecords.map((r) => [r])) {
          const sorted = [...group].sort((x, y) => stageOrder(x) - stageOrder(y));
          const stages: VillainStage[] = [];
          const parts: Prepared[] = [];
          let activationOrder: number | undefined;
          for (const r of sorted) {
            const { stage, prepared, activationOrder: ao } = buildVillainStage(ctx, r);
            stages.push(stage);
            parts.push(prepared);
            activationOrder ??= ao;
          }
          const first = parts[0];
          const firstStage = stages[0];
          if (!first || !firstStage) continue;
          if (new Set(parts.map((p) => p.name)).size !== 1) errors.push(`villain set ${set}: stage names differ`);
          const card: VillainCard = {
            ...baseFields(
              ctx,
              first,
              first.raw.code,
              parts.map((p) => p.raw.code),
              null,
            ),
            type: "villain",
            encounterSetIds: [brand("encounterSet", set)],
            sides: [{ side: "A", name: first.name, stages: [firstStage, ...stages.slice(1)] }],
            ...(printedType ? { printedType } : {}),
            ...(activationOrder !== undefined ? { activationOrder } : {}),
          };
          // `printedFaces` enumerates a single-side villain's stages in `stages`' own order (matches `sorted`).
          ctx.faceCodesByCardId.set(
            card.id,
            parts.map((p) => p.raw.code),
          );
          record(ctx, card, set, parts);
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
      const linkedRecords = stageRecords
        .filter((r) => r.linked_card?.type_code === "villain")
        .sort((x, y) => stageOrder(x) - stageOrder(y));
      const unlinkedExtras = stageRecords
        .filter((r) => !(r.linked_card?.type_code === "villain"))
        .sort((x, y) => stageOrder(x) - stageOrder(y));
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
        // The top-level record is side B unless curation says it is the printed front (Spiral).
        const frontIsA = ctx.curation.villainFrontIsSideA?.includes(set) === true;
        const { stage: stageB, prepared: pB, activationOrder: aoB } = buildVillainStage(ctx, frontIsA ? linked : r);
        const { stage: stageA, prepared: pA, activationOrder: aoA } = buildVillainStage(ctx, frontIsA ? r : linked);
        stagesA.push(stageA);
        stagesB.push(stageB);
        partsA.push(pA);
        partsB.push(pB);
        codes.push(...(frontIsA ? [r.code, linked.code] : [linked.code, r.code]));
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
      if (threeSided && new Set(partsC.map((p) => p.name)).size !== 1)
        errors.push(`villain set ${set}: side C stage names differ`);
      const sides: [VillainSide, VillainSide, ...VillainSide[]] = [
        { side: "A", name: firstA.name, stages: [firstStageA, ...stagesA.slice(1)] },
        { side: "B", name: firstB.name, stages: [firstStageB, ...stagesB.slice(1)] },
      ];
      if (threeSided && firstC && firstStageC)
        sides.push({ side: "C", name: firstC.name, stages: [firstStageC, ...stagesC.slice(1)] });
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
      // `printedFaces` enumerates `sides.flatMap(side => side.stages)` — side A's stages, then side B's, then
      // (if three-sided) side C's, each already in stage order.
      ctx.faceCodesByCardId.set(card.id, [
        ...partsA.map((p) => p.raw.code),
        ...partsB.map((p) => p.raw.code),
        ...(threeSided ? partsC.map((p) => p.raw.code) : []),
      ]);
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
      ...baseFields(
        ctx,
        first,
        first.raw.code,
        parts.map((p) => p.raw.code),
        null,
      ),
      type: "villain",
      encounterSetIds: [brand("encounterSet", set)],
      sides: [{ side: "A", name: first.name, stages: [firstStage, ...stages.slice(1)] }],
      ...(printedType ? { printedType } : {}),
      ...(activationOrder !== undefined ? { activationOrder } : {}),
    };
    villainIdBySet.set(set, card.id);
    // `printedFaces` enumerates a single-side villain's stages in `stages`' own order.
    ctx.faceCodesByCardId.set(
      card.id,
      parts.map((p) => p.raw.code),
    );
    record(ctx, card, set, parts);
  }
  return villainIdBySet;
}
