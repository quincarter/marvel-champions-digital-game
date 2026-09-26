import {
  andThen,
  chosen,
  damagedAtLeast,
  dealDamage,
  defineAbilities,
  discard,
  each,
  enemyAttack,
  eventAmount,
  forcedInterrupt,
  FRIENDLY_CHARACTER,
  giveTough,
  hasStatus,
  heal,
  heroAction,
  ifThen,
  instead,
  modifyAttack,
  not,
  perHero,
  placeDamage,
  placeThreat,
  query,
  refMatches,
  searchAndReveal,
  self,
  setup,
  spend,
  stun,
  surge,
  theVillain,
  varAtLeast,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  atEndOfAttack,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

/** The Rhino scenario: Rhino (01094–01096), The Break-In! (01097), and the Rhino encounter set (01098–01108). */
export const RHINO = defineAbilities({
  // Rhino (II) — When Revealed: Search the encounter deck and discard pile for the Breakin' & Takin' side scheme and reveal it. Shuffle the encounter deck.
  "01095.when-revealed": whenRevealed(searchAndReveal(cardName("01107"))),
  // Rhino (III) — When Revealed: Stun each hero.
  "01096.when-revealed": whenRevealed(stun(each(query("hero")))),
  // The Break-In! 1A — Setup: Advance to stage 1B. (The engine always continues onto the B side.)
  "01097a.setup": setup(),

  // Armored Rhino Suit — Forced Interrupt: When any amount of damage would be dealt to Rhino, place it here instead.
  // Then, if there is at least 5 damage here, discard Armored Rhino Suit.
  "01098.armored-rhino-suit-forced-interrupt": forcedInterrupt(
    when.damage(query("villain")),
    // The pre-"then" text is the placement, which always resolves; the threshold "if" is post-"then" text and gates
    // itself (RRG 1.8 "'Then'", p. 44).
    instead(placeDamage(eventAmount, self), andThen(ifThen(damagedAtLeast(self, 5), discard(self)))),
  ),
  // Charge — (+3 ATK printed as a stat modifier) [star] Forced Interrupt: When Rhino attacks, the attack gains overkill.
  // At the end of this attack, discard Charge.
  "01099.charge-forced-interrupt": forcedInterrupt(
    when.villainAttacks(),
    modifyAttack({ overkill: true }),
    atEndOfAttack(discard(self)),
  ),
  // Enhanced Ivory Horn — Hero Action: Spend [physical][physical][physical] resources → discard this card.
  "01100.enhanced-ivory-horn-action": heroAction({ cost: spend({ physical: 3 }) }, discard(self)),
  // Shocker — When Revealed: Deal 1 damage to each hero.
  "01103.when-revealed": whenRevealed(dealDamage(1, each(query("hero")))),
  // Hard to Keep Down — When Revealed: Rhino heals 4 damage. If no damage was healed this way, this card gains surge.
  "01104.when-revealed": whenRevealed(
    heal(4, theVillain, { bind: "healed" }),
    ifThen(not(varAtLeast("healed.amount")), surge()),
  ),
  // "I'm Tough!" — When Revealed: Give Rhino a tough status card. If Rhino already has a tough status card, this card gains surge.
  "01105.when-revealed": whenRevealed(ifThen(hasStatus(theVillain, "tough"), surge(), giveTough(theVillain))),
  // Stampede — When Revealed (Alter-Ego): This card gains surge.
  "01106.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  // When Revealed (Hero): Rhino attacks you. If a character is damaged by this attack, that character is stunned.
  "01106.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, bind: "stampede" }),
    // A defending ally the attack defeated is no longer in play to be stunned.
    ifThen(refMatches(chosen("stampede.damaged"), FRIENDLY_CHARACTER), stun(chosen("stampede.damaged"))),
  ),
  // Breakin' & Takin' — When Revealed: Place an additional 1 [per_hero] threat here. (Hazard icon: the engine deals +1 encounter card.)
  "01107.when-revealed": whenRevealed(placeThreat(perHero(1), self)),
});
