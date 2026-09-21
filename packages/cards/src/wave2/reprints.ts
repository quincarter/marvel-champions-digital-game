/**
 * Wave 2 / cycle 1 reprints (PLAN.md Phase 7 / docs/phase7-wave2.md / docs/phase7-wave2-scripting.md).
 *
 * Several cycle 1 cards reprint a Core or wave 1 card verbatim — same printed name AND type (Combat Training,
 * Heroic Intuition, Interrogation Room, Tac Team, The Power of Leadership, Avengers Tower, …). This module is the
 * cycle 1 analog of `../wave1/reprints.ts`: it finds every such pair programmatically against the whole wave 1
 * pool (`WAVE1_CARDS`, which already includes Core), and for pairs whose ability ids carry the same slug and
 * count, aliases the wave 2 id straight to the wave 1 (or Core) `AbilityDefinition` — one script, two (or three)
 * ids.
 *
 * **Matched by (name, type), then confirmed by ability shape — never assumed from the name alone.** Unlike wave 1
 * (docs/phase7-wave1-scripting.md "Reprints"), cycle 1 has at least one *same name, same type, different card*
 * collision: the Hawkeye ally "Hawkeye" (04011, Kate Bishop, a `leadership` card with her own action ability) has
 * the same (name, type) as the "Hawkeye" ally aliased from Core through the `cap` pack (Clint Barton, 03012 /
 * 01015). A hard "throw on any mismatch" policy (wave 1's) would make that an unrecoverable build error for the
 * whole pack; instead a mismatched pair is recorded in `WAVE2_REPRINT_PROBLEMS` (pinned by `reprints.test.ts`) and
 * simply isn't aliased, so the card must be (and is) scripted by hand in its own pack module — exactly like a
 * genuinely new card.
 *
 * A pack agent should never define an ability id for a card that reprints a wave 1/Core one: this module already
 * supplies it, and `mergeRegistries` throws "defined twice" if a pack module also defines it.
 */
import { WAVE1_CARDS, WAVE2_CARDS, type AbilityReference, type AnyCard } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry } from "@mc/engine";
import { WAVE1_ABILITIES } from "../wave1/index.js";

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

const wave1CardIds = new Set(WAVE1_CARDS.map((c) => c.id as string));
const wave1ByReprintKey = new Map<string, AnyCard>(WAVE1_CARDS.map((c) => [reprintKey(c), c]));

/** Every (wave 2 card, matched wave 1/Core card) pair by (name, type), whether or not it ends up aliased. */
export function wave2ReprintPairs(): ReadonlyArray<{ readonly wave2: AnyCard; readonly wave1: AnyCard }> {
  const pairs: { wave2: AnyCard; wave1: AnyCard }[] = [];
  for (const card of WAVE2_CARDS) {
    if (wave1CardIds.has(card.id as string)) continue; // Core/wave 1 itself (WAVE2_CARDS includes Core)
    const match = wave1ByReprintKey.get(reprintKey(card));
    if (match) pairs.push({ wave2: card, wave1: match });
  }
  return pairs;
}

function buildReprintAbilities(): { readonly registry: AbilityRegistry; readonly problems: readonly string[] } {
  const registry: Record<string, AbilityDefinition> = {};
  const problems: string[] = [];
  for (const { wave2: card, wave1: match } of wave2ReprintPairs()) {
    const wRefs = abilityRefsOf(card);
    const mRefs = abilityRefsOf(match);
    if (wRefs.length !== mRefs.length) {
      problems.push(
        `${card.id} (${card.name}) matches ${match.id} by name/type but has ${wRefs.length} ability ref(s) against ${mRefs.length} — not auto-aliased, script by hand`,
      );
      continue;
    }
    if (wRefs.length === 0) continue; // nothing to alias either way (e.g. two "Energy" resource cards)
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
      const definition = WAVE1_ABILITIES[mRef.id];
      if (!definition) {
        problems.push(
          `${card.id} (${card.name}) matches ${match.id}, but ${mRef.id} is not in WAVE1_ABILITIES — not auto-aliased, script by hand`,
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
 * Every (wave 2 card, wave 1/Core match) pair `buildReprintAbilities` could not auto-alias — a same-name,
 * same-type card whose ability shape actually differs (the "Hawkeye" ally collision above), so it must be
 * scripted by hand in its own pack module. Pinned by `reprints.test.ts` so a future data change that fixes (or
 * breaks) an alias is caught rather than silently changing which cards need hand scripts.
 */
export const WAVE2_REPRINT_PROBLEMS: readonly string[] = built.problems;

/**
 * Every wave 2 ability id that reprints a wave 1/Core ability, aliased to that ability's own `AbilityDefinition`
 * object. Merged into `WAVE2_ABILITIES` ahead of every pack's own registry (`./index.ts`).
 */
export const WAVE2_REPRINT_ABILITIES: AbilityRegistry = built.registry;
