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
 * this file actually loops over — `WAVE4_CARDS` (`./cards.js`, also `PLAYABLE_CARDS`) — carries wave 1/cycle 1
 * cards too, and `@mc/content`'s own `WAVE3_CARDS` (Core + cycle 2 only) doesn't cover those, so wave 1/cycle 1's
 * own generic staple cards (Avengers Mansion, The Power of Aggression, Make the Call, ...) fell through the
 * `earlierCardIds` skip and got auto-aliased a second time under their own already-scripted ids, colliding with
 * `WAVE3_ABILITIES` the moment `mergeRegistries` ran (`../wave3/reprints.ts`'s own docblock names the same class
 * of hazard for `PLAYABLE_CARDS` at cycle 2). The three-pool union below is fixed and never grows, so unlike
 * `wave3/reprints.ts` (which unions the two pre-cycle-2 sibling pools) this needs all three pre-cycle-3 ones.
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
 * whose own module already defines a ref wins outright: list that pack's `*_ABILITIES` registry in
 * `PACK_OWN_ABILITIES` below (one line per pack, the same "additive" convention as `../index.ts`) and its refs are
 * never overwritten by a false-positive alias, no matter what `wave4ReprintPairs` finds.
 */
import { WAVE3_ABILITIES } from "../wave3/index.js";
import { WAVE1_CARDS, WAVE2_CARDS, WAVE3_CARDS, type AbilityReference, type AnyCard } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import { WAVE4_CARDS } from "./cards.js";
import { HOOD_ABILITIES } from "./hood/index.js";
import { MTS_ABILITIES } from "./mts/index.js";
import { NEBU_ABILITIES } from "./nebu/index.js";
import { VALK_ABILITIES } from "./valk/index.js";
import { VISION_ABILITIES } from "./vision/index.js";
import { WARM_ABILITIES } from "./warm/index.js";

/**
 * Every wave 4 pack's own hand-authored registry — checked before any auto-alias below is allowed to claim a ref.
 * Add this wave's next pack's `*_ABILITIES` here (one line); nothing else in this file needs to change.
 */
const PACK_OWN_ABILITIES: AbilityRegistry = {
  ...NEBU_ABILITIES,
  ...WARM_ABILITIES,
  ...VISION_ABILITIES,
  ...MTS_ABILITIES,
  ...VALK_ABILITIES,
  ...HOOD_ABILITIES,
};

/** Ability refs in print order: both identity faces (plus any extra hero forms), every villain stage, every main scheme side, or the flat list. */
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

/** Every card printed before cycle 3: `WAVE1_CARDS` ∪ `WAVE2_CARDS` ∪ `WAVE3_CARDS`, deduped by id (all three
 * already include Core). */
const EARLIER_CARDS: readonly AnyCard[] = (() => {
  const byId = new Map<string, AnyCard>();
  for (const c of [...WAVE1_CARDS, ...WAVE2_CARDS, ...WAVE3_CARDS]) byId.set(c.id as string, c);
  return [...byId.values()];
})();

const earlierCardIds = new Set(EARLIER_CARDS.map((c) => c.id as string));
const earlierByReprintKey = new Map<string, AnyCard>(EARLIER_CARDS.map((c) => [reprintKey(c), c]));

/** Every (wave 4 card, matched earlier card) pair by (name, type), whether or not it ends up aliased. */
export function wave4ReprintPairs(): ReadonlyArray<{ readonly wave4: AnyCard; readonly earlier: AnyCard }> {
  const pairs: { wave4: AnyCard; earlier: AnyCard }[] = [];
  for (const card of WAVE4_CARDS) {
    if (earlierCardIds.has(card.id as string)) continue; // Core through cycle 2 itself (WAVE4_CARDS includes them)
    const match = earlierByReprintKey.get(reprintKey(card));
    if (match) pairs.push({ wave4: card, earlier: match });
  }
  return pairs;
}

function buildReprintAbilities(): { readonly registry: AbilityRegistry; readonly problems: readonly string[] } {
  const registry: Record<string, AbilityDefinition> = {};
  const problems: string[] = [];
  for (const { wave4: card, earlier: match } of wave4ReprintPairs()) {
    const wRefs = abilityRefsOf(card);
    const mRefs = abilityRefsOf(match);
    if (wRefs.length !== mRefs.length) {
      problems.push(
        `${card.id} (${card.name}) matches ${match.id} by name/type but has ${wRefs.length} ability ref(s) against ${mRefs.length} — not auto-aliased, script by hand`,
      );
      continue;
    }
    if (wRefs.length === 0) continue;
    let mismatch = false;
    wRefs.forEach((wRef, i) => {
      const mRef = mRefs[i]!;
      const wSlug = wRef.id.slice(wRef.id.indexOf(".") + 1);
      const mSlug = mRef.id.slice(mRef.id.indexOf(".") + 1);
      if (wSlug !== mSlug) {
        problems.push(
          `${card.id} (${card.name}) matches ${match.id} by name/type but ability #${i} slugs differ (${wRef.id} vs ${mRef.id}) — not auto-aliased, script by hand`,
        );
        mismatch = true;
      }
    });
    if (mismatch) continue;
    // A pack's own hand-authored ref always wins over an auto-alias (module docblock's "coincidence, not a
    // reprint" note) — skip the whole pair rather than aliasing some refs and leaving its own definitions in place
    // for others, which would silently mix a real reprint's script with a look-alike's.
    if (wRefs.some((wRef) => wRef.id in PACK_OWN_ABILITIES)) continue;
    wRefs.forEach((wRef, i) => {
      const mRef = mRefs[i]!;
      const definition = WAVE3_ABILITIES[mRef.id];
      if (!definition) {
        problems.push(
          `${card.id} (${card.name}) matches ${match.id}, but ${mRef.id} is not in the wave 3 pool's abilities — not auto-aliased, script by hand`,
        );
        return;
      }
      registry[wRef.id] = definition;
    });
  }
  return { registry, problems };
}

const built = buildReprintAbilities();

/**
 * Every (wave 4 card, earlier match) pair `buildReprintAbilities` could not auto-alias — must be scripted by hand in
 * its own pack module. Pinned by `reprints.test.ts`.
 */
export const WAVE4_REPRINT_PROBLEMS: readonly string[] = built.problems;

/**
 * Every wave 4 ability id that reprints an earlier ability, aliased to that ability's own `AbilityDefinition`
 * object. Merged into `WAVE4_ABILITIES` ahead of every pack's own registry (`./index.ts`).
 */
export const WAVE4_REPRINT_ABILITIES: AbilityRegistry = built.registry;
