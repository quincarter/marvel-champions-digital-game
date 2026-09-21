import {
  action,
  alterEgoAction,
  anAttackableEnemy,
  attack,
  attackAnEnemy,
  boost,
  cards,
  chooseCards,
  chooseOne,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  countOf,
  damageThisCardCost,
  dealDamage,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  exhaust,
  exhaustThis,
  exists,
  forEachPlayer,
  gainTraitUntil,
  gets,
  heroAction,
  ifElse,
  ifThen,
  moveCards,
  oncePerRound,
  option,
  perHero,
  placeThreat,
  query,
  ready,
  resource,
  scaled,
  self,
  spend,
  takeDamage,
  thatPlayer,
  thwart,
  thwartAScheme,
  topOfDeck,
  TRAIT,
  undefendedAttack,
  varOf,
  whenRevealed,
  YOUR_IDENTITY,
  yourIdentity,
  youHaveTrait,
  zone,
} from "../../dsl/index.js";
import { obligation } from "../obligations.js";

const aerial = youHaveTrait(TRAIT.AERIAL);

/** Iron Man (01029a/b) and his hero kit (01030–01039). */
export const IRON_MAN_KIT = defineAbilities({
  // You get +1 hand size for each Tech upgrade you control (to a maximum hand size of 7). Printed hand size 1, so at most +6.
  "01029a.iron-man-constant": constant(
    gets("handSize", scaled(countOf(query("upgrade", { controller: "you", trait: TRAIT.TECH })), { max: 6 }), {
      self: true,
    }),
  ),
  // Futurist — Action: Look at the top 3 cards of your deck. Add 1 to your hand and discard the others. (Limit once per round.)
  "01029b.futurist": action(
    { limit: oncePerRound },
    chooseCards("pick", topOfDeck(3), { min: 1, max: 1 }),
    moveCards(cards(chosen("pick")), "hand"),
    moveCards(topOfDeck(2), "discard"),
  ),
  // War Machine — Action: Exhaust War Machine and deal 2 damage to him → deal 1 damage to each enemy.
  "01030.war-machine-action": action(
    { cost: [exhaustThis, damageThisCardCost(2)] },
    dealDamage(1, each(query("enemy"))),
  ),
  // Repulsor Blast — Hero Action (attack): Deal 1 damage to an enemy and discard the top 5 cards of your deck. For each printed
  // [energy] resource discarded this way, deal 2 additional damage to that enemy. (One attack for 1 + 2 per [energy].)
  "01031.repulsor-blast-action": heroAction(
    { label: "attack" },
    anAttackableEnemy(),
    moveCards(topOfDeck(5), "discard", "milled"),
    attack(scaled(varOf("milled.energy"), { times: 2, plus: 1 }), chosen("enemy")),
  ),
  // Supersonic Punch — Hero Action (attack): Deal 4 damage to an enemy (8 damage instead if you have the Aerial trait).
  "01032.supersonic-punch-action": heroAction({ label: "attack" }, attackAnEnemy(ifElse(aerial, 8, 4))),
  // Pepper Potts — Resource: Exhaust Pepper Potts → generate the resources of the top card in your discard pile.
  "01033.pepper-potts-resource": resource({ kind: "topCardOfDiscard" }, { cost: exhaustThis }),
  // Stark Tower — Alter-Ego Action: Exhaust Stark Tower → choose a player. That player returns the topmost Tech upgrade in their discard pile to their hand.
  "01034.stark-tower-action": alterEgoAction(
    { cost: exhaustThis },
    choosePlayer(),
    moveCards(
      zone("discard", chosenPlayer(), { filter: query("upgrade", { trait: TRAIT.TECH }), topmostOnly: true }),
      "hand",
    ),
  ),
  // Arc Reactor — Hero Action: Exhaust Arc Reactor → ready Iron Man.
  "01035.arc-reactor-action": heroAction({ cost: exhaustThis }, ready(yourIdentity)),
  // Mark V Armor — You get +6 hit points.
  "01036.mark-v-armor-constant": constant(gets("hp", 6, YOUR_IDENTITY)),
  // Mark V Helmet — Hero Action (thwart): Exhaust Mark V Helmet → remove 1 threat from a scheme (from each scheme instead if you have the Aerial trait).
  "01037.mark-v-helmet-action": heroAction(
    { label: "thwart", cost: exhaustThis },
    ifThen(aerial, thwart(1, each(query("scheme"))), thwartAScheme(1)),
  ),
  // Powered Gauntlets — Hero Action (attack): Exhaust Powered Gauntlets → deal 1 damage to an enemy (2 damage instead if you have the Aerial trait).
  "01038.powered-gauntlets-action": heroAction(
    { label: "attack", cost: exhaustThis },
    attackAnEnemy(ifElse(aerial, 2, 1)),
  ),
  // Rocket Boots — You get +1 hit point.
  "01039.rocket-boots-constant": constant(gets("hp", 1, YOUR_IDENTITY)),
  // Hero Action: Exhaust Rocket Boots and spend a [mental] resource → gain the Aerial trait until the end of the phase.
  "01039.rocket-boots-action": heroAction(
    { cost: [exhaustThis, spend({ mental: 1 })] },
    gainTraitUntil(TRAIT.AERIAL, yourIdentity, "endOfPhase"),
  ),
});

/** Business Problems (01170), Iron Man's obligation. */
export const IRON_MAN_OBLIGATION = defineAbilities({
  // • Exhaust each upgrade you control. Discard this obligation.
  "01170.obligation": obligation("Tony Stark", {
    label: "Exhaust each upgrade you control",
    effects: [exhaust(each(query("upgrade", { controller: "you" })))],
  }),
});

const YOUR_UPGRADES = query("upgrade", { controller: "you" });
const discardAnUpgrade = [chooseTarget("upgrade", YOUR_UPGRADES), discard(chosen("upgrade"))];

/** Iron Man's nemesis set: Imminent Overload, Whiplash, Electric Whip Attack, Electromagnetic Backlash. */
export const IRON_MAN_NEMESIS = defineAbilities({
  // Imminent Overload — When Revealed: Place an additional 1 [per_hero] threat here.
  "01171.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
  // Electric Whip Attack — When Revealed: Choose to either deal 1 damage to your hero for each upgrade you control or choose and discard an upgrade you control.
  "01173.when-revealed": whenRevealed(
    chooseOne(
      option("Take 1 damage for each upgrade you control", takeDamage(countOf(YOUR_UPGRADES))),
      option("Choose and discard an upgrade you control", { when: exists(YOUR_UPGRADES) }, discardAnUpgrade),
    ),
  ),
  // [star] Boost: If the villain is making an undefended attack, choose and discard an upgrade you control.
  "01173.boost": boost(ifThen(undefendedAttack, discardAnUpgrade)),
  // Electromagnetic Backlash — When Revealed: Each player discards the top 5 cards of their deck. For each printed [energy]
  // resource a player discards this way, that player takes 1 damage.
  "01174.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      moveCards(topOfDeck(5, thatPlayer), "discard", "backlash"),
      takeDamage(varOf("backlash.energy"), thatPlayer),
    ),
  ),
});
