import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  allOf,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  defeat,
  defineAbilities,
  discard,
  discardEncounterUntil,
  discardThis,
  each,
  enemyAttack,
  enemyScheme,
  eventDealt,
  eventTarget,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gets,
  giveBoostCard,
  giveTough,
  heroAction,
  highestStatAmong,
  ifThen,
  isStunned,
  modifyAttack,
  named,
  not,
  on,
  query,
  refMatches,
  remainingHpOf,
  revealCard,
  self,
  spend,
  stun,
  superlative,
  surge,
  theVillain,
  activatingEnemy,
  countOf,
  whenRevealedAlterEgo,
  whenRevealedHero,
  whenRevealed,
  you,
  yourIdentity,
  exists,
} from "../../../dsl/index.js";

const MAGGIA = trait("MAGGIA");
const MINION = query("minion");
/** The villain card this module's treacheries name. */
const HAMMERHEAD = named("Hammerhead");

/**
 * "[star] Forced Response: After Hammerhead attacks and damages a character, stun that character. If that character
 * was already stunned, deal N damage to them." (60086-60088; N is 1, 1, 2 by stage.) "Already" (RRG 1.8 "Already",
 * p. 7, read with "Alteration Effect"): the character was stunned before this stun is given, so that is checked first.
 * A stunned character takes no second stun card (RRG 1.8 FAQ p. 57), so the stun is a no-op in that case and it still
 * ends with exactly one.
 */
const hammerheadResponse = (damage: number) =>
  forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    ifThen(isStunned(eventTarget), dealDamage(damage, eventTarget)),
    stun(eventTarget),
  );

/** "Hero Action: Spend [energy][mental][physical] resources → discard this card." */
const SPEND_TO_DISCARD = heroAction({ cost: spend({ energy: 1, mental: 1, physical: 1 }) }, discard(self));

/**
 * Hammerhead villain set (docs/phase7-wave11-scenarios.md section S6).
 *
 * - **60086-60088 Hammerhead**: Toughness and Retaliate are data. Forced Response as `hammerheadResponse`.
 * - **60089 Energy Gatling Gun**: Forced Response: after the attached enemy attacks, if the attacked character was
 *   not defeated, discard this card as the cost; Hammerhead attacks that character again (a new activation's attack
 *   with its own boost card, `enemyAttack` with `targetCharacter`). The cost needs the effect to be able to resolve
 *   (RRG 1.8 "Cost", p. 14): a defeated target leaves the ability unavailable and the card in play.
 * - **60090 Hardheaded**: stalwart on the host; Hero Action (as Klaw's Sonic Converter); Boost: the activating enemy
 *   gets a tough status card.
 * - **60091 Chameleon**: +X SCH, X the highest THW among the other characters in play (`highestStatAmong`, H3.10).
 *   He prints no THW; a character that does not print one counts as 0.
 * - **60092 Maggia Enforcers**: Guard is data. Her SCH prints a star and is emitted as a dash; "SCH is equal to" is a
 *   base set (`setBase`) over every Maggia enemy in play, herself included.
 * - **60093 Maggia Underboss**: Villainous is data. Forced Interrupt: when it activates against you, if you are
 *   stunned, 1 additional boost card for this activation (`modifyAttack.extraBoostCards` reads either activation).
 * - **60094 Consolidate Power**: Forced Response: after a minion is defeated, it is given to the villain as a facedown
 *   boost card. Printed as a response (unlike Dangerous Recruits' interrupt), so the minion has already left play
 *   (discard pile, or the victory display for a card with Victory) and is given from there with `giveBoostCard`.
 * - **60095 Power Struggle**: defeat the minion with the fewest remaining hit points (a tie is decided by the first
 *   player, RRG 1.8 "First Player", p. 19), discard from the encounter deck until a minion, reveal it.
 * - **60096 "Head First!"**: Alter-Ego: surge. Hero: Hammerhead attacks you; if you are stunned (read before the
 *   attack) he gets +2 ATK for it and it gains overkill.
 *
 * Cards (9):
 * - 60086 Hammerhead (villain)
 * - 60089 Energy Gatling Gun (attachment)
 * - 60090 Hardheaded (attachment)
 * - 60091 Chameleon (minion)
 * - 60092 Maggia Enforcers (minion)
 * - 60093 Maggia Underboss (minion)
 * - 60094 Consolidate Power (side_scheme)
 * - 60095 Power Struggle (side_scheme)
 * - 60096 "Head First!" (treachery)
 */
export const FNE_VILLAINS_HAMMERHEAD: AbilityRegistry = defineAbilities({
  "60086.hammerhead-forced-response": hammerheadResponse(1),
  "60087.hammerhead-forced-response": hammerheadResponse(1),
  "60088.hammerhead-forced-response": hammerheadResponse(2),

  "60089.energy-gatling-gun-forced-response": forcedResponse(
    after.enemyAttacks("host"),
    {
      cost: discardThis,
      // The attacked character must still be in play. Engine gap: a defending ally defeated by this very attack is
      // reported as a target-less attack on the identity (`defenderLeftPlay`, RRG 1.8 FAQ #17 p. 63), so for that case
      // the card attacks the identity again (see the `it.fails` in hammerhead.test.ts).
      while: allOf(not(eventDealt("defeated")), refMatches(eventTarget, query("character"))),
    },
    enemyAttack(theVillain, { targetCharacter: eventTarget }),
  ),

  "60090.hardheaded-constant": constant(gainsKeyword({ name: "stalwart" }, query("villain", { hostOfSelf: true }))),
  "60090.hardheaded-action": SPEND_TO_DISCARD,
  "60090.boost": boost(giveTough(activatingEnemy)),

  "60091.chameleon-constant": constant(gets("sch", highestStatAmong(["thw"]), { self: true })),
  "60091.when-revealed": whenRevealed(enemyScheme(self)),

  "60092.maggia-enforcers-constant": constant(
    gets("sch", countOf(query("enemy", { trait: MAGGIA })), { self: true }, { setBase: true }),
  ),

  "60093.maggia-underboss-forced-interrupt": forcedInterrupt(
    on.enemyActivates("self", { againstYou: true }),
    { while: isStunned(yourIdentity) },
    modifyAttack({ extraBoostCards: 1 }),
  ),

  "60094.consolidate-power-forced-response": forcedResponse(
    on.defeated(MINION),
    giveBoostCard(theVillain, { card: eventTarget }),
  ),

  "60095.when-revealed": whenRevealed(
    ifThen(exists(MINION), [
      bindTargets("weakest", superlative("lowest", each(MINION), remainingHpOf(chosen("candidate")))),
      chooseTarget("target", { inSlot: "weakest" }, { chooser: firstPlayer }),
      defeat(chosen("target")),
    ]),
    discardEncounterUntil(MINION, "found"),
    revealCard(chosen("found"), you),
  ),

  "60096.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  "60096.when-revealed-hero": whenRevealedHero(
    ifThen(
      isStunned(yourIdentity),
      enemyAttack(HAMMERHEAD, { against: you, atkBonus: 2, keywords: ["overkill"] }),
      enemyAttack(HAMMERHEAD, { against: you }),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_HAMMERHEAD_SKIPPED: Readonly<Record<string, string>> = {};
