/** Player cards: ally, event, support, upgrade, resource and player side scheme. */
import type {
  AllyCard,
  CardFlipSide,
  CoreAspect,
  PlayerSideSchemeCard,
  PlayRestrictions,
  SpecialCost,
  SpecificSet,
} from "../../../src/schema/index.ts";
import { brand, traitOf } from "./brand.ts";
import { record, type NormalizeContext, type SingleRecord } from "./context.ts";
import type { Prepared } from "./prepare.ts";
import type { SeparateDeckMembership } from "./separate-decks.ts";
import { CORE_ASPECTS, printedStat, resourceIcons, scalingOf } from "./values.ts";

/** Aspects a `printedAspect` may name (validation.ts `CHOOSABLE_PRINTED_ASPECTS`) — narrower than `CORE_ASPECTS`, which also has "basic". */
const PRINTABLE_ASPECTS: readonly CoreAspect[] = ["aggression", "justice", "leadership", "protection", "pool"];

export function normalizePlayerCard(
  ctx: NormalizeContext,
  rec: SingleRecord,
  separateDeck: SeparateDeckMembership | undefined,
  // Wave 2: a double-sided player card of one card type (the Hydra Campaign "Basic"/"Improved" upgrades,
  // `PlayerCardCommon.flipSide`) — the same shape and the same `readFlipSide` detection as an encounter card's,
  // just consumed here too now instead of only by `normalizeEncounterCard`.
  flipSide?: CardFlipSide,
  flipParts: readonly Prepared[] = [],
): void {
  const { errors, curation } = ctx;
  const { r, p, parsed, set, common, abilities } = rec;
  let aspect: string;
  let specificTo: SpecificSet | undefined;
  let printedAspect: CoreAspect | undefined;
  if (separateDeck) {
    aspect = `hero:${separateDeck.identityCode}`;
  } else if (r.faction_code === "hero") {
    const hero = ctx.heroBySet.get(r.card_set_code ?? "");
    if (!hero) errors.push(`${r.code}: hero card in set ${String(r.card_set_code)} with no identity`);
    aspect = `hero:${hero?.code ?? "?"}`;
  } else if (
    r.card_set_code &&
    ctx.heroBySet.has(r.card_set_code) &&
    PRINTABLE_ASPECTS.includes(r.faction_code as CoreAspect)
  ) {
    // Wave 2 (docs/phase7-wave2.md §1.2): an identity-specific card that also prints an aspect icon — Spider-Woman's
    // Venom Blast (Aggression), Pheromones (Leadership), Contaminant Immunity (Protection) and Inconspicuous
    // (Justice), MarvelCDB giving each the aspect's `faction_code` with `card_set_code` set to her identity's own.
    // Deckbuilding treats these as identity-specific (RRG 1.8 "Identity-Specific Card", p. 23), so `aspect` stays
    // `hero:<identity>`; `printedAspect` is what card effects read ("an aspect card", "a Leadership card").
    const hero = ctx.heroBySet.get(r.card_set_code);
    aspect = `hero:${hero?.code ?? "?"}`;
    printedAspect = r.faction_code as CoreAspect;
  } else if (r.faction_code === "basic" && r.card_set_type_name_code === "leader" && r.card_set_code) {
    // Wave 2 (docs/phase7-wave2.md §6.3): a leader's own basic player cards (The Futurist and friends), "used only
    // when playing in competitive mode" (Civil War rulebook, PDF p. 3) — `faction_code: "basic"` inside a set whose
    // `card_set_type_name_code` is "leader", distinct from the ordinary Basic set's plain basic cards.
    aspect = "basic";
    specificTo = { kind: "competitive", encounterSetId: brand("encounterSet", r.card_set_code) };
  } else if ((CORE_ASPECTS as readonly string[]).includes(r.faction_code)) {
    aspect = r.faction_code;
  } else if (r.faction_code === "encounter" && r.card_set_code) {
    // Wave 2: a player card with no identity, aspect or "Basic" classification at all — its only classification
    // is the scenario's encounter set it belongs to (RRG 1.8 "Classifications", p. 12, "scenario-specific"). The
    // Rise of Red Skull's four Taskmaster Captive allies (Moon Knight, Shang-Chi, White Tiger, Elektra) are
    // MarvelCDB `type_code: "ally", faction_code: "encounter"` for exactly this reason.
    aspect = "none";
    specificTo = { kind: "scenario", encounterSetId: brand("encounterSet", r.card_set_code) };
  } else if (r.faction_code === "campaign" && r.card_set_code) {
    // Wave 2: printed "Campaign / Basic" (RRG 1.8 "Campaign-Specific Card", p. 11) — The Rise of Red Skull's
    // Hydra Campaign upgrades (04155–04162).
    aspect = "basic";
    specificTo = { kind: "campaign", encounterSetId: brand("encounterSet", r.card_set_code) };
  } else {
    errors.push(`${r.code}: unknown faction ${r.faction_code}`);
    aspect = r.faction_code;
  }
  // A scenario- or campaign-specific card doesn't always print a real `deck_limit` (MarvelCDB sends none for some
  // products' campaign cards — Galaxy's Most Wanted's "the_market" set has cost but no deck_limit at all — and
  // never for a scenario prop such as Taskmaster's Captive allies): `validateDeck` gates these on `specificTo`'s
  // classification, not on this count (docs/phase7-wave2.md §1.4). A missing deck_limit on a *unique* card
  // defaults to 1 rather than 0 — the schema's own `validateCard` requires a positive `deckLimit` on every player
  // card regardless of `specificTo` (unlike this file's earlier, looser ingestion-only check), and RRG's
  // uniqueness rule caps a unique card at one copy in any deck regardless of why it's unique, so 1 is the
  // correct value, not a workaround (docs/phase7-wave2.md §5.1: "deckLimit: 1 (they are unique; campaign mode
  // may add them to decks)" — originally observed only on unique scenario/campaign cards, but the same reasoning
  // holds for any unique card missing `deck_limit`: Hercules' Gift Deck, 59005–59007, `is_unique: true` with no
  // `specificTo` at all, hits the identical gap as a plain identity-specific hero-kit card).
  // wave3 §5 (`the_market`, `gmw`): now *observed* — 28 non-unique cards (Unit Cost items bought individually from
  // The Market during a campaign, MC16 p. 5, never part of ordinary deckbuilding at all) print no `deck_limit`
  // either, each at MarvelCDB `quantity: 1`. `validateCard` still requires a positive integer regardless of
  // `specificTo`, so the same "1, not a fabricated count" default now applies whether or not the card is unique:
  // `exemptFromDeckLimit` already skips the deck-limit *shape* check below for every `specificTo` card (unique or
  // not), so this only supplies a schema-legal placeholder, never a claim about how many copies a real deck may
  // hold. A *present* deck_limit (the Hydra Campaign upgrades print 1) is still read and kept either way.
  // A card with the Linked keyword (RRG 1.8 p. 27: "Cards with the linked keyword cannot be included in a
  // player's deck") never prints a `deck_limit` either — MarvelCDB's Redemption (51036, `bp`) has none. It is
  // refused from deckbuilding by `validateDeck`'s own `linked_card` check regardless of this number (PLAN.md
  // Phase 7, "Aug 3, 2026, ruling 4"), so `deckLimit` here is a formality to satisfy `validateCard`'s "must be a
  // positive integer" — defaulted to 1 the same way a unique card is, for the same reason.
  const isLinked = parsed.keywords.some((k) => k.name === "linked");
  const exemptFromDeckLimit = Boolean(separateDeck) || isLinked || (specificTo !== undefined && !r.is_unique);
  const deckLimit = separateDeck ? 0 : (r.deck_limit ?? (isLinked || r.is_unique || specificTo !== undefined ? 1 : 0));
  if (!exemptFromDeckLimit && (!Number.isInteger(deckLimit) || deckLimit < 1)) {
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
  // MC16 p. 5's "Unit Cost X." (docs/phase7-wave3.md §1; `PlayerCardCommon.unitCost`): a campaign-specific card's
  // own printed price, read straight off its printed text rather than added to `parseRestriction`'s sentence
  // classifier, since it is card data (what the campaign spends against), not a play restriction. Only ever seen
  // leading the printed text of a `the_market` card (`gmw` 16150–16177), one per card.
  const unitCostMatch = /^Unit Cost (\d+)\./.exec(p.text.printed);
  const unitCost = unitCostMatch ? Number(unitCostMatch[1]) : undefined;
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
    ...(flipSide ? { flipSide } : {}),
    ...(specificTo ? { specificTo } : {}),
    ...(unitCost !== undefined ? { unitCost } : {}),
    ...(printedAspect ? { printedAspect } : {}),
  };
  const cost = r.cost ?? null;
  // `p.specialCost` is "X" whenever MarvelCDB's own `cost: -1` says so (automatic), or "dash" when a curated
  // `Correction.specialCost` confirms a printed dash from the card image (docs/phase7-wave2.md §1.3) — either
  // way `cost` itself is held at 0 (`CostedCard.specialCost`'s doc comment).
  const needCost = (): { cost: number; specialCost?: SpecialCost } => {
    if (p.specialCost) return { cost: 0, specialCost: p.specialCost };
    if (cost === null) {
      errors.push(`${r.code}: ${r.type_code} without a cost`);
      return { cost: 0 };
    }
    return { cost };
  };
  switch (r.type_code) {
    case "ally": {
      for (const [field, value] of [
        ["attack", r.attack],
        ["thwart", r.thwart],
      ] as const) {
        if ((value === null || value === undefined) && !curation.cardNotes[r.code]) {
          errors.push(`${r.code}: ally has no ${field} (printed "—"?) — needs a cardNotes entry explaining the data`);
        }
      }
      const ally: AllyCard = {
        ...common,
        type: "ally",
        ...needCost(),
        resourceIcons: resourceIcons(r),
        // Absent = printed "—" (cannot attack/thwart; Hulk's THW); MarvelCDB -1 = printed "X".
        atk: printedStat(r.attack),
        thw: printedStat(r.thwart),
        hp: r.health ?? 0,
        consequentialDamage: { attack: r.attack_cost ?? 0, thwart: r.thwart_cost ?? 0 },
        ...playerCommon,
      };
      record(ctx, ally, set, [p, ...flipParts]);
      break;
    }
    case "event":
      record(ctx, { ...common, type: "event", ...needCost(), resourceIcons: resourceIcons(r), ...playerCommon }, set, [
        p,
        ...flipParts,
      ]);
      break;
    case "support":
      record(
        ctx,
        { ...common, type: "support", ...needCost(), resourceIcons: resourceIcons(r), ...playerCommon },
        set,
        [p, ...flipParts],
      );
      break;
    case "upgrade":
      record(
        ctx,
        {
          ...common,
          type: "upgrade",
          ...needCost(),
          resourceIcons: resourceIcons(r),
          ...(parsed.attachesTo ? { attachesTo: parsed.attachesTo } : {}),
          ...playerCommon,
        },
        set,
        [p, ...flipParts],
      );
      break;
    case "resource":
      if (cost !== null) errors.push(`${r.code}: resource with a cost`);
      record(ctx, { ...common, type: "resource", producesIcons: resourceIcons(r), ...playerCommon }, set, [
        p,
        ...flipParts,
      ]);
      break;
    case "player_side_scheme": {
      if (r.base_threat === null || r.base_threat === undefined) {
        errors.push(`${r.code}: player side scheme without starting threat`);
      }
      const scheme: PlayerSideSchemeCard = {
        ...common,
        type: "player_side_scheme",
        ...needCost(),
        resourceIcons: resourceIcons(r),
        startingThreat: scalingOf(r.base_threat ?? 0, !r.base_threat_fixed),
        ...playerCommon,
      };
      record(ctx, scheme, set, [p, ...flipParts]);
      break;
    }
  }
}
