import { trait } from "@mc/content";
import {
  action,
  anAttackableEnemy,
  anEnemy,
  atEndOfPhase,
  attachCard,
  attack,
  attacksGainKeywords,
  chooseCards,
  choosePlayer,
  chosen,
  chosenPlayer,
  confuse,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  discardFromHandCost,
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
  interrupt,
  modifyAttack,
  modifyStat,
  moveCards,
  playableAttachments,
  query,
  ready,
  resource,
  returnToHandCost,
  self,
  shuffleDeck,
  spend,
  stun,
  theVillain,
  thwart,
  totalPrintedResources,
  when,
  you,
  YOUR_HERO,
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
 * `04002.hawkeyes-bow-constant`, `04004.mockingbird-interrupt`, `04008.cable-arrow-action`,
 * `04009.vibranium-arrow-action` and `04011.hawkeye-action` were all pinned in `KNOWN_SKIPPED` pending engine
 * primitives that have since landed (docs/phase7-wave2.md §3): `RuleSpec attackKeywords`/`attack(...).keywords` for
 * the two attack-keyword grants, `modifyAttack.preventAllDamage` for Mockingbird, `EffectSpec.thwart.ignoreCrisis`
 * for Cable Arrow, and `totalPrintedResources` for Kate Bishop's Hawkeye.
 */
export const HAWKEYE_KIT = defineAbilities({
  // "Quick Draw" — Action: Exhaust Hawkeye → ready Hawkeye's bow.
  "04001a.quick-draw": action({ cost: exhaustThis }, ready({ kind: "named", name: BOW_NAME })),

  // Hawkeye's Bow — Restricted (data). Your hero gets +1 ATK and each of your Arrow attacks gain ranged. `via`
  // matches the Arrow-trait event whose own ability makes the attack (Sonic/Electric/Vibranium Arrow) — the card
  // `sourceInstanceId` names for a played event's attack (`applyPlayerAttack`, engine/src/resolve/event.ts) —
  // rather than `attacker`, since the attacker is always Hawkeye's identity, not the bow.
  "04002.hawkeyes-bow-constant": constant(
    gets("atk", 1, YOUR_HERO),
    attacksGainKeywords(["ranged"], { via: query("event", { trait: ARROW, controller: "you" }) }),
  ),

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
  // return Mockingbird to your hand → prevent all damage from this attack. `returnToHandCost` with a self-matching
  // query returns Mockingbird herself (the same "return this card" shape a cost paid with in-play cards already
  // has); `modifyAttack.preventAllDamage` rides the attack's own frame from initiation to its eventual damage step.
  "04004.mockingbird-interrupt": interrupt(
    when.villainAttacks({ againstYou: true }),
    { cost: [spend(1), returnToHandCost(query("ally", { self: true }))] },
    modifyAttack({ preventAllDamage: true }),
  ),

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

  // Cable Arrow — Hero Action (thwart): Exhaust Hawkeye's Bow → remove 3 threat from a scheme, ignoring any crisis
  // icons in play.
  "04008.cable-arrow-action": heroAction(
    { label: "thwart", cost: exhaustCardsCost(BOW) },
    { kind: "chooseTarget", slot: "scheme", query: query("scheme"), chooser: you },
    thwart(3, chosen("scheme"), { ignoreCrisis: true }),
  ),

  // Vibranium Arrow — Hero Action (attack): Exhaust Hawkeye's Bow → deal 6 damage to an enemy. This attack gains
  // piercing. A played event's own one-shot attack: `attack(...).keywords` (not a persistent `constant` rule).
  "04009.vibranium-arrow-action": heroAction(
    { label: "attack", cost: exhaustCardsCost(BOW) },
    anAttackableEnemy(),
    attack(6, chosen("enemy"), { keywords: ["piercing"] }),
  ),

  // Hawkeye (Kate Bishop) — Action: Exhaust this ally and discard 1 card from your hand → deal X damage to an
  // enemy, where X is the number of printed resources on that card. `discardFromHandCost` binds the discarded
  // card(s) to the fixed slot "discard"; `totalPrintedResources` reads it wherever it now is.
  "04011.hawkeye-action": action(
    { cost: [exhaustThis, discardFromHandCost(1, 1)] },
    anEnemy(),
    dealDamage(totalPrintedResources(chosen("discard")), chosen("enemy")),
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
