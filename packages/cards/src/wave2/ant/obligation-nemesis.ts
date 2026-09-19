import { trait } from "@mc/content";
import {
  blanksTextBox,
  constant,
  coveredByEngineRule,
  defineAbilities,
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
  self,
} from "../../dsl/index.js";

const GIANT = trait("GIANT");
const TINY = trait("TINY");
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
 * - `12029.when-revealed` — "discard cards from the encounter deck until a card from the **Ant-Man Nemesis set**
 *   is discarded" needs a `TargetQuery` matching "belongs to encounter set X" — no field does (only `categories`/
 *   `trait`/`name`/etc., none of which name a card's `encounterSetIds` membership).
 */
export const ANT_MAN_OBLIGATION_NEMESIS = defineAbilities({
  // Tech Theft — Treat the printed text box of each Tech player card as if it were blank.
  "12026.tech-theft-constant": constant(blanksTextBox({ trait: TECH, categories: ["ally", "upgrade", "support"] })),

  // Yellowjacket — While you are in Giant hero form, Yellowjacket gains the Giant trait and retaliate 1. "You" is
  // the player Yellowjacket is engaged with — the same reading The Viper's own "while engaged with you" constant
  // uses (`04054.the-viper-constant`, `trors/spider-woman-obligation-nemesis.ts`), since a nemesis minion's
  // constant has no controller of its own to resolve "you" against.
  "12027.yellowjacket-constant": constant(
    gainsTrait(GIANT, query("minion", { self: true }), { while: hasTrait(identityOf(engagedPlayerOf(self)), GIANT) }),
    gainsKeyword({ name: "retaliate", value: 1 }, query("minion", { self: true }), { while: hasTrait(identityOf(engagedPlayerOf(self)), GIANT) }),
  ),
  // Yellowjacket — While you are in Tiny hero form, Yellowjacket gains the Tiny trait and gets +1 ATK.
  "12027.yellowjacket-constant-2": constant(
    gainsTrait(TINY, query("minion", { self: true }), { while: hasTrait(identityOf(engagedPlayerOf(self)), TINY) }),
    gets("atk", 1, query("minion", { self: true }), { while: hasTrait(identityOf(engagedPlayerOf(self)), TINY) }),
  ),

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
