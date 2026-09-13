/** Player cards: ally, event, support, upgrade, resource and player side scheme. */
import type { AllyCard, PlayerSideSchemeCard, PlayRestrictions } from "../../../src/schema/index.ts";
import { traitOf } from "./brand.ts";
import { record, type NormalizeContext, type SingleRecord } from "./context.ts";
import type { SeparateDeckMembership } from "./separate-decks.ts";
import { CORE_ASPECTS, printedStat, resourceIcons, scalingOf } from "./values.ts";

export function normalizePlayerCard(ctx: NormalizeContext, rec: SingleRecord, separateDeck: SeparateDeckMembership | undefined): void {
  const { errors, curation } = ctx;
  const { r, p, parsed, set, common, abilities } = rec;
  let aspect: string;
  if (separateDeck) {
    aspect = `hero:${separateDeck.identityCode}`;
  } else if (r.faction_code === "hero") {
    const hero = ctx.heroBySet.get(r.card_set_code ?? "");
    if (!hero) errors.push(`${r.code}: hero card in set ${String(r.card_set_code)} with no identity`);
    aspect = `hero:${hero?.code ?? "?"}`;
  } else if ((CORE_ASPECTS as readonly string[]).includes(r.faction_code)) {
    aspect = r.faction_code;
  } else {
    errors.push(`${r.code}: unknown faction ${r.faction_code}`);
    aspect = r.faction_code;
  }
  const deckLimit = separateDeck ? 0 : (r.deck_limit ?? 0);
  if (!separateDeck && (!Number.isInteger(deckLimit) || deckLimit < 1)) {
    errors.push(`${r.code}: deck_limit ${String(r.deck_limit)} invalid`);
  }
  if (parsed.maxPerDeckText !== undefined && parsed.maxPerDeckText !== deckLimit) {
    errors.push(`${r.code}: text says Max ${parsed.maxPerDeckText} per deck but deck_limit=${deckLimit}`);
  }
  // Built by mutating a copy of `parsed.restrictions` in place (rather than a fixed field order) so a card
  // with only Phase 2 restriction fields serializes with the same key order it always has — reassigning an
  // existing key preserves its original insertion position; only the two Phase 7 trait fields need branding.
  const restrictions = { ...parsed.restrictions } as unknown as {
    -readonly [K in keyof PlayRestrictions]: PlayRestrictions[K];
  };
  if (parsed.restrictions.requiresIdentityTrait !== undefined) {
    restrictions.requiresIdentityTrait = traitOf(parsed.restrictions.requiresIdentityTrait);
  }
  if (parsed.restrictions.requiresControlledCharacterTrait !== undefined) {
    restrictions.requiresControlledCharacterTrait = traitOf(parsed.restrictions.requiresControlledCharacterTrait);
  }
  if (parsed.attachesToVillainNamed) errors.push(`${r.code}: player card attaches to a villain by name`);
  if (parsed.attachesTo && r.type_code !== "upgrade") errors.push(`${r.code}: attach rule on a ${r.type_code}`);
  const playerCommon = {
    aspect: aspect as AllyCard["aspect"],
    traits: p.traits,
    keywords: parsed.keywords,
    deckLimit,
    ...(Object.keys(restrictions).length > 0 ? { playRestrictions: restrictions } : {}),
    text: p.text,
    ...(p.flavor ? { flavor: p.flavor } : {}),
    abilities,
    ...(separateDeck ? { separateDeck: separateDeck.deckName } : {}),
  };
  const cost = r.cost ?? null;
  const needCost = (): number => {
    if (cost === null) {
      errors.push(`${r.code}: ${r.type_code} without a cost`);
      return 0;
    }
    return cost;
  };
  switch (r.type_code) {
    case "ally": {
      for (const [field, value] of [["attack", r.attack], ["thwart", r.thwart]] as const) {
        if ((value === null || value === undefined) && !curation.cardNotes[r.code]) {
          errors.push(`${r.code}: ally has no ${field} (printed "—"?) — needs a cardNotes entry explaining the data`);
        }
      }
      const ally: AllyCard = {
        ...common,
        type: "ally",
        cost: needCost(),
        resourceIcons: resourceIcons(r),
        // Absent = printed "—" (cannot attack/thwart; Hulk's THW); MarvelCDB -1 = printed "X".
        atk: printedStat(r.attack),
        thw: printedStat(r.thwart),
        hp: r.health ?? 0,
        consequentialDamage: { attack: r.attack_cost ?? 0, thwart: r.thwart_cost ?? 0 },
        ...playerCommon,
      };
      record(ctx, ally, set, [p]);
      break;
    }
    case "event":
      record(ctx, { ...common, type: "event", cost: needCost(), resourceIcons: resourceIcons(r), ...playerCommon }, set, [p]);
      break;
    case "support":
      record(ctx, { ...common, type: "support", cost: needCost(), resourceIcons: resourceIcons(r), ...playerCommon }, set, [p]);
      break;
    case "upgrade":
      record(
        ctx,
        {
          ...common,
          type: "upgrade",
          cost: needCost(),
          resourceIcons: resourceIcons(r),
          ...(parsed.attachesTo ? { attachesTo: parsed.attachesTo } : {}),
          ...playerCommon,
        },
        set,
        [p],
      );
      break;
    case "resource":
      if (cost !== null) errors.push(`${r.code}: resource with a cost`);
      record(ctx, { ...common, type: "resource", producesIcons: resourceIcons(r), ...playerCommon }, set, [p]);
      break;
    case "player_side_scheme": {
      if (r.base_threat === null || r.base_threat === undefined) {
        errors.push(`${r.code}: player side scheme without starting threat`);
      }
      const scheme: PlayerSideSchemeCard = {
        ...common,
        type: "player_side_scheme",
        cost: needCost(),
        resourceIcons: resourceIcons(r),
        startingThreat: scalingOf(r.base_threat ?? 0, !r.base_threat_fixed),
        ...playerCommon,
      };
      record(ctx, scheme, set, [p]);
      break;
    }
  }
}
