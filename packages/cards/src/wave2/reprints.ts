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
import { WAVE1_CARDS, WAVE2_CARDS, type AnyCard } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import { reprintAliases } from "../builtin-packs/reprints.js";
import { WAVE1_ABILITIES } from "../wave1/index.js";

const built = reprintAliases(WAVE2_CARDS, WAVE1_CARDS, WAVE1_ABILITIES, { earlierAbilities: "WAVE1_ABILITIES" });

/** Every (wave 2 card, matched wave 1/Core card) pair by (name, type), whether or not it ends up aliased. */
export function wave2ReprintPairs(): ReadonlyArray<{ readonly wave2: AnyCard; readonly wave1: AnyCard }> {
  return built.pairs.map(({ card, earlier }) => ({ wave2: card, wave1: earlier }));
}

/**
 * Every (wave 2 card, wave 1/Core match) pair `reprintAliases` (`../builtin-packs/reprints.ts`) could not auto-alias —
 * a same-name, same-type card whose ability shape actually differs (the "Hawkeye" ally collision above), so it must be
 * scripted by hand in its own pack module. Pinned by `reprints.test.ts` so a future data change that fixes (or breaks)
 * an alias is caught rather than silently changing which cards need hand scripts.
 */
export const WAVE2_REPRINT_PROBLEMS: readonly string[] = built.problems;

/**
 * Every wave 2 ability id that reprints a wave 1/Core ability, aliased to that ability's own `AbilityDefinition`
 * object. Merged into `WAVE2_ABILITIES` ahead of every pack's own registry (`./index.ts`).
 */
export const WAVE2_REPRINT_ABILITIES: AbilityRegistry = built.registry;
