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
import { PLAYER_TYPES } from "./values.ts";

export function normalizeSingleCards(
  ctx: NormalizeContext,
  separateDeckOfCode: ReadonlyMap<string, SeparateDeckMembership>,
): void {
  for (const r of ctx.topLevel) {
    if (ctx.handled.has(r.code)) continue;
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
    };
    ctx.handled.add(back.code);
    return { flipSide, flipParts: [pBack] };
  }
  if (r.linked_card) ctx.errors.push(`${r.code}: unexpected linked card ${r.linked_card.code} on a ${r.type_code}`);
  return { flipSide: undefined, flipParts: [] };
}
