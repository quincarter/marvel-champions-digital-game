import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec } from "@mc/engine";
import {
  andThen,
  applyRuleUntil,
  attacksGainKeywords,
  boost,
  chooseCards,
  chooseTarget,
  chosen,
  confuse,
  constant,
  countOf,
  damagedAtLeast,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  enemyTeamChooses,
  eventAmount,
  exists,
  firstPlayer,
  forcedInterrupt,
  gainsKeyword,
  gainsKeywordX,
  gainsTrait,
  gets,
  giveTough,
  heroResponse,
  ifThen,
  inEncounterSet,
  instead,
  min,
  moveCards,
  on,
  placeDamage,
  query,
  revealCard,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  sum,
  theVillain,
  topOfDeck,
  varOf,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  you,
} from "../../../dsl/index.js";

const TECH = trait("TECH");
const AERIAL = trait("AERIAL");
/** The attachments Iron Man's set shuffles into the encounter deck: the candidates of "an Iron Man attachment". */
const IRON_MAN_ATTACHMENT = query("attachment", inEncounterSet("iron_man_leader"));
const HOST_VILLAIN = query("villain", { hostOfSelf: true });
/** A Tech attachment on Iron Man (the villain). */
const TECH_ON_IRON_MAN = query("attachment", { trait: TECH, host: theVillain });

/**
 * "The enemy team searches the encounter deck [and discard pile] for an Iron Man attachment and your team reveals it."
 * The search is the enemy team's choice: the first player picks which one is found, in a prompt marked as the enemy
 * team's (owner's answer to question 6 = A, 2026-10-11; MC56 p. 6, the grim rule). One candidate left is found with no
 * prompt. Then `revealer` reveals it (it attaches to Iron Man by its own "Attach to Iron Man", resolving its When
 * Revealed where it has one) and the encounter deck is shuffled (RRG 1.8 "Search", p. 39).
 */
const findIronManAttachment = (zones: readonly ("deck" | "discard")[], revealer: typeof you): EffectSpec[] => [
  chooseCards("found", encounterCards(zones, IRON_MAN_ATTACHMENT), { min: 1, max: 1, chooser: enemyTeamChooses }),
  revealCard(chosen("found"), revealer),
  shuffleEncounterDeck(),
];

/** "[star] Iron Man gets +1 SCH for each Tech attachment on him (to a maximum of +3 SCH)." Every stage. */
const ironManConstant = () => constant(gets("sch", min(countOf(TECH_ON_IRON_MAN), 3), { self: true }));

/** Setup (stages I and III): the enemy team searches the deck; the first player reveals the attachment. */
const ironManSetup = () => setup(...findIronManAttachment(["deck"], firstPlayer));

/** When Revealed (stages II and IV): "Deal each player an encounter card. Iron Man cannot take damage this phase." */
const ironManWhenRevealed = () =>
  whenRevealed(
    dealEncounterCard(eachPlayer),
    applyRuleUntil({ kind: "cannotTakeDamage", target: query("villain") }, "endOfPhase"),
  );

/** "Hero Response: After you make a basic attack against Iron Man, spend <resources> -> discard this card." */
const afterBasicAttackOnIronMan = (resources: { readonly energy?: 1; readonly mental?: 1; readonly physical: 1 }) =>
  heroResponse(
    on.attacks(query("identity"), { basic: true, byYou: true, target: { hostOfSelf: true } }),
    { cost: spend(resources) },
    discard(self),
  );

/**
 * Iron Man, the Civil War leader (MC56 p. 3, a leader works as a villain; docs/phase7-wave10.md sections 2.2, 3.5, 3.7,
 * 7.1): stages 56059 to 56062, one VillainCard whose stages I and II are the standard game and III and IV the expert one.
 * Hit points, ATK, SCH, Steady and the attachments' +1 ATK are data.
 *
 * **Every stage**: +1 SCH for each Tech attachment on him, to a maximum of +3 (the five attachments of his set are all
 * Tech; the count reads the attachments on the villain whatever set they came from). **Setup (I and III)**: III prints
 * the same Setup as I (question 8, closed; the data carries the corrected label). The search is an enemy-team choice
 * (`enemyTeamChooses`); the first player reveals the card. **When Revealed (II and IV)**: each player is dealt a
 * facedown encounter card, and no damage can be dealt to the villain until the end of that phase.
 *
 * **Powered Gauntlets (56065)**: his attacks gain ranged. **Rocket Boots (56066)**: he gains the Aerial trait.
 * **Mark V Helmet (56067)** and **Arc Reactor (56068)**: a tough status card is given to him as the card is revealed;
 * he gains stalwart / retaliate 1. All five attachments carry the Hero Response to discard them after a basic attack
 * (the resource cost differs). **Boost, "Reveal this card" (56065, 56066, 56069)**: the player activated against
 * reveals it.
 *
 * **Mark V Armor (56069)**: a Forced Interrupt, not a Response (scan-checked; RRG 1.8 "Interrupt"): the damage is placed
 * on the armor before it is dealt, so Iron Man takes none of it, and the check for 5 damage follows the placement
 * (the hit that brings the armor to 5 is still absorbed in full, as Armored Rhino Suit 01098).
 *
 * **Supersonic Punch (56071)**: the Tech condition is read when the sentence resolves. **Stark Tower (56072)**: When
 * Defeated searches the deck and the discard pile; the player who defeated it reveals the card.
 *
 * Cards (9):
 * - 56059 Iron Man (villain)
 * - 56065 Powered Gauntlets (attachment)
 * - 56066 Rocket Boots (attachment)
 * - 56067 Mark V Helmet (attachment)
 * - 56068 Arc Reactor (attachment)
 * - 56069 Mark V Armor (attachment)
 * - 56070 Repulsor Blast (treachery)
 * - 56071 Supersonic Punch (treachery)
 * - 56072 Stark Tower (side_scheme)
 */
export const LEADERS_IRON_MAN: AbilityRegistry = defineAbilities({
  "56059.iron-man-constant": ironManConstant(),
  "56059.setup": ironManSetup(),
  "56060.iron-man-constant": ironManConstant(),
  "56060.when-revealed": ironManWhenRevealed(),
  "56061.iron-man-constant": ironManConstant(),
  "56061.setup": ironManSetup(),
  "56062.iron-man-constant": ironManConstant(),
  "56062.when-revealed": ironManWhenRevealed(),

  // Powered Gauntlets: "[star] Iron Man's attacks gain ranged."
  "56065.powered-gauntlets-constant": constant(attacksGainKeywords(["ranged"], { attacker: HOST_VILLAIN })),
  "56065.powered-gauntlets-response": afterBasicAttackOnIronMan({ energy: 1, physical: 1 }),
  "56065.boost": boost(revealCard(self)),

  // Rocket Boots: "Iron Man gains the Aerial trait."
  "56066.rocket-boots-constant": constant(gainsTrait(AERIAL, HOST_VILLAIN)),
  "56066.rocket-boots-response": afterBasicAttackOnIronMan({ energy: 1, physical: 1 }),
  "56066.boost": boost(revealCard(self)),

  // Mark V Helmet: "Attach to Iron Man and give him a tough status card. Iron Man gains stalwart."
  "56067.mark-v-helmet-constant": whenRevealed(giveTough(theVillain)),
  "56067.mark-v-helmet-constant-2": constant(gainsKeyword({ name: "stalwart" }, HOST_VILLAIN)),
  "56067.mark-v-helmet-response": afterBasicAttackOnIronMan({ mental: 1, physical: 1 }),

  // Arc Reactor: "Attach to Iron Man and give him a tough status card. Iron Man gains retaliate 1."
  "56068.arc-reactor-constant": whenRevealed(giveTough(theVillain)),
  "56068.arc-reactor-constant-2": constant(gainsKeywordX("retaliate", 1, HOST_VILLAIN)),
  "56068.arc-reactor-response": afterBasicAttackOnIronMan({ mental: 1, physical: 1 }),

  // Mark V Armor: the damage is placed here instead; then, at 5 or more damage here, discard this card.
  "56069.mark-v-armor-forced-interrupt": forcedInterrupt(
    on.damage("host"),
    instead(placeDamage(eventAmount, self), andThen(ifThen(damagedAtLeast(self, 5), discard(self)))),
  ),
  "56069.boost": boost(revealCard(self)),

  // Repulsor Blast
  "56070.when-revealed-alter-ego": whenRevealedAlterEgo(
    // No "choose": an encounter card targeting one of several eligible cards; the first player selects
    // (RRG 1.8 "First Player", p. 19).
    chooseTarget("gear", query(["upgrade", "support"], { controller: "you" }), { chooser: firstPlayer }),
    discard(chosen("gear")),
  ),
  "56070.when-revealed-hero": whenRevealedHero(
    moveCards(topOfDeck(4), "discard", "milled"),
    dealDamage(sum(varOf("milled.energy"), varOf("milled.wild")), yourIdentity),
  ),

  // Supersonic Punch
  "56071.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain),
    ifThen(exists(TECH_ON_IRON_MAN), confuse(yourIdentity)),
  ),
  "56071.when-revealed-hero": whenRevealedHero(
    ifThen(
      exists(TECH_ON_IRON_MAN),
      enemyAttack(theVillain, { against: you, keywords: ["piercing"] }),
      enemyAttack(theVillain, { against: you }),
    ),
  ),

  // Stark Tower
  "56072.when-defeated": whenDefeated(...findIronManAttachment(["deck", "discard"], you)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LEADERS_IRON_MAN_SKIPPED: Readonly<Record<string, string>> = {};
