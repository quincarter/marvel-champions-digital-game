import { trait } from "@mc/content";
import {
  after,
  andThen,
  chooseCards,
  chooseTarget,
  chosen,
  choiceFoundNothing,
  constant,
  cards,
  dealDamage,
  defeat,
  defineAbilities,
  discard,
  damageOn,
  each,
  encounterCards,
  forcedInterrupt,
  forcedResponse,
  FRIENDLY_CHARACTER,
  gainsKeyword,
  heal,
  heroInterrupt,
  host,
  ifThen,
  instead,
  modifyAttack,
  modifyStat,
  moveCards,
  not,
  putIntoPlay,
  query,
  refMatches,
  removeCounter,
  revealedFromEncounterDeck,
  rule,
  self,
  shuffleEncounterDeck,
  spendResources,
  surge,
  takesConsequentialDamage,
  tuckCards,
  tuckedUnder,
  varAtLeast,
  when,
  whenDefeated,
  whenRevealed,
  you,
  doubleDamageTaken,
  giveStatus,
  made,
} from "../../dsl/index.js";

const SETTING = trait("SETTING");

/**
 * MojoMania (`mojo`), the Horror genre set (`horror`, 39047-39052; docs/phase7-wave6.md §7.4).
 *
 * **The Mojo Files** is a SHOW environment: it discards the other SETTING environments and surges only when revealed
 * from the encounter deck (§3.64, insert p. 18). "Each ally takes -1 consequential damage after attacking a minion" is
 * a scoped `reduceDamageTaken` (§3.31): the `if` reads the attack's `attack.target`, so an attack on the villain or a
 * thwart is untouched, and a consequential 0 stays 0.
 *
 * Granted quickstrike: `quickstrikeAttack` (engine/src/resolve/enter-play.ts) reads `hasKeyword` without `deps`, so the
 * grant is not read when a minion engages (open engine gap, see horror.test.ts); the ability itself is the usual grant.
 *
 * **Bandolier of Stakes** attaches to the revealing player's identity at the schema level (`attachesTo`, resolved by
 * the reveal before this card's When Revealed, as Dead or Alive's is); the "you may spend 1 resource" is the optional
 * payment, and "Otherwise, discard this card" is the declined branch. Its interrupt names the host ("your hero"), not
 * "you": an encounter card has no controller, so `controller: you` would match nothing (ally attacks are not offered it).
 *
 * **Cultist** searches the encounter deck and discard pile for The Kraken, puts it into play engaged with the player
 * Cultist attacked, shuffles, then discards Cultist only if The Kraken was found (a printed "Then": a required choice that finds nothing skips it).
 *
 * **Vampire**: "Attacks with piercing deal double damage" is `doubleDamageTaken` with `attackKeyword: "piercing"`
 * (§3.68, RRG 1.8 "Modifiers" p. 29: additions come before doubling). Its heal reports the damage healed, and the tough
 * status card is given only when none was.
 *
 * **Werewolf Pack**: the ally is defeated (so its own When Defeated and the defeat responses happen), then tucked
 * facedown from its owner's discard pile (the Operation Zero Tolerance shape, FAQ RRG 1.8 p. 63). The Forced Interrupt
 * replaces the defeat only while an ally is beneath it: with none, there is nothing to discard and it is defeated.
 */
const THE_KRAKEN = "The Kraken";

export const HORROR_ABILITIES = defineAbilities({
  // The Mojo Files (39047) — Each minion gains quickstrike.
  "39047.the-mojo-files-constant": constant(gainsKeyword({ name: "quickstrike" }, query("minion"))),
  // Each ally takes -1 consequential damage after attacking a minion.
  "39047.the-mojo-files-constant-2": constant(
    rule(
      takesConsequentialDamage(query("ally"), -1, {
        from: "attack",
        if: refMatches({ kind: "slot", slot: "attack.target" }, query("minion"), { anywhere: true }),
      }),
    ),
  ),
  // When Revealed: Discard each other Setting environment in play. If this card was revealed from the encounter deck,
  // it gains surge.
  "39047.when-revealed": whenRevealed(
    discard(each(query("environment", { trait: SETTING, excluding: self }))),
    ifThen(revealedFromEncounterDeck, surge()),
  ),

  // Bandolier of Stakes (39048) — Surge. Uses (3 stake counters) (data). When Revealed: You may spend 1 resource of any
  // type to attach this card to your identity. Otherwise, discard this card.
  "39048.when-revealed": whenRevealed(spendResources({ generic: 1 }, "paid"), ifThen(not(made("paid")), discard(self))),
  // Hero Interrupt: When your hero makes a basic attack, remove 1 stake counter from here → your hero gets +1 ATK for
  // that attack and that attack gains piercing.
  "39048.bandolier-of-stakes-interrupt": heroInterrupt(
    when.attacks("host", { basic: true }),
    { cost: removeCounter("stake", 1) },
    modifyStat("atk", 1, host, "endOfAttack"),
    modifyAttack({ keywords: ["piercing"] }),
  ),

  // Cultist (39049) — [star] Forced Response: After Cultist activates against you, search the encounter deck and discard
  // pile for The Kraken and put it into play engaged with you. (Shuffle.) Then, discard Cultist.
  "39049.cultist-forced-response": forcedResponse(
    after.enemyActivates("self", { againstYou: true }),
    chooseCards("kraken", encounterCards(["deck", "discard"], { name: THE_KRAKEN }), { min: 1, max: 1 }),
    putIntoPlay(chosen("kraken"), you),
    // The search shuffles whether or not it found anything; the printed "Then" (RRG 1.8 p. 44) waits on the find.
    shuffleEncounterDeck(),
    andThen(discard(self)),
  ),

  // The Kraken (50) — [star] Forced Response: After The Kraken activates, each other character takes 1 damage.
  "39050.the-kraken-forced-response": forcedResponse(
    after.enemyActivates("self"),
    dealDamage(1, each(query("character", { excluding: self }))),
  ),
  // When Defeated: Each friendly character heals 1 damage.
  "39050.when-defeated": whenDefeated(heal(1, each(FRIENDLY_CHARACTER))),

  // Vampire (39051) — Attacks with piercing deal double damage to Vampire.
  "39051.vampire-constant": constant(doubleDamageTaken({ self: true }, { attackKeyword: "piercing" })),
  // [star] Forced Response: After Vampire attacks and damages a character, heal all damage from Vampire. If no damage was
  // healed this way, give Vampire a tough status card.
  "39051.vampire-forced-response": forcedResponse(
    after.enemyAttacks("self", { damages: true }),
    heal(damageOn(self), self, { bind: "healed" }),
    ifThen(not(varAtLeast("healed.amount")), giveStatus(self, "tough")),
  ),

  // Werewolf Pack (39052) — When Revealed: Defeat an ally you control and place it facedown under Werewolf Pack.
  "39052.when-revealed": whenRevealed(
    chooseTarget("ally", query("ally", { controller: "you" })),
    defeat(chosen("ally")),
    tuckCards(cards(chosen("ally")), self, true),
  ),
  // Forced Interrupt: When Werewolf Pack would be defeated, discard an ally from under it instead. Then, heal all damage
  // from Werewolf Pack.
  "39052.werewolf-pack-forced-interrupt": forcedInterrupt(
    when.defeated("self"),
    chooseCards("lost", tuckedUnder(self), { min: 1, max: 1, chooser: you }),
    ifThen(not(choiceFoundNothing()), instead(moveCards(cards(chosen("lost")), "discard"), heal(damageOn(self), self))),
  ),
});
