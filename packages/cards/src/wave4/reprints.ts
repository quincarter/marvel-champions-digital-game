/**
 * Wave 4 / cycle 3 reprints (docs/phase7-wave4.md), the wave 4 analog of `../wave3/reprints.ts`: several cycle 3
 * cards reprint a Core/wave 1/cycle 1/cycle 2 card verbatim (same printed name AND type). This module finds every
 * such pair programmatically against "every earlier card" and, for pairs whose ability ids carry the same slug and
 * count, aliases the wave 4 id straight to the earlier `AbilityDefinition` — one script, two or more ids.
 *
 * **"Earlier" is `@mc/content`'s own fixed `WAVE1_CARDS` ∪ `WAVE2_CARDS` ∪ `WAVE3_CARDS` (deduped by id, all three
 * already include Core) — every card printed before cycle 3 — not `../wave3/index.js`'s re-export of
 * `PLAYABLE_CARDS`.** `wave3/cards.ts`'s own `WAVE3_CARDS` is deliberately an alias to `PLAYABLE_CARDS`, which now
 * includes cycle 3 itself once this wave's own content pass wired it in (docs/phase7-wave4.md); using it here as
 * "earlier" is wrong in both directions: cycle 3 cards checking against a pool that already contains them would
 * silently skip every wave 4 card (`earlierCardIds.has(card.id)` always true, zero reprint pairs), but the pool
 * this file actually loops over — `@mc/content`'s own fixed `WAVE4_CARDS` (below) — carries wave 1/cycle 1 cards
 * too, and `@mc/content`'s own `WAVE3_CARDS` (Core + cycle 2 only) doesn't cover those, so wave 1/cycle 1's
 * own generic staple cards (Avengers Mansion, The Power of Aggression, Make the Call, ...) fell through the
 * `earlierCardIds` skip and got auto-aliased a second time under their own already-scripted ids, colliding with
 * `WAVE3_ABILITIES` the moment `mergeRegistries` ran (`../wave3/reprints.ts`'s own docblock names the same class
 * of hazard for `PLAYABLE_CARDS` at cycle 2). The three-pool union below is fixed and never grows, so unlike
 * `wave3/reprints.ts` (which unions the two pre-cycle-2 sibling pools) this needs all three pre-cycle-3 ones.
 *
 * **The "later" side is `@mc/content`'s own fixed `WAVE4_CARDS` (imported here as `CONTENT_WAVE4_CARDS`), not
 * `./cards.js`'s re-export of `PLAYABLE_CARDS`.** `./cards.ts`'s own `WAVE4_CARDS` is deliberately an alias to
 * `PLAYABLE_CARDS` (its own docblock), which keeps growing as later waves land (wave 5 widened it to cycle 4,
 * docs/phase7-wave5.md) — iterating that here would scan wave 5's own cards for a (name, type) match against
 * `WAVE1_CARDS`/`WAVE2_CARDS`/`WAVE3_CARDS` too, occasionally finding one (e.g. `sm` 27013 Bait and Switch vs.
 * `scw`'s own card of the same name, or `nova` 28011 Chase Them Down vs. Core's own chain) and aliasing a *wave 5*
 * ability id into `WAVE4_ABILITIES`, which then collides with that pack's own hand-authored definition the moment
 * wave 5 registers it (`mergeRegistries` "defined twice" — this broke exactly that way when wave 5 was wired into
 * `PLAYABLE_CARDS`, the same class of hazard `../wave3/reprints.ts`'s own docblock names for wave 4). `@mc/content`'s
 * `WAVE4_CARDS` is the fixed Core-through-cycle-3 sibling pool (`data/index.ts`'s own docblock) that never grows, so
 * this module only ever sees cycle 3's own cards on the "later" side, exactly as originally intended.
 *
 * **Matched by (name, type), then confirmed by ability shape — never assumed from the name alone.** A mismatched
 * pair (same name/type, different ability shape) is recorded in `WAVE4_REPRINT_PROBLEMS` (pinned by
 * `reprints.test.ts`) and simply isn't aliased, so the card must be scripted by hand in its own pack module.
 *
 * A pack agent should never define an ability id for a card that reprints an earlier one: this module already
 * supplies it, and `mergeRegistries` throws "defined twice" if a pack module also defines it.
 *
 * **A (name, type) match can be a coincidence, not a reprint** — e.g. Nebula's own Gamora ally (`nebu` 22002,
 * Technique-themed) and `drax`'s own Gamora ally card both happen to print exactly one `-response` ability, which
 * satisfies the "same ref count and slug" check below despite being unrelated cards with unrelated effects. A pack
 * whose own module already defines a ref wins outright: `PACK_OWN_ABILITIES` below holds every product's own ability
 * modules, and their refs are never overwritten by a false-positive alias, no matter what `wave4ReprintPairs` finds.
 *
 * The pairs, aliases and problems are built by `reprintAliases` (`../builtin-packs/reprints.ts`); this module adds
 * that pack-own guard on top. `PACK_OWN_ABILITIES` imports each product's ability modules directly, never its
 * `pack.ts`: every `pack.ts` imports `WAVE4_REPRINT_ABILITIES` from here, so that would be an import cycle.
 */
import { WAVE3_ABILITIES } from "../wave3/index.js";
import {
  WAVE1_CARDS,
  WAVE2_CARDS,
  WAVE3_CARDS,
  WAVE4_CARDS as CONTENT_WAVE4_CARDS,
  type AbilityReference,
  type AnyCard,
} from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { reprintAliases } from "../builtin-packs/reprints.js";
import { BEASTY_BOYS } from "./hood/beasty-boys.js";
import { BROTHERS_GRIMM } from "./hood/brothers-grimm.js";
import { CROSSFIRE_CREW } from "./hood/crossfire-crew.js";
import { HOOD } from "./hood/hood.js";
import { MISTER_HYDE_SET } from "./hood/mister-hyde.js";
import { RANSACKED_ARMORY } from "./hood/ransacked-armory.js";
import { SINISTER_SYNDICATE } from "./hood/sinister-syndicate.js";
import { STANDARD_EXPERT_II } from "./hood/standard-expert-ii.js";
import { STATE_OF_EMERGENCY } from "./hood/state-of-emergency.js";
import { STREETS_OF_MAYHEM } from "./hood/streets-of-mayhem.js";
import { WRECKING_CREW } from "./hood/wrecking-crew.js";
import { ADAM_WARLOCK_KIT } from "./mts/adam-warlock-kit.js";
import { ADAM_WARLOCK_OBLIGATION_NEMESIS } from "./mts/adam-warlock-obligation-nemesis.js";
import { ADAM_WARLOCK_PACK_CARDS } from "./mts/adam-warlock-pack-cards.js";
import { CHILDREN_OF_THANOS } from "./mts/children-of-thanos.js";
import { EBONY_MAW } from "./mts/ebony-maw.js";
import { ENCHANTRESS } from "./mts/enchantress.js";
import { FROST_GIANTS } from "./mts/frost-giants.js";
import { HELA } from "./mts/hela.js";
import { INFINITY_GAUNTLET } from "./mts/infinity-gauntlet.js";
import { LEGIONS_OF_HEL } from "./mts/legions-of-hel.js";
import { LOKI } from "./mts/loki.js";
import { MTS_CAMPAIGN_CARDS } from "./mts/mts-campaign-cards.js";
import { SPECTRUM_KIT } from "./mts/spectrum-kit.js";
import { SPECTRUM_OBLIGATION_NEMESIS } from "./mts/spectrum-obligation-nemesis.js";
import { SPECTRUM_PACK_CARDS } from "./mts/spectrum-pack-cards.js";
import { THANOS } from "./mts/thanos.js";
import { TOWER_DEFENSE } from "./mts/tower-defense.js";
import { NEBULA_KIT } from "./nebu/nebula-kit.js";
import { NEBULA_OBLIGATION_NEMESIS } from "./nebu/nebula-obligation-nemesis.js";
import { NEBULA_PACK_CARDS } from "./nebu/nebula-pack-cards.js";
import { VALKYRIE_KIT } from "./valk/valkyrie-kit.js";
import { VALKYRIE_OBLIGATION_NEMESIS } from "./valk/valkyrie-obligation-nemesis.js";
import { VALKYRIE_PACK_CARDS } from "./valk/valkyrie-pack-cards.js";
import { VISION_KIT } from "./vision/vision-kit.js";
import { VISION_OBLIGATION_NEMESIS } from "./vision/vision-obligation-nemesis.js";
import { VISION_PACK_CARDS } from "./vision/vision-pack-cards.js";
import { WAR_MACHINE_KIT } from "./warm/war-machine-kit.js";
import { WAR_MACHINE_OBLIGATION_NEMESIS } from "./warm/war-machine-obligation-nemesis.js";
import { WAR_MACHINE_PACK_CARDS } from "./warm/war-machine-pack-cards.js";

/**
 * Every wave 4 pack's own hand-authored scripts — each product's ability modules, as its `pack.ts` lists them —
 * checked before any auto-alias below is allowed to claim a ref. Add the modules of this wave's next product here.
 */
const PACK_OWN_ABILITIES: AbilityRegistry = {
  ...NEBULA_KIT,
  ...NEBULA_OBLIGATION_NEMESIS,
  ...NEBULA_PACK_CARDS,
  ...WAR_MACHINE_KIT,
  ...WAR_MACHINE_OBLIGATION_NEMESIS,
  ...WAR_MACHINE_PACK_CARDS,
  ...VISION_KIT,
  ...VISION_OBLIGATION_NEMESIS,
  ...VISION_PACK_CARDS,
  ...SPECTRUM_KIT,
  ...SPECTRUM_PACK_CARDS,
  ...SPECTRUM_OBLIGATION_NEMESIS,
  ...ADAM_WARLOCK_KIT,
  ...ADAM_WARLOCK_PACK_CARDS,
  ...ADAM_WARLOCK_OBLIGATION_NEMESIS,
  ...EBONY_MAW,
  ...TOWER_DEFENSE,
  ...THANOS,
  ...INFINITY_GAUNTLET,
  ...CHILDREN_OF_THANOS,
  ...HELA,
  ...LEGIONS_OF_HEL,
  ...FROST_GIANTS,
  ...ENCHANTRESS,
  ...LOKI,
  ...MTS_CAMPAIGN_CARDS,
  ...VALKYRIE_KIT,
  ...VALKYRIE_OBLIGATION_NEMESIS,
  ...VALKYRIE_PACK_CARDS,
  ...HOOD,
  ...BEASTY_BOYS,
  ...BROTHERS_GRIMM,
  ...CROSSFIRE_CREW,
  ...MISTER_HYDE_SET,
  ...STATE_OF_EMERGENCY,
  ...STREETS_OF_MAYHEM,
  ...RANSACKED_ARMORY,
  ...SINISTER_SYNDICATE,
  ...WRECKING_CREW,
  ...STANDARD_EXPERT_II,
};

/** Ability refs in print order, as `reprintAliases` reads them: every identity face, every villain stage, every main
 * scheme side, or the flat list (a flip side's refs are not part of the match). */
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

/** Every card printed before cycle 3: `WAVE1_CARDS` ∪ `WAVE2_CARDS` ∪ `WAVE3_CARDS`, deduped by id (all three
 * already include Core). */
const EARLIER_CARDS: readonly AnyCard[] = (() => {
  const byId = new Map<string, AnyCard>();
  for (const c of [...WAVE1_CARDS, ...WAVE2_CARDS, ...WAVE3_CARDS]) byId.set(c.id as string, c);
  return [...byId.values()];
})();

const NOT_IN_EARLIER = "is not in the wave 3 pool's abilities";

const built = reprintAliases(CONTENT_WAVE4_CARDS, EARLIER_CARDS, WAVE3_ABILITIES, {
  earlierAbilities: "the wave 3 pool's abilities",
});

/**
 * The cards a pack's own module already scripts (module docblock's "coincidence, not a reprint" note). A pack's own
 * ref always wins over an auto-alias, for the whole pair: none of the card's refs is aliased, rather than aliasing
 * some and leaving its own definitions in place for others, which would silently mix a real reprint's script with a
 * look-alike's. Its count and slug problems still stand; a missing earlier script is no problem for it, since that
 * check only decides an alias.
 */
const packOwnedCards: ReadonlyMap<string, readonly string[]> = new Map(
  built.pairs
    .map(({ card }) => [card.id as string, abilityRefsOf(card).map((ref) => ref.id)] as const)
    .filter(([, refs]) => refs.some((id) => id in PACK_OWN_ABILITIES)),
);
const packOwnedRefs = new Set([...packOwnedCards.values()].flat());

/** Every (wave 4 card, matched earlier card) pair by (name, type), whether or not it ends up aliased. */
export function wave4ReprintPairs(): ReadonlyArray<{ readonly wave4: AnyCard; readonly earlier: AnyCard }> {
  return built.pairs.map(({ card, earlier }) => ({ wave4: card, earlier }));
}

/**
 * Every (wave 4 card, earlier match) pair `reprintAliases` (`../builtin-packs/reprints.ts`) could not auto-alias —
 * must be scripted by hand in its own pack module. Pinned by `reprints.test.ts`.
 */
export const WAVE4_REPRINT_PROBLEMS: readonly string[] = built.problems.filter(
  (problem) => !(problem.includes(NOT_IN_EARLIER) && packOwnedCards.has(problem.slice(0, problem.indexOf(" ")))),
);

/**
 * Every wave 4 ability id that reprints an earlier ability, aliased to that ability's own `AbilityDefinition`
 * object. Merged into `WAVE4_ABILITIES` ahead of every pack's own registry (`./index.ts`).
 */
export const WAVE4_REPRINT_ABILITIES: AbilityRegistry = Object.fromEntries(
  Object.entries(built.registry).filter(([id]) => !packOwnedRefs.has(id)),
);
