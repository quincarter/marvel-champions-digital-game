import { trait } from "@mc/content";
import {
  blanksTextBox,
  constant,
  coveredByEngineRule,
  defineAbilities,
  forcedResponse,
  on,
  query,
  removeCountersFrom,
  self,
} from "../../dsl/index.js";

const TECH = trait("TECH");

/**
 * Care for Cassie (12025), Ant-Man's obligation, and his nemesis set: Tech Theft (12026), Yellowjacket (12027),
 * Size Increase (12028), Yellowjacket's Plan (12029).
 *
 * **Skipped (missing engine primitive — see docs/phase7-wave2-scripting.md):**
 * - `12025.obligation` — "Choose and discard 1 card from your hand. **You cannot change form until your next turn
 *   ends.** Discard this obligation." is otherwise the Core obligation shape (`core/obligations.ts`'s `obligation`
 *   helper handles "give to X, may flip, exhaust-to-remove-or-alternative" already), but the bolded restriction has
 *   no primitive: `RuleSpec cannotChangeForm` is a *standing* constant rule (`while: Predicate`), and there is no
 *   lasting-effect kind for "cannot change form" the way `LastingEffectBody`'s `statModifier`/`traitGrant`/
 *   `costReduction`/`blankTextBox` exist for other standing changes with a clock on them. "Until your next turn
 *   ends" also isn't one of `LastingUntil`'s three values. Closest existing primitive: `LastingEffectBody`'s own
 *   shape, needing a `cannotChangeForm`-kind sibling.
 * - `12027.yellowjacket-constant` / `12027.yellowjacket-constant-2` — "While you are in Giant/Tiny hero form,
 *   Yellowjacket gains the Giant/Tiny trait and retaliate 1 / +1 ATK." **Found by testing (docs/phase7-wave2-
 *   scripting.md §4.1's rule): scripted once with `gainsTrait`/`gets(..., { while: hasTrait(identityOf(
 *   engagedPlayerOf(self)), GIANT) })`, which typechecked and looked exactly like The Viper's own "while engaged
 *   with you" constant (`04054.the-viper-constant`, `trors/spider-woman-obligation-nemesis.ts`) — but it is a
 *   different shape (The Viper's target itself is `query("identity", { controlledBy: engagedPlayerOf(self) })`; a
 *   *query*, never routed through `traitsOf`) and it crashes the engine the instant it is ever evaluated: a**
 *   `RangeError: Maximum call stack size exceeded` **in `traitsOf` (`packages/engine/src/select.ts`, its trait-
 *   grant scan around lines 145–173), confirmed with a real reveal-from-encounter-deck test before being pulled
 *   (`kit.test.ts` no longer exercises it) rather than shipped subtly wrong (or, here, catastrophically wrong).**
 *   **Root cause:** `traitsOf(state, id)` loops over every card in play and evaluates every constant `traitGrant`'s
 *   `while` predicate *unconditionally*, before checking whether the grant's `target` even matches `id`. A
 *   `while: hasTrait(ref, trait)` predicate calls `evaluate`'s `"hasTrait"` case, which calls `traitsOf(state,
 *   refId)` — a full, unrestricted re-entry into the very function currently running, with no memoization and no
 *   scope-narrowing. Because the predicate never depends on the outer call's `id`, the re-entrant call hits the
 *   exact same ability's `while` again, unconditionally, every time — an unconditional infinite recursion, not a
 *   deep-but-finite one, so no board size or player count avoids it. **This is not specific to this card**: any
 *   constant `gainsTrait`/`gets`/`gainsKeyword` rule anywhere whose `while` needs `hasTrait`/`traitsOf` on any
 *   card would hit the same crash the moment `traitsOf` (or `statBonus`, which also routes through it once a
 *   `while` predicate needs a trait check) is called for *anything*, not only this card's own target — confirmed
 *   by the ATK modifier (`12027.yellowjacket-constant-2`'s `gets("atk", …)`) crashing the same way via
 *   `modifiersFor` → `evaluate` → `traitsOf`. **Closest existing primitive/fix:** `blankedByConstantRules`
 *   (`select.ts`, right above `traitsOf`) already solved the identical class of problem for `blankTextBox` by
 *   evaluating a rule's own `target`/`while` under `DEFAULT_DEPS` (printed characteristics only) specifically "so
 *   matching cannot re-enter this function" (its own docblock) — `traitsOf`'s trait-grant scan has no equivalent
 *   guard and needs the same treatment (or a recursion-depth/visited-set guard) before this shape of ability is
 *   safe to script. Flagged for `game-rules-architect` rather than reworked into a differently-shaped ability: the
 *   printed text is "gains the Giant trait" (a trait grant, not a form check to hardcode a bespoke reading around).
 * - `12029.when-revealed` — "discard cards from the encounter deck until a card from the **Ant-Man Nemesis set**
 *   is discarded" needs a `TargetQuery` matching "belongs to encounter set X" — no field does (only `categories`/
 *   `trait`/`name`/etc., none of which name a card's `encounterSetIds` membership).
 */
export const ANT_MAN_OBLIGATION_NEMESIS = defineAbilities({
  // Tech Theft — Treat the printed text box of each Tech player card as if it were blank.
  "12026.tech-theft-constant": constant(blanksTextBox({ trait: TECH, categories: ["ally", "upgrade", "support"] })),

  // Yellowjacket's two form-conditional constants (12027.yellowjacket-constant, 12027.yellowjacket-constant-2) are
  // SKIPPED — see the module docblock above: they crash the engine (`traitsOf` infinite recursion), not merely a
  // missing vocabulary word.

  // Size Increase — Attach to Yellowjacket, if able. Otherwise, attach to the villain (data, `AttachmentHost.
  // ifAble`). Uses (3 counters) (data). The data carries a second ("-constant") ref for the "Uses" reminder with no
  // separate text of its own — the same parser-artifact shape as other "-constant" refs beside data-only lines
  // elsewhere in wave 2.
  "12028.size-increase-constant": coveredByEngineRule(),
  // [star] Forced Response: after attached enemy activates (attacks or schemes), remove 1 size counter from here.
  "12028.size-increase-forced-response": forcedResponse(on.enemySchemesOrAttacks("host"), removeCountersFrom(self, "size", 1)),

  // Yellowjacket's Plan — When Revealed: discard cards from the encounter deck until a card from the Ant-Man
  // Nemesis set is discarded this way. Reveal that card. SKIPPED (missing primitive — module docblock addendum
  // below): no `TargetQuery` field matches "belongs to encounter set X" (only `categories`/`trait`/`name`/etc.,
  // none of which name a card's `encounterSetIds` membership) — `discardEncounterUntil`'s own `filter` has nothing
  // to search for. Closest existing primitive: `TargetQuery.trait`, the same shape an `encounterSetId?:
  // EncounterSetId` field would need.
});
