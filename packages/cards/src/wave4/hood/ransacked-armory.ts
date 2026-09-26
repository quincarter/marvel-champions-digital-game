import {
  attachCard,
  attacksGainKeywords,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  discardEncounterCards,
  encounterCards,
  firstPlayer,
  forcedInterrupt,
  gainsKeyword,
  gets,
  ifThen,
  isAttached,
  not,
  on,
  preventDamage,
  putIntoPlay,
  query,
  rule,
  self,
  shuffleEncounterDeck,
  surge,
  varOf,
  whenRevealed,
  you,
} from "../../dsl/index.js";

/**
 * The Ransacked Armory modular set (`hood` 24037-24041, docs/phase7-wave4.md §2.3): three "attach to the minion
 * with the most remaining hit points" attachments (Holoshield Generator, Jetpack, Tech Gauntlets), Flamethrower
 * (the same host, `attachesTo` is data) and Armored Guard (a plain-stat minion, no ability refs).
 *
 * Each attachment's first sentence is its `attachesTo` host (data) plus what happens when there is none, a When
 * Revealed read after the engine tried to attach it (`isAttached`): Jetpack and Tech Gauntlets gain surge; Flamethrower
 * and Holoshield Generator search the encounter deck and discard pile for a minion, put it into play engaged with the
 * revealing player and attach to it (the first player picks, RRG 1.8 "First Player", p. 19). Flamethrower's "attacks
 * deal indirect damage" is wave 3's `attacksDealIndirectDamage` rule with `attacker: { hostOfSelf: true }`
 * (docs/phase7-wave3.md §3.16, reusable as is).
 */

/** "If you cannot, this card gains surge." */
const surgeIfUnattached = () => whenRevealed(ifThen(not(isAttached(self)), surge()));
/**
 * "If you cannot, search the encounter deck and discard pile for a minion, put it into play engaged with you, and
 * attach this card to it. (Shuffle.)"
 */
const searchForAHostIfUnattached = () =>
  whenRevealed(
    ifThen(not(isAttached(self)), [
      chooseCards("host", encounterCards(["deck", "discard"], query("minion")), {
        min: 1,
        max: 1,
        chooser: firstPlayer,
      }),
      putIntoPlay(chosen("host"), you),
      attachCard(self, chosen("host")),
      shuffleEncounterDeck(),
    ]),
  );

export const RANSACKED_ARMORY = defineAbilities({
  // Flamethrower (24037, attachment; TECH/WEAPON, ATK +3, attachesTo are data) — "… If you cannot, search … for a
  // minion …". [star] Attached minion's attacks deal indirect damage.
  "24037.flamethrower-constant": searchForAHostIfUnattached(),
  "24037.flamethrower-constant-2": constant(
    rule({ kind: "attacksDealIndirectDamage", attacker: { hostOfSelf: true } }),
  ),

  // Holoshield Generator (24038, attachment; ITEM/TECH, attachesTo are data) — "… If you cannot, search … for a
  // minion …". Attached minion gets +4 hit points and gains retaliate 2.
  "24038.holoshield-generator-constant": searchForAHostIfUnattached(),
  "24038.holoshield-generator-constant-2": constant(
    gets("hp", 4, { hostOfSelf: true }),
    gainsKeyword({ name: "retaliate", value: 2 }, { hostOfSelf: true }),
  ),

  // Jetpack (24039, attachment; ITEM/TECH are data) — "Attach to the minion with the most remaining hit points. If
  // you cannot, this card gains surge" is entirely data (`attachesTo.ifAble`, surge keyword); its own "constant"
  // ref names no further text. Forced Interrupt: when attached minion would take any amount of damage from an
  // attack, discard the top card of the encounter deck; reduce damage from that attack by the number of boost
  // icons discarded this way.
  "24039.jetpack-constant": surgeIfUnattached(),
  "24039.jetpack-forced-interrupt": forcedInterrupt(
    on.damage({ hostOfSelf: true }, { fromAttack: true }),
    discardEncounterCards(1, { bind: "d" }),
    preventDamage(varOf("d.boostIcons")),
  ),

  // Tech Gauntlets (24040, attachment; TECH/WEAPON, statModifiers are data) — "Attach to the minion with the most
  // remaining hit points. If you cannot, this card gains surge" is data (the same shape as Jetpack's own
  // `-constant`); its own ref names no further text. Attached minion gets +3 hit points. [star] Attached minion's
  // attacks gain overkill.
  "24040.tech-gauntlets-constant": surgeIfUnattached(),
  "24040.tech-gauntlets-constant-2": constant(gets("hp", 3, { hostOfSelf: true })),
  "24040.tech-gauntlets-constant-3": constant(attacksGainKeywords(["overkill"], { attacker: { hostOfSelf: true } })),
});
