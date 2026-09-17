import {
  action,
  after,
  allowUnlabeledAttack,
  alterEgoAction,
  attackAnEnemy,
  cancelRevealedCard,
  cards,
  chooseCards,
  chosen,
  confuse,
  constant,
  costModifier,
  countOf,
  damageAnEnemy,
  dealDamage,
  defineAbilities,
  discardThis,
  draw,
  eventTarget,
  exhaustThis,
  gets,
  heroAction,
  heroInterrupt,
  heroResponse,
  moveCards,
  partOf,
  query,
  ready,
  resource,
  response,
  scaled,
  stun,
  thwartAScheme,
  theVillain,
  varOf,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { cancelBoostIcons, generatesFor, onAbilityResolvedOf, onCardPlayed, PREPARATION, PREPARATION_CARD, youReveal } from "./local.js";

/**
 * Black Widow / Natasha Romanoff (08001a/b) and her signature hero kit (08002–08010, printed `aspect:
 * "hero:08001a"`). Widowmaker (08001a) and Synth-Suit's (08009) Response are scripted to their current, errata'd
 * text ("resolve", not "trigger" — RRG 1.8 p. 66 / ruling Feb 28, 2026 (2), docs/phase7-wave1.md §1.12), via the
 * `abilityResolved` trigger event (`./local.js`'s `onAbilityResolvedOf`).
 */
export const BKW_KIT = defineAbilities({
  // "Widowmaker" — Response: After you resolve the ability of a Preparation card you control, deal 1 damage to an
  // enemy. Errata'd text (see module doc comment); printed text read "trigger" instead of "resolve".
  "08001a.widowmaker": response(onAbilityResolvedOf(PREPARATION_CARD), damageAnEnemy(1)),

  // Mission Prep — Response: After you play a Preparation card, draw 1 card. (Limit once per phase.)
  "08001b.mission-prep": response(onCardPlayed(PREPARATION_CARD), { limit: { count: 1, period: "phase" } }, draw(1)),

  // Winter Soldier — Reduce the cost to play Winter Soldier by 1 for each Preparation card you control. RRG 1.8
  // "In Play and Out of Play" (p. 23): a cost reduction that reads the card's own printed cost applies from hand
  // (`activeIn: "hand"`), the same shape as Hercules'/Winter Soldier's own "for each minion engaged with you" cost
  // reduction (docs/phase7-wave1.md §3.10, `packages/engine/src/play-restrictions.test.ts`).
  "08002.winter-soldier-constant": constant(
    costModifier({
      delta: scaled(countOf(query("upgrade", { trait: PREPARATION, controller: "you" })), { times: -1 }),
      appliesTo: { self: true },
      activeIn: "hand",
    }),
  ),

  // Covert Ops — Action (thwart): Remove 4 threat from a scheme. Confuse the villain.
  "08003.covert-ops-action": action({ label: "thwart" }, thwartAScheme(4), confuse(theVillain)),

  // Dance of Death — Hero Action: Make the following 3 attacks in order: deal 1/2/3 damage to an enemy (chosen
  // separately for each). No "(attack)" label is printed; FAQ "Dance of Death (#4)" (RRG 1.8 p. 59) rules its
  // first sentence "defines each damage-dealing effect … as an individual attack" anyway, so a stun only cancels
  // the first (`packages/engine/src/resolve/apply-effect.ts`'s "attack" case, docs/phase7-wave1.md's write-up).
  "08004.dance-of-death-action": allowUnlabeledAttack(
    heroAction(attackAnEnemy(1, { slot: "enemy1" }), attackAnEnemy(2, { slot: "enemy2" }), attackAnEnemy(3, { slot: "enemy3" })),
    { citation: 'FAQ "Dance of Death (#4)" (RRG 1.8 p. 59): each damage-dealing effect is an individual attack; a stun cancels only the first.' },
  ),
  // The card prints 4 ability refs for one printed ability (an ingestion artifact splitting the 3 bulleted
  // attacks — the same shape as Hulk's (01050) Forced Response bullets, `dsl/abilities.ts`'s `partOf` doc comment).
  "08004.dance-of-death-constant": partOf("08004.dance-of-death-action"),
  "08004.dance-of-death-constant-2": partOf("08004.dance-of-death-action"),
  "08004.dance-of-death-constant-3": partOf("08004.dance-of-death-action"),

  // Safe House #29 — Alter-Ego Action: Exhaust Safe House #29 and choose a Preparation card in your discard pile →
  // add that card to your hand. Only exhausting is a real cost (RRG "Cost", something spent); the choice names
  // which card the effect after "→" moves, so it's modeled as a selection effect (same reading as Agent Coulson's
  // and For Asgard!'s deck/discard searches).
  "08005.safe-house-29-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("found", zone("discard", you, { filter: PREPARATION_CARD }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
  ),

  // Attacrobatics — Hero Interrupt (attack): When a boost card is turned faceup, discard Attacrobatics → cancel
  // the boost icons on that card. Deal 1 damage to the villain for each boost icon canceled this way.
  "08006.attacrobatics-interrupt": heroInterrupt(
    { on: "boostCardTurnedFaceup", eventAtLeast: { boostIcons: 1 } },
    { label: "attack", cost: discardThis },
    cancelBoostIcons("cancelled"),
    dealDamage(varOf("cancelled.amount"), theVillain),
  ),

  // Black Widow's Gauntlet — Resource: Exhaust Black Widow's Gauntlet → generate a [wild] resource for a
  // Preparation card. `generatesFor` (`./local.js`): `AbilityDefinition.generatesFor` is landed, named for this
  // exact card (docs/phase7-wave1.md §3.10), with no `dsl/abilities.ts` `resource()` option yet.
  "08007.black-widows-gauntlet-resource": generatesFor(resource({ wild: 1 }, { cost: exhaustThis }), PREPARATION_CARD),

  // Grappling Hook — Hero Interrupt: When you reveal a treachery, discard Grappling Hook → cancel the effects of
  // that treachery and discard it.
  "08008.grappling-hook-interrupt": heroInterrupt(youReveal(query("treachery")), { cost: discardThis }, cancelRevealedCard()),

  // Synth-Suit — Black Widow gets +1 DEF.
  "08009.synth-suit-constant": constant(gets("def", 1, YOUR_IDENTITY)),
  // Synth-Suit — Hero Response: After you resolve the ability of a Preparation card you control, exhaust
  // Synth-Suit → ready Black Widow. Errata'd text (module doc comment); printed text read "trigger".
  "08009.synth-suit-response": heroResponse(onAbilityResolvedOf(PREPARATION_CARD), { cost: exhaustThis }, ready(yourIdentity)),

  // Widow's Bite — Hero Response (attack): After a minion enters play, discard Widow's Bite → deal 2 damage to
  // that minion and stun it.
  "08010.widows-bite-response": heroResponse(after.entersPlay(query("minion")), { label: "attack", cost: discardThis }, dealDamage(2, eventTarget), stun(eventTarget)),
});
