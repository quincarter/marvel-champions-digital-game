import { trait } from "@mc/content";
import {
  addCounters,
  boost,
  cards,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  dealDamage,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardFromHand,
  each,
  encounterCards,
  exhaust,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  ifThen,
  maxDamageTaken,
  moveCards,
  on,
  putIntoPlay,
  query,
  revealedFromEncounterDeck,
  self,
  shuffleEncounterDeck,
  stun,
  surge,
  tuckCards,
  tuckedUnder,
  when,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";

const SETTING = trait("SETTING");
/** "A character you control": your hero or alter-ego, or one of your allies. */
const YOUR_CHARACTER = query(["identity", "ally"], { controller: "you" });
const exhaustACharacterYouControl = [chooseTarget("character", YOUR_CHARACTER), exhaust(chosen("character"))];

/**
 * MojoMania (`mojo`), the Sci-Fi genre set (`sci-fi`, 39053-39059; docs/phase7-wave6.md §7.4). Its SHOW environment
 * (Mojo Runner) is the only card that reads where it was revealed from (§3.64, insert p. 18); every minion's
 * "engages you" is the `minionEngaged` event, "you" being the engaged player.
 *
 * Toughness granted by an environment (Mojo Runner) or the side scheme's guard and patrol are keyword grants: a
 * granted toughness gives a tough status card only to a character as it enters play (RRG 1.8 "Toughness", p. 45).
 */
export const SCI_FI_ABILITIES = defineAbilities({
  // Mojo Runner (39053) — Each minion and ally gains toughness.
  "39053.mojo-runner-constant": constant(gainsKeyword({ name: "toughness" }, query(["minion", "ally"]))),
  // When Revealed: Discard each other Setting environment in play. If this card was revealed from the encounter deck,
  // it gains surge.
  "39053.when-revealed": whenRevealed(
    discard(each(query("environment", { trait: SETTING, excluding: self }))),
    ifThen(revealedFromEncounterDeck, surge()),
  ),

  // Avalanche 9.0 (39054) — Forced Response: After Avalanche 9.0 engages you, exhaust a character you control and deal
  // 1 damage to that character. (The scan reads "that character"; the data says "this", docs §7.7.)
  "39054.avalanche-90-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    exhaustACharacterYouControl,
    dealDamage(1, chosen("character")),
  ),
  // [star] Boost: Exhaust a character you control.
  "39054.boost": boost(exhaustACharacterYouControl),

  // Blob 3.14 (39055) — Blob 3.14 cannot take more than 2 damage from each attack.
  "39055.blob-314-constant": constant(maxDamageTaken({ self: true }, 2)),
  // [star] Boost: You are stunned.
  "39055.boost": boost(stun(yourIdentity)),

  // Magneto 2.6 (39056) — [star] Forced Response: After Magneto 2.6 activates against you, place 1 magnetic counter on
  // him. Then, choose and discard 1 card from your hand for each magnetic counter on Magneto 2.6.
  "39056.magneto-26-forced-response": forcedResponse(
    on.enemyActivates("self", { againstYou: true }),
    addCounters("magnetic", 1, self),
    discardFromHand(countersOn(self, "magnetic")),
  ),

  // Pyro 4.0 (39057) — [star] Forced Interrupt: When Pyro 4.0 attacks you, take 2 indirect damage.
  "39057.pyro-40-forced-interrupt": forcedInterrupt(
    when.enemyAttacks("self", { againstYou: true }),
    dealIndirectDamage(you, 2),
  ),
  // [star] Boost: Take 2 indirect damage.
  "39057.boost": boost(dealIndirectDamage(you, 2)),

  // Toad 2.0 (39058) — Forced Response: After Toad 2.0 engages you, place 1 upgrade you control facedown under Toad.
  "39058.toad-20-forced-response": forcedResponse(
    { on: "minionEngaged", selfIs: "source" },
    chooseTarget("upgrade", query("upgrade", { controller: "you" })),
    tuckCards(cards(chosen("upgrade")), self, true),
  ),
  // When Defeated: Return each card under Toad 2.0 to its owner's hand.
  "39058.when-defeated": whenDefeated(moveCards(tuckedUnder(self), "hand")),

  // ICE-Teroid M (39059) — Each minion gains guard and patrol.
  "39059.ice-teroid-m-constant": constant(
    gainsKeyword({ name: "guard" }, query("minion")),
    gainsKeyword({ name: "patrol" }, query("minion")),
  ),
  // Forced Interrupt: At the end of the round (after the first player token is passed), the first player searches the
  // encounter deck and discard pile for a minion and puts it into play engaged with them. (Shuffle.)
  "39059.ice-teroid-m-forced-interrupt": forcedInterrupt(
    on.phaseEnding("villain"),
    chooseCards("found", encounterCards(["deck", "discard"], query("minion")), {
      min: 1,
      max: 1,
      chooser: firstPlayer,
    }),
    putIntoPlay(chosen("found"), firstPlayer),
    shuffleEncounterDeck(),
  ),
});
