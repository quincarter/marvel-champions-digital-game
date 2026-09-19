import { trait } from "@mc/content";
import {
  action,
  anAttackableEnemy,
  atEndOfPhase,
  attachCard,
  attack,
  chooseCards,
  choosePlayer,
  chosen,
  chosenPlayer,
  confuse,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  each,
  exhaust,
  exhaustCardsCost,
  exhaustThis,
  gainsKeyword,
  gainsTrait,
  gets,
  giveTough,
  hasStatus,
  heroAction,
  ifElse,
  modifyStat,
  moveCards,
  playableAttachments,
  query,
  ready,
  resource,
  self,
  shuffleDeck,
  spend,
  stun,
  theVillain,
  you,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const ARROW = trait("ARROW");
const BOW_NAME = cardName("04002");
/** Hawkeye's Bow, as an in-play cost pick — every Hawkeye Arrow event exhausts it. */
const BOW = query("upgrade", { name: BOW_NAME });

/**
 * Hawkeye / Clint Barton (04001a/b) and his hero kit (04002–04022). Reprints in this pack (Lead from the Front
 * 04018, The Power of Leadership 04019, Avengers Tower 04021) are aliased from Core/wave 1 by `../reprints.ts`,
 * not scripted here.
 *
 * **Skipped (missing engine primitive — see docs/phase7-wave2-scripting.md):**
 * - `04002.hawkeyes-bow-constant` — "each of your Arrow attacks gain ranged" needs an effect-level keyword grant
 *   scoped to one played event's own attack, which the engine doesn't have: piercing/ranged are read from the
 *   *attacking character's* own keywords (`resolve/event.ts` `applyDamage`'s `attackKeyword`, off the `dealDamage`
 *   event's `sourceInstanceId`, set to the attacker's own instance for a player attack — never the ability's
 *   card). A persistent character/attachment granting itself or its host the keyword works fine (Black Knight,
 *   below); a played event granting it to only its own one-shot attack does not. Dropping the "ranged" clause
 *   while keeping "+1 ATK" would silently misrepresent the card, so the whole ref is skipped.
 * - `04009.vibranium-arrow-action` — same gap: "this attack gains piercing" on a played event.
 * - `04008.cable-arrow-action` — "remove 3 threat from a scheme, ignoring any crisis icons in play" needs an
 *   `ignoreCrisis`-shaped override on `thwart`/`removeThreat` (today's crisis check in `actions.ts`/`resolve/
 *   event.ts` is unconditional). Closest existing primitive: `dealDamage.ignoreTough`, an inline per-effect
 *   override of a similar shape.
 * - `04011.hawkeye-action` (Kate Bishop) — "deal X damage … where X is the number of printed resources on that
 *   card" needs a `ValueSpec` reading the summed printed resource icons of a specific referenced card; the engine
 *   currently only reports resource pools summed across a *bind* of several moved/discarded cards
 *   (`<bind>.physical`/`.mental`/`.energy`/`.wild` on `moveCards`/`discardEncounterCards`), and a `discardFromHand`
 *   cost's `bind` reports only a card *count*, not its icons.
 * - `04004.mockingbird-interrupt` — "Interrupt: When the villain initiates an attack against you, ... → prevent
 *   all damage from this attack." Confirmed by a scenario test (`hawkeye.test.ts`) that this genuinely doesn't work
 *   with today's `preventDamage`: it fires as an interrupt to the `enemyAttack` event (attack *initiation*, before
 *   a defender is even declared or a `dealDamage` event frame exists), and `preventDamage` (`resolve/apply-effect.ts`
 *   `case "preventDamage"`) only ever adjusts an *already-pushed* `dealDamage` event frame (`frame.eventFrameId`'s
 *   target) — outside one it silently does nothing, unlike Backflip (01003, Core), whose own interrupt is on
 *   `when.damage(...)` specifically so a live `dealDamage` frame exists to prevent. Mockingbird needs a lasting
 *   "this attack's damage is fully prevented, however much it turns out to be" flag that survives from attack
 *   initiation through to the eventual damage step (which happens after `declareDefender` and depends on whether —
 *   and what — defends), not a point-in-time amount subtraction. Closest existing primitive: `RuleSpec
 *   cannotTakeDamage`'s `while` predicate (used elsewhere for a *standing* immunity), which would need a way to
 *   scope `while` to "the attack this interrupt is currently resolving inside," the way `undefendedAttack`
 *   (`Predicate { kind: "currentAttack" }`) already scopes a read to the in-progress attack.
 */
export const HAWKEYE_KIT = defineAbilities({
  // "Quick Draw" — Action: Exhaust Hawkeye → ready Hawkeye's bow.
  "04001a.quick-draw": action({ cost: exhaustThis }, ready({ kind: "named", name: BOW_NAME })),

  // Weapon of Choice — Action: Spend 1 resource of any type → search your deck and discard pile for Hawkeye's Bow
  // and add it to your hand. Shuffle your deck. (Limit once per phase).
  "04001b.weapon-of-choice": action(
    { cost: spend(1), limit: { count: 1, period: "phase" } },
    moveCards(zone(["deck", "discard"], you, { filter: query("upgrade", { name: BOW_NAME }) }), "hand"),
    shuffleDeck(),
  ),

  // Hawkeye's Quiver — You may play Arrow events attached to this card as if they were in your hand.
  // Hero Action: Exhaust Hawkeye's Quiver → search the top 5 cards of your deck for an Arrow event and attach it
  // faceup to this card. FAQ "Hawkeye's Quiver (#3)" (RRG 1.8 p. 60): the entire deck is shuffled after.
  "04003.hawkeyes-quiver-constant": constant(playableAttachments(query("event", { trait: ARROW, host: self }))),
  "04003.hawkeyes-quiver-action": heroAction(
    { cost: exhaustThis },
    chooseCards("found", zone("deck", you, { top: 5, filter: query("event", { trait: ARROW }) }), { min: 0, max: 1 }),
    attachCard(chosen("found"), self),
    shuffleDeck(),
  ),

  // Mockingbird — Interrupt: When the villain initiates an attack against you, spend 1 resource of any type and
  // return Mockingbird to your hand → prevent all damage from this attack.
  // SKIPPED (missing primitive — see module docblock): `preventDamage()` at this timing is a no-op.

  // Sonic Arrow — Hero Action (attack): Exhaust Hawkeye's Bow → confuse an enemy and deal 3 damage to it (5
  // instead if it is already confused). The amount reads "already confused" before this ability's own confuse.
  "04005.sonic-arrow-action": heroAction(
    { label: "attack", cost: exhaustCardsCost(BOW) },
    anAttackableEnemy(),
    attack(ifElse(hasStatus(chosen("enemy"), "confused"), 5, 3), chosen("enemy")),
    confuse(chosen("enemy")),
  ),

  // Explosive Arrow — Hero Action: Exhaust Hawkeye's Bow and choose a player → deal 3 damage to the villain and
  // each minion engaged with that player. Not "(attack)": plain damage, no guard/retaliate.
  "04006.explosive-arrow-action": heroAction(
    { cost: exhaustCardsCost(BOW) },
    choosePlayer("player"),
    dealDamage(3, theVillain),
    dealDamage(3, each(query("minion", { engagedWithPlayer: chosenPlayer("player") }))),
  ),

  // Electric Arrow — Hero Action (attack): Exhaust Hawkeye's Bow → stun an enemy and deal 3 damage to it (5
  // instead if it is already stunned).
  "04007.electric-arrow-action": heroAction(
    { label: "attack", cost: exhaustCardsCost(BOW) },
    anAttackableEnemy(),
    attack(ifElse(hasStatus(chosen("enemy"), "stunned"), 5, 3), chosen("enemy")),
    stun(chosen("enemy")),
  ),

  // Expert Marksman — Resource: Exhaust Expert Marksman → generate a [wild] resource for an Arrow event.
  "04010.expert-marksman-resource": resource({ wild: 1 }, { cost: exhaustThis, generatesFor: query("event", { trait: ARROW }) }),

  // Black Knight (04012) — [star] Black Knight's basic attack gains piercing. A persistent character: piercing is
  // checked against the attacking character's own keywords, so a constant grant on Black Knight himself is exact
  // (he has no other attack ability), unlike a played event's own one-off attack (module docblock).
  "04012.black-knight-constant": constant(gainsKeyword({ name: "piercing" }, query("ally", { self: true }))),

  // Goliath (04013) — Action: Goliath gets +4 ATK until the end of the phase. At the end of the phase, discard
  // Goliath. (Max once per phase.)
  "04013.goliath-action": action({ limit: { count: 1, period: "phase" } }, modifyStat("atk", 4, self, "endOfPhase"), atEndOfPhase(discard(self))),

  // Sky Cycle — Attach to an Avenger ally. Attached ally gains Aerial. Action: Exhaust Sky Cycle → ready attached ally.
  "04015.sky-cycle-constant": constant(gainsTrait(trait("AERIAL"), { hostOfSelf: true })),
  "04015.sky-cycle-action": action({ cost: exhaustThis }, ready({ kind: "host" })),

  // Team Training — Play under any player's control. Each ally you control gets +1 hit point.
  "04016.team-training-constant": constant(gets("hp", 1, query("ally", { controller: "you" }))),

  // Ready for Action — Hero Action: Give an ally you control a tough status card.
  "04017.ready-for-action-action": heroAction(
    { kind: "chooseTarget", slot: "ally", query: query("ally", { controller: "you" }), chooser: you },
    giveTough(chosen("ally")),
  ),

  // Lead from the Front (04018) is a verbatim Core reprint (01070) — aliased by `../reprints.ts`, not scripted here.

  // War Machine (04020) — Toughness (data). [star] War Machine's basic attack gains ranged.
  "04020.war-machine-constant": constant(gainsKeyword({ name: "ranged" }, query("ally", { self: true }))),

  // Earth's Mightiest Heroes — Hero Action: Exhaust an Avenger character you control → ready another Avenger
  // character you control.
  "04022.earths-mightiest-heroes-action": heroAction(
    { kind: "chooseTarget", slot: "exhaust", query: query("character", { controller: "you", trait: trait("AVENGER"), exhausted: false }), chooser: you },
    exhaust(chosen("exhaust")),
    {
      kind: "chooseTarget",
      slot: "ready",
      query: query("character", { controller: "you", trait: trait("AVENGER"), excludeSlots: ["exhaust"] }),
      chooser: you,
    },
    ready(chosen("ready")),
  ),
});
