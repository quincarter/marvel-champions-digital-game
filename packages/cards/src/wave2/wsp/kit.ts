import { trait } from "@mc/content";
import {
  action,
  anAttackableEnemy,
  attack,
  cards,
  changeToOtherHeroForm,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  defineAbilities,
  divide,
  draw,
  exhaustThis,
  gainsKeyword,
  gainsTrait,
  gets,
  heal,
  heroAction,
  interrupt,
  ifThen,
  moveCards,
  on,
  oncePerRound,
  preventDamage,
  query,
  ready,
  removeThreat,
  heroResponse,
  when,
  yourIdentity,
  you,
  youHaveTrait,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";

const GIANT = trait("GIANT");
const TINY = trait("TINY");
const AERIAL = trait("AERIAL");

/**
 * Wasp / Nadia Van Dyne (13001a/b/c, a three-sided identity — Tiny hero, alter-ego, Giant hero) and her hero kit
 * (13002–13010, 13020). Modeled directly on Ant-Man's own kit (`wave2/ant/kit.ts`): the same three-sided-identity
 * primitives (docs/phase7-wave2.md §1.1/§3.2), "if you are in [Giant/Tiny] hero form" read as `youHaveTrait`.
 *
 * **§3.7's divided-power primitives (landed) cover Wasp's own Giant-form text and every divided event** (Giant
 * Help, Wasp Sting): `RuleSpec divideBasicPower` for the identity's own basic THW/ATK, `EffectSpec divide` for an
 * event's own printed "a total of N … divided among …".
 *
 * **Skipped (missing engine primitive — see docs/phase7-wave2-scripting.md):**
 * - `13001a.small-but-mighty` — "Response: After Wasp (**or an event you play**) defeats a minion or side scheme,
 *   deal 1 damage to the villain." `on.defeated({ byYou: true })` matches `characterDefeated`/`schemeDefeated`'s own
 *   `defeatedByPlayerId`, which is set for *any* player-controlled source of the defeating damage — an ally's own
 *   attack included. The printed text deliberately narrows to "Wasp (or an event)", excluding allies, and nothing
 *   reads *which card* (as opposed to which player) caused a defeat, so there is no way to exclude an ally-caused
 *   defeat without also silently accepting it. Closest existing primitive: the `overkill.sourceInstanceId` field
 *   `characterDefeated` already carries for its own overkill case — a general `sourceInstanceId` on the same event
 *   (whatever dealt the defeating damage, character or event) would let this be read directly.
 * - `13002.ant-man-constant` / `13002.ant-man-constant-2` — "While you are in Giant/Tiny hero form, Ant-Man gains
 *   the Giant/Tiny trait and gets +1 ATK/THW." The identical poisoned shape Yellowjacket (12027, `ant/obligation-
 *   nemesis.ts` §6.15) has: a constant *trait grant* whose own `while` is `hasTrait(...)`, which crashes
 *   `traitsOf`'s unguarded recursive trait-grant scan the instant it is evaluated for *anything* — a found-by-
 *   precedent engine bug (not re-tested here; the crash is unconditional and already confirmed once). Not
 *   scripted, to avoid re-introducing a known crash.
 * - `13005.rapid-growth-interrupt` — "Hero Interrupt: When you use one of your hero's basic powers (THW, ATK, or
 *   DEF), change to your Giant hero form and get +2 to that power for this use." Changing to Giant hero form is
 *   `changeToHeroFormWithTrait(GIANT)`, but "+2 to that power for this use" needs a bonus scoped to exactly the
 *   basic-power activation currently resolving, for *any* of the four basic powers. `LastingUntil.endOfAttack`
 *   (the closest existing "just this activation" scope) is keyed to `currentActivationFrameId`
 *   (`packages/engine/src/stack.ts`), which only recognizes `attack`/`enemyAttack`/`enemyScheme`/`thwart` event
 *   frames — a basic *defense* or *recover* use pushes no frame kind that scope recognizes, so a `DEF` use of this
 *   card could not be scoped correctly even though the printed text explicitly includes DEF. Closest existing
 *   primitive: `enemyAttack`/`enemyScheme`'s own inline `atkBonus` (a bonus scoped to exactly the activation an
 *   *effect* initiates) — there is no equivalent for a basic power a *player command* initiates, which an
 *   interrupt would need to hook into before the amount is computed.
 * - `13008.red-room-training-constant-2` — "While you are in Tiny hero form, your basic attacks gain piercing."
 *   `RuleSpec attackKeywords`'s `via` field (docs/phase7-wave2.md §3.13.1) can *exclude* a basic attack (a rule
 *   with `via` set never matches one, since a basic attack's own `viaId` is always null), but there is no way to
 *   require the opposite — match *only* a basic attack, excluding an event-sourced one — so "your basic attacks"
 *   cannot be scripted without also over-granting piercing to the player's own event attacks. Closest existing
 *   primitive: `via`'s own null-exclusion, generalized to a `basicOnly: true` field (or a sentinel `via` value
 *   meaning "no via at all").
 */
export const WASP_KIT = defineAbilities({
  // Small but Mighty (13001a.small-but-mighty) is SKIPPED — module docblock.

  // G.I.R.L. — Action: Shuffle up to 2 cards with a printed [mental] resource from your discard pile into your
  // deck. (Limit once per round.)
  "13001b.girl": action(
    { limit: oncePerRound },
    chooseCards("mental", zone("discard", you, { filter: { printedResource: "mental" } }), { min: 0, max: 2 }),
    moveCards(cards(chosen("mental")), "deckShuffle"),
  ),

  // Wasp (Giant face, 13001c) — [star] Threat removed by your basic thwart power can be divided among schemes as
  // you choose. [star] Damage dealt by your basic attack power can be divided among enemies as you choose
  // (docs/phase7-wave2.md §3.7, FAQ "Wasp (#1C)").
  "13001c.wasp-constant": constant({ rules: [{ kind: "divideBasicPower", power: "thwart", target: YOUR_IDENTITY }] }),
  "13001c.wasp-constant-2": constant({ rules: [{ kind: "divideBasicPower", power: "attack", target: YOUR_IDENTITY }] }),

  // Ant-Man (13002, ally) — both constants SKIPPED — module docblock (the found-by-testing `traitsOf` recursion
  // crash, §6.15 in `ant/obligation-nemesis.ts`).

  // Giant Help — Hero Action (thwart): Remove 3 threat from a scheme (remove a total of 4 threat divided among
  // schemes as you choose instead if you are in Giant hero form).
  "13003.giant-help-action": heroAction(
    { label: "thwart" },
    ifThen(
      youHaveTrait(GIANT),
      divide("threat", 4, query("scheme"), { chooser: you }),
      [chooseTarget("scheme", query("scheme")), removeThreat(3, chosen("scheme"))],
    ),
  ),

  // Pinpoint Strike — Hero Action (attack): Deal 7 damage to an enemy. If you are in Tiny hero form, this attack
  // deals 1 additional damage to that enemy and gains overkill.
  "13004.pinpoint-strike-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    ifThen(youHaveTrait(TINY), attack(8, chosen("enemy"), { overkill: true }), attack(7, chosen("enemy"))),
  ),

  // Rapid Growth (13005.rapid-growth-interrupt) is SKIPPED — module docblock.

  // Wasp Sting — two Hero Actions (attack), each gated to one hero form (the form check precedes the effect, as
  // Ant-Man's own form-gated actions do): if Giant, deal a total of 4 damage divided among enemies you choose; if
  // Tiny, deal 5 damage to an enemy.
  "13006.wasp-sting-action": heroAction({ label: "attack", while: youHaveTrait(GIANT) }, divide("damage", 4, query("enemy"), { chooser: you })),
  "13006.wasp-sting-hero-action": heroAction({ label: "attack", while: youHaveTrait(TINY) }, chooseTarget("enemy", query("enemy")), attack(5, chosen("enemy"))),

  // Pym Particles (resource) — Hero Response: after you spend this card, heal 2 damage from your hero if you are
  // in Giant hero form, or draw 1 card if you are in Tiny hero form. Same shape as Ant-Man's own Pym Particles
  // (12006, `ant/kit.ts`) — "Hero Response" already gates to hero form, so the else branch is exactly Tiny.
  "13007.pym-particles-response": heroResponse(on.youSpendThis(), ifThen(youHaveTrait(GIANT), heal(2, yourIdentity), draw(1))),

  // Red Room Training — While you are in Giant hero form, you gain retaliate 1. (The Tiny-form piercing half,
  // `13008.red-room-training-constant-2`, is SKIPPED — module docblock.)
  "13008.red-room-training-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY, { while: youHaveTrait(GIANT) })),

  // Bio-Synthetic Wings — Wasp gains the Aerial trait (unconditional — safe: `traitsOf`'s poisoned scan only
  // recurses on a *conditional* `while: hasTrait(...)` trait grant, and this one has no `while` at all).
  // Interrupt: When you would take any amount of damage, if you are in Tiny hero form, exhaust Bio-Synthetic Wings
  // → prevent 1 of that damage.
  "13009.bio-synthetic-wings-constant": constant(gainsTrait(AERIAL, YOUR_IDENTITY)),
  "13009.bio-synthetic-wings-interrupt": interrupt(when.damage("host"), { cost: exhaustThis, while: youHaveTrait(TINY) }, preventDamage(1)),

  // Wasp's Helmet — While you are in Giant hero form, you get +1 THW. While you are in Tiny hero form, you get +1
  // ATK. Pure stat modifiers (no trait grant) — safe under the same reasoning as Bio-Synthetic Wings above.
  "13010.wasps-helmet-constant": constant(gets("thw", 1, YOUR_IDENTITY, { while: youHaveTrait(GIANT) })),
  "13010.wasps-helmet-constant-2": constant(gets("atk", 1, YOUR_IDENTITY, { while: youHaveTrait(TINY) })),

  // Swarm Tactics — Team-Up (Ant-Man and Wasp), Max 1 per deck (data). Hero Action: change to your other hero
  // form. Ready your hero. Wasp's own printing of the identical card Ant-Man's own set prints as 12020
  // (`ant/kit.ts`) — a real RRG "Copy" (same printed text, different collector number per pack), not aliased by
  // `reprints.ts` (which only matches wave2-against-wave1/Core, not wave2-against-wave2).
  "13020.swarm-tactics-action": heroAction(changeToOtherHeroForm(), ready(yourIdentity)),
});
