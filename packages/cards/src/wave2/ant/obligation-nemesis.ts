import { trait } from "@mc/content";
import {
  blanksTextBox,
  cannotChangeFormUntil,
  chosen,
  constant,
  coveredByEngineRule,
  defineAbilities,
  discardEncounterUntil,
  discardFromHand,
  encounterSetOf,
  engagedPlayerOf,
  forcedResponse,
  gainsKeyword,
  gainsTrait,
  gets,
  hasTrait,
  identityOf,
  on,
  query,
  removeCountersFrom,
  revealCard,
  self,
  whenRevealed,
} from "../../dsl/index.js";
import { obligation } from "../../core/obligations.js";

const TECH = trait("TECH");
const GIANT = trait("GIANT");
const TINY = trait("TINY");

/**
 * Care for Cassie (12025), Ant-Man's obligation, and his nemesis set: Tech Theft (12026), Yellowjacket (12027),
 * Size Increase (12028), Yellowjacket's Plan (12029).
 *
 * **`12025.obligation` is now scripted** (docs/phase7-wave2.md §22/§23): "Choose and discard 1 card from your
 * hand. **You cannot change form until your next turn ends.** Discard this obligation." is the Core obligation
 * shape (`core/obligations.ts`'s `obligation` helper: "give to X, may flip, exhaust-to-remove-or-alternative")
 * plus `EffectSpec applyRuleUntil` (`dsl/effects.ts`'s `cannotChangeFormUntil`) for the bolded restriction — a
 * `RuleSpec` that outlives the obligation card discarding itself in the same breath that imposes it, unlike a
 * constant ability's own standing rule. "Until your next turn ends" reads as the turn *after* the current one when
 * created during a player's own turn (never zero-length); both obligations actually resolve in the villain phase,
 * where that reading doesn't matter.
 *
 * **Un-skipped this pass (docs/phase7-wave2.md §17.5, landed 2026-09-19):**
 * - `12027.yellowjacket-constant` / `12027.yellowjacket-constant-2` — "While you are in Giant/Tiny hero form,
 *   Yellowjacket gains the Giant/Tiny trait and retaliate 1 / +1 ATK." Scripted exactly as first attempted (see
 *   docs/phase7-wave2-scripting.md §6.15's own "Scripted once as…" quote) — `gainsTrait`/`gainsKeyword`/`gets(...,
 *   { while: hasTrait(identityOf(engagedPlayerOf(self)), GIANT/TINY) })` — now safe: `traitsOf`'s constant
 *   trait-grant scan evaluates a grant's own `while`/`target` under `DEFAULT_DEPS` (printed characteristics and
 *   lasting effects only, never another constant ability's own grant), so this `while` reads the engaged player's
 *   identity's *printed* Giant/Tiny trait (the three-sided identity's own additional hero form, §1.1/§3.2) without
 *   re-entering the poisoned scan. Confirmed with a real reveal-from-encounter-deck test reading Yellowjacket's own
 *   live traits and stats, not re-added on the strength of the engine's own fix alone.
 *
 * **`12029.when-revealed` is now scripted** (docs/phase7-wave2.md §20.2/§23): "discard cards from the encounter
 * deck until a card from the **Ant-Man Nemesis set** is discarded" is `TargetQuery.encounterSetOf` (`dsl/values.ts`'s
 * `encounterSetOf(ref)`) — `self` says "the Ant-Man Nemesis set" without naming it, since Yellowjacket's Plan is
 * itself a member of the set it names, the same shape every printed "a card from the <X> set" in cycle 1 uses.
 */
export const ANT_MAN_OBLIGATION_NEMESIS = defineAbilities({
  // Care for Cassie — Give to the Scott Lang player. You may flip to alter-ego form. Choose:
  // • Exhaust Scott Lang → remove Care for Cassie from the game.
  // • Choose and discard 1 card from your hand. You cannot change form until your next turn ends.
  "12025.obligation": obligation("Scott Lang", {
    label: "Choose and discard 1 card from your hand. You cannot change form until your next turn ends",
    effects: [discardFromHand(1), cannotChangeFormUntil("endOfNextTurn")],
  }),

  // Tech Theft — Treat the printed text box of each Tech player card as if it were blank.
  "12026.tech-theft-constant": constant(blanksTextBox({ trait: TECH, categories: ["ally", "upgrade", "support"] })),

  // Yellowjacket — while you (the engaged player) are in Giant/Tiny hero form, Yellowjacket gains the Giant/Tiny
  // trait and retaliate 1 / +1 ATK (module docblock, §17.5).
  "12027.yellowjacket-constant": constant(
    gainsTrait(GIANT, { self: true }, { while: hasTrait(identityOf(engagedPlayerOf(self)), GIANT) }),
    gainsKeyword({ name: "retaliate", value: 1 }, { self: true }, { while: hasTrait(identityOf(engagedPlayerOf(self)), GIANT) }),
  ),
  "12027.yellowjacket-constant-2": constant(
    gainsTrait(TINY, { self: true }, { while: hasTrait(identityOf(engagedPlayerOf(self)), TINY) }),
    gets("atk", 1, { self: true }, { while: hasTrait(identityOf(engagedPlayerOf(self)), TINY) }),
  ),

  // Size Increase — Attach to Yellowjacket, if able. Otherwise, attach to the villain (data, `AttachmentHost.
  // ifAble`). Uses (3 counters) (data). The data carries a second ("-constant") ref for the "Uses" reminder with no
  // separate text of its own — the same parser-artifact shape as other "-constant" refs beside data-only lines
  // elsewhere in wave 2.
  "12028.size-increase-constant": coveredByEngineRule(),
  // [star] Forced Response: after attached enemy activates (attacks or schemes), remove 1 size counter from here.
  "12028.size-increase-forced-response": forcedResponse(on.enemySchemesOrAttacks("host"), removeCountersFrom(self, "size", 1)),

  // Yellowjacket's Plan — When Revealed: discard cards from the encounter deck until a card from the Ant-Man
  // Nemesis set is discarded this way. Reveal that card (module docblock, §20.2).
  "12029.when-revealed": whenRevealed(discardEncounterUntil(encounterSetOf(self), "found"), revealCard(chosen("found"))),
});
