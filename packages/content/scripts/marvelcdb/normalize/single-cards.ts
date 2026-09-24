/**
 * Step 6: everything the earlier steps didn't claim — one card per record, dispatched to the player-card or
 * encounter-card builder.
 */
import type { EncounterCardFlipSide } from "../../../src/schema/index.ts";
import type { RawCard } from "../raw-types.ts";
import { imageOf } from "./art.ts";
import {
  abilityRefs,
  baseFields,
  expectNoAttach,
  expectNoPlayerData,
  parse,
  type NormalizeContext,
} from "./context.ts";
import { normalizeEncounterCard } from "./encounter-cards.ts";
import { normalizePlayerCard } from "./player-cards.ts";
import { prepare, type Prepared } from "./prepare.ts";
import type { SeparateDeckMembership } from "./separate-decks.ts";
import { amplifyIconsField, PLAYER_TYPES } from "./values.ts";

export function normalizeSingleCards(
  ctx: NormalizeContext,
  separateDeckOfCode: ReadonlyMap<string, SeparateDeckMembership>,
): void {
  for (const r of ctx.topLevel) {
    if (ctx.handled.has(r.code)) continue;
    // A double-sided side scheme (docs/phase7-wave3.md §1.4): `SideSchemeCard` carries no `flipSide` (unlike
    // `EncounterCardCommon`, which the ordinary flip-side merge below assumes), and nothing flips these during a
    // game — a campaign setup instruction picks the standard or expert face. The Galaxy's Most Wanted's five
    // Campaign Challenge side schemes (16178a/b–16182a/b) print a standard and an expert face with different
    // threat, keywords and text, so each face is emitted as its own `SideSchemeCard` instead.
    if (r.type_code === "side_scheme" && r.linked_card?.type_code === "side_scheme" && r.linked_card.hidden) {
      for (const face of [r, r.linked_card]) {
        const p = prepare(ctx, face);
        const parsed = parse(ctx, p);
        normalizeEncounterCard(
          ctx,
          {
            r: face,
            p,
            parsed,
            set: face.card_set_code ?? face.faction_code,
            common: baseFields(ctx, p, face.code, [face.code]),
            abilities: abilityRefs(ctx, face.code, p.name, parsed.abilities),
          },
          undefined,
          [],
        );
      }
      continue;
    }
    const { flipSide, flipParts } = readFlipSide(ctx, r);
    const p = prepare(ctx, r);
    const parsed = parse(ctx, p);
    const rec = {
      r,
      p,
      parsed,
      set: r.card_set_code ?? r.faction_code,
      common: baseFields(ctx, p, r.code, [r.code]),
      abilities: abilityRefs(ctx, r.code, p.name, parsed.abilities),
    };
    if (PLAYER_TYPES.has(r.type_code))
      normalizePlayerCard(ctx, rec, separateDeckOfCode.get(r.code), flipSide, flipParts);
    else normalizeEncounterCard(ctx, rec, flipSide, flipParts);
  }
}

/**
 * Double-sided encounter cards that flip between two faces of the same card type (docs/phase7-wave1.md §1.4 —
 * Criminal Enterprise ↔ State of Madness). MarvelCDB nests the back face as a hidden linked record of the same
 * type_code; every other linked-card shape on a non-hero/non-main-scheme/non-villain record is an error.
 */
function readFlipSide(
  ctx: NormalizeContext,
  r: RawCard,
): { flipSide: EncounterCardFlipSide | undefined; flipParts: Prepared[] } {
  if (r.linked_card && r.linked_card.type_code === r.type_code && r.linked_card.hidden) {
    const back = r.linked_card;
    const pBack = prepare(ctx, back);
    const parsedBack = parse(ctx, pBack);
    expectNoPlayerData(ctx, pBack, parsedBack);
    expectNoAttach(ctx, pBack, parsedBack);
    const backImage = imageOf(back.imagesrc);
    const flipSide: EncounterCardFlipSide = {
      name: pBack.name,
      ...(back.subname ? { subtitle: back.subname } : {}),
      traits: pBack.traits,
      keywords: parsedBack.keywords,
      text: pBack.text,
      ...(pBack.flavor ? { flavor: pBack.flavor } : {}),
      abilities: abilityRefs(ctx, back.code, pBack.name, parsedBack.abilities),
      ...(backImage ? { image: backImage } : {}),
      ...amplifyIconsField(back),
    };
    ctx.handled.add(back.code);
    return { flipSide, flipParts: [pBack] };
  }
  if (r.linked_card) ctx.errors.push(`${r.code}: unexpected linked card ${r.linked_card.code} on a ${r.type_code}`);
  // docs/phase7-wave4.md §1.2: a double-sided *player* card whose back face MarvelCDB sends inline on the front
  // record (`double_sided: true`, `back_name`, `back_text`, `backimagesrc`) instead of as a nested `linked_card` —
  // Vision's Intangible/Dense (`vision` 26002), the only emitted player card with a `back_text` (checked across
  // every raw pack). Synthesized into the same `Prepared`/`abilityRefs` pipeline as any other back face, under a
  // `<code>b` synthetic code (so curated corrections/errata can target it the same way `back.code` does above).
  if (r.double_sided && r.back_text) {
    const backCode = `${r.code}b`;
    const backRaw: RawCard = {
      ...r,
      code: backCode,
      name: r.back_name ?? r.name,
      real_name: r.back_name ?? r.name,
      subname: undefined,
      text: r.back_text,
      real_text: r.back_text,
      imagesrc: r.backimagesrc ?? null,
      backimagesrc: null,
      linked_card: null,
      double_sided: false,
      back_name: null,
      back_text: null,
    };
    const pBack = prepare(ctx, backRaw);
    const parsedBack = parse(ctx, pBack);
    const backImage = imageOf(backRaw.imagesrc);
    const flipSide: EncounterCardFlipSide = {
      name: pBack.name,
      traits: pBack.traits,
      keywords: parsedBack.keywords,
      text: pBack.text,
      ...(pBack.flavor ? { flavor: pBack.flavor } : {}),
      abilities: abilityRefs(ctx, backCode, pBack.name, parsedBack.abilities),
      ...(backImage ? { image: backImage } : {}),
    };
    return { flipSide, flipParts: [pBack] };
  }
  return { flipSide: undefined, flipParts: [] };
}
