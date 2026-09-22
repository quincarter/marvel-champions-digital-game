/**
 * Wave 3 / cycle 2 reprints (PLAN.md Phase 7 / docs/phase7-wave3.md / docs/phase7-wave3-scripting.md).
 *
 * Several cycle 2 cards reprint a Core, wave 1 or cycle 1 card verbatim (same printed name AND type). This module
 * is the cycle 2 analog of `../wave2/reprints.ts`: it finds every such pair programmatically against
 * `PLAYABLE_CARDS` (Core + every wave 1 pack + every cycle 1 pack — `WAVE1_CARDS`/`WAVE2_CARDS` are *siblings*,
 * not nested, `./cards.ts`'s own docblock), and for pairs whose ability ids carry the same slug and count,
 * aliases the wave 3 id straight to the earlier `AbilityDefinition` — one script, two or more ids.
 *
 * **Matched by (name, type), then confirmed by ability shape — never assumed from the name alone.** A mismatched
 * pair (same name/type, different ability shape) is recorded in `WAVE3_REPRINT_PROBLEMS` (pinned by
 * `reprints.test.ts`) and simply isn't aliased, so the card must be scripted by hand in its own pack module.
 *
 * A pack agent should never define an ability id for a card that reprints an earlier one: this module already
 * supplies it, and `mergeRegistries` throws "defined twice" if a pack module also defines it.
 */
import { PLAYABLE_CARDS, type AbilityReference, type AnyCard } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import { WAVE1_ABILITIES } from "../wave1/index.js";
import { WAVE2_ABILITIES } from "../wave2/index.js";
import { WAVE3_CARDS } from "./cards.js";

/**
 * Every earlier ability definition, by id: Core + wave 1 + cycle 1. `WAVE1_ABILITIES` and `WAVE2_ABILITIES` both
 * carry `CORE_ABILITIES`' own ids with the same definition objects (both are built from `CORE_ABILITIES` plus
 * their own pack scripts), so a plain object spread (last write wins on the identical Core entries, no new ids
 * collide) is correct here — `mergeRegistries`' throw-on-duplicate guard is for genuinely new ids within one
 * wave, not for two sibling waves that deliberately overlap on Core.
 */
const EARLIER_ABILITIES: AbilityRegistry = { ...WAVE1_ABILITIES, ...WAVE2_ABILITIES };

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

const earlierCardIds = new Set(PLAYABLE_CARDS.map((c) => c.id as string));
const earlierByReprintKey = new Map<string, AnyCard>(PLAYABLE_CARDS.map((c) => [reprintKey(c), c]));

/** Every (wave 3 card, matched earlier card) pair by (name, type), whether or not it ends up aliased. */
export function wave3ReprintPairs(): ReadonlyArray<{ readonly wave3: AnyCard; readonly wave2: AnyCard }> {
  const pairs: { wave3: AnyCard; wave2: AnyCard }[] = [];
  for (const card of WAVE3_CARDS) {
    if (earlierCardIds.has(card.id as string)) continue; // Core/wave 1/cycle 1 itself (WAVE3_CARDS includes them)
    const match = earlierByReprintKey.get(reprintKey(card));
    if (match) pairs.push({ wave3: card, wave2: match });
  }
  return pairs;
}

function buildReprintAbilities(): { readonly registry: AbilityRegistry; readonly problems: readonly string[] } {
  const registry: Record<string, AbilityDefinition> = {};
  const problems: string[] = [];
  for (const { wave3: card, wave2: match } of wave3ReprintPairs()) {
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
    wRefs.forEach((wRef, i) => {
      const mRef = mRefs[i]!;
      const definition = EARLIER_ABILITIES[mRef.id];
      if (!definition) {
        problems.push(
          `${card.id} (${card.name}) matches ${match.id}, but ${mRef.id} is not in Core/wave 1/cycle 1's abilities — not auto-aliased, script by hand`,
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
 * Every (wave 3 card, wave 2/earlier match) pair `buildReprintAbilities` could not auto-alias — must be scripted
 * by hand in its own pack module. Pinned by `reprints.test.ts`.
 */
export const WAVE3_REPRINT_PROBLEMS: readonly string[] = built.problems;

/**
 * Every wave 3 ability id that reprints a wave 2/earlier ability, aliased to that ability's own `AbilityDefinition`
 * object. Merged into `WAVE3_ABILITIES` ahead of every pack's own registry (`./index.ts`).
 */
export const WAVE3_REPRINT_ABILITIES: AbilityRegistry = built.registry;
