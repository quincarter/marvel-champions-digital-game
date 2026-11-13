/**
 * The reprint alias layer every wave builds (`wave<N>/reprints.ts`), once: a later card that reprints an earlier one
 * (same printed name AND type) gets the earlier card's scripts under its own ability ids, one script for both.
 *
 * **Matched by (name, type), then confirmed by ability shape, never assumed from the name alone.** Name alone would
 * alias different cards (`Hulk` is an identity in `hlk` and an ally in Core; FFG's Jan 26, 2026 ruling 4 (#7) in
 * docs/rulings/marvel-champions-rulings-post-rrg-1-7.md confirms the hero and the ally are different cards). A pair
 * whose ability refs differ in count or slug, or whose earlier script is missing, is a problem, not an alias: the
 * card is scripted by hand in its own product, and each wave pins its problems (or refuses any, wave 1).
 */
import type { AbilityReference, AnyCard } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";

/** Ability refs in print order: every identity face, every villain stage, every main scheme side, or the flat list. */
function abilityRefsOf(card: AnyCard): readonly AbilityReference[] {
  switch (card.type) {
    case "hero_identity":
      return [
        ...card.hero.abilities,
        ...card.alterEgo.abilities,
        ...(card.additionalHeroForms ?? []).flatMap((face) => face.abilities),
      ];
    case "villain":
      return card.sides.flatMap((side) => side.stages.flatMap((stage) => stage.abilities));
    case "main_scheme":
      return card.stages.flatMap((stage) => [...stage.aSide.abilities, ...stage.abilities]);
    default:
      return "abilities" in card ? card.abilities : [];
  }
}

const reprintKey = (card: AnyCard): string => `${card.name} ${card.type}`;
const slugOf = (ref: AbilityReference): string => ref.id.slice(ref.id.indexOf(".") + 1);

/** One later card and the earlier card it reprints. */
export interface ReprintPair {
  readonly card: AnyCard;
  readonly earlier: AnyCard;
}

/** A wave's reprint layer: its pairs, the aliases built from them, and the pairs that could not be aliased. */
export interface ReprintAliases {
  readonly pairs: readonly ReprintPair[];
  readonly registry: AbilityRegistry;
  readonly problems: readonly string[];
}

/** How a wave names its pieces in a problem's text. */
export interface ReprintWording {
  /** The earlier registry's name, as a problem names it: "WAVE1_ABILITIES", "Core/wave 1/cycle 1's abilities". */
  readonly earlierAbilities: string;
}

/**
 * The reprint aliases of `later` against `earlier`: every later card (not itself an earlier card) whose (name, type)
 * matches an earlier card, aliased ref by ref to `earlierAbilities` when the refs agree in count and slug.
 */
export function reprintAliases(
  later: readonly AnyCard[],
  earlier: readonly AnyCard[],
  earlierAbilities: AbilityRegistry,
  wording: ReprintWording,
): ReprintAliases {
  const earlierIds = new Set(earlier.map((card) => card.id as string));
  const earlierByKey = new Map(earlier.map((card) => [reprintKey(card), card]));
  const pairs: ReprintPair[] = [];
  for (const card of later) {
    if (earlierIds.has(card.id as string)) continue; // an earlier card itself, not a reprint of one
    const match = earlierByKey.get(reprintKey(card));
    if (match) pairs.push({ card, earlier: match });
  }

  const registry: Record<string, AbilityDefinition> = {};
  const problems: string[] = [];
  for (const { card, earlier: match } of pairs) {
    const refs = abilityRefsOf(card);
    const matchRefs = abilityRefsOf(match);
    if (refs.length !== matchRefs.length) {
      problems.push(
        `${card.id} (${card.name}) matches ${match.id} by name/type but has ${refs.length} ability ref(s) against ${matchRefs.length} — not auto-aliased, script by hand`,
      );
      continue;
    }
    const differing = refs.flatMap((ref, i) => (slugOf(ref) === slugOf(matchRefs[i]!) ? [] : [i]));
    for (const i of differing) {
      problems.push(
        `${card.id} (${card.name}) matches ${match.id} by name/type but ability #${i} slugs differ (${refs[i]!.id} vs ${matchRefs[i]!.id}) — not auto-aliased, script by hand`,
      );
    }
    if (differing.length > 0) continue;
    refs.forEach((ref, i) => {
      const matchRef = matchRefs[i]!;
      const definition = earlierAbilities[matchRef.id];
      if (!definition) {
        problems.push(
          `${card.id} (${card.name}) matches ${match.id}, but ${matchRef.id} is not in ${wording.earlierAbilities} — not auto-aliased, script by hand`,
        );
        return;
      }
      registry[ref.id] = definition;
    });
  }
  return { pairs, registry, problems };
}
