import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  attachCard,
  boost,
  chooseOne,
  defeatingPlayer,
  confuse,
  countersOn,
  defineAbilities,
  discard,
  enemyAttack,
  exhaustYourHero,
  forEachPlayer,
  forcedResponse,
  gainsKeyword,
  constant,
  heal,
  heroAction,
  ifThen,
  identityOf,
  interrupt,
  modifyAttack,
  on,
  option,
  remainingHpOf,
  removeThreat,
  self,
  stun,
  takeDamage,
  theVillain,
  thatPlayer,
  valueAtLeast,
  valueAtMost,
  varAtLeast,
  whenDefeated,
  whenRevealed,
  yourIdentity,
  you,
} from "../../dsl/index.js";
import {
  CORRUPTION,
  hasCreepingCorruption,
  YOUR_CREEPING_CORRUPTION,
  placeCorruption,
  removeCorruption,
  youHaveCreepingCorruption,
} from "./creeping-corruption.js";

/**
 * Shadowland, the Heart of Shadow set (MC65, scenario 3; docs/phase7-shadowland.md section 6). Corruption counters sit on
 * each player's Creeping Corruption upgrade (`creeping-corruption.ts`); "your Creeping Corruption" is the upgrade in the
 * play area of the player the card speaks to. A player who has none cannot place a counter on it: an option that places
 * one is not offered to them, as RRG 1.8 "Choose (Option)" (p. 12) has it for an option with no valid target.
 *
 * **65057 Krahllak** (villain, stage A; Steady is data): "Interrupt: When Krahllak attacks you, you may place 1
 *   corruption counter on your Creeping Corruption. If you do, Krahllak gets -3 ATK for this attack." It is an optional
 *   interrupt, so the attacked player decides before a teammate declares a defender (insert FAQ p. 18, M11). The counter
 *   is placed, then "if you do" reads that it was.
 * **65064 Mark of the Wicked** / **65065 Pull of Power** (attachments): "When Revealed: You may attach this card to
 *   your identity. If you do not, take 4 damage, stun (confuse) your identity, remove 1 corruption counter ... and
 *   discard this card." Two options, the second the "do not". The Forced Response is the attached hero's own basic
 *   attack (basic thwart) and places a counter on the Creeping Corruption of the attached hero's player.
 * **65067 Hellbride** (minion): When Defeated, the defeating player places 2 counters, "then" heals 6 from their
 *   identity (RRG 1.8 "Then", p. 44). Hero Action: with 2 or fewer remaining hit points, exhaust your hero to discard
 *   her (a discard, not a defeat, so no When Defeated), then remove 1 counter from your Creeping Corruption.
 * **65069 Snakeroot Elders** (minion): guard and patrol while a counter is on her. When Revealed: "you may" place a
 *   counter on your Creeping Corruption, "if you do not" one goes on her (the same two options).
 * **65070 Veil of Nightmares** (side scheme): Hero Action: placing a counter on your Creeping Corruption is the cost
 *   (written as an effect, `costEffects`, so nothing resolves without a Creeping Corruption), then remove 5 threat from
 *   this scheme.
 * **65071 Submit or Suffer** (treachery): choose to place a counter, or remove one and the villain (Krahllak) attacks
 *   you. Boost: place a counter, or stun your identity ("you" is the defending player).
 *
 * Cards (7):
 * - 65057 Krahllak (villain)
 * - 65064 Mark of the Wicked (attachment)
 * - 65065 Pull of Power (attachment)
 * - 65067 Hellbride (minion)
 * - 65069 Snakeroot Elders (minion)
 * - 65070 Veil of Nightmares (side_scheme)
 * - 65071 Submit or Suffer (treachery)
 */
export const SHADOWLAND_HEART_OF_SHADOW: AbilityRegistry = defineAbilities({
  "65057.krahllak-interrupt": interrupt(
    on.enemyAttacks("self", { againstYou: true }),
    { while: youHaveCreepingCorruption },
    addCounters(CORRUPTION, 1, YOUR_CREEPING_CORRUPTION, { bind: "placed" }),
    // "If you do": only a counter that was placed.
    ifThen(varAtLeast("placed.amount", 1), modifyAttack({ atkBonus: -3 })),
  ),

  "65064.when-revealed": whenRevealed(
    chooseOne(
      option("Attach this card to your identity", attachCard(self, yourIdentity)),
      option(
        "Take 4 damage, stun your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card",
        takeDamage(4),
        stun(yourIdentity),
        removeCorruption(1),
        discard(self),
      ),
    ),
  ),
  "65064.mark-of-the-wicked-forced-response": forcedResponse(on.attacks("host", { basic: true }), placeCorruption(1)),

  "65065.when-revealed": whenRevealed(
    chooseOne(
      option("Attach this card to your identity", attachCard(self, yourIdentity)),
      option(
        "Take 4 damage, confuse your identity, remove 1 corruption counter from your Creeping Corruption, and discard this card",
        takeDamage(4),
        confuse(yourIdentity),
        removeCorruption(1),
        discard(self),
      ),
    ),
  ),
  "65065.pull-of-power-forced-response": forcedResponse(on.thwarts("host", { basic: true }), placeCorruption(1)),

  "65067.when-defeated": whenDefeated(
    forEachPlayer(
      defeatingPlayer,
      placeCorruption(2, thatPlayer),
      // "Then": the healing only follows counters that were placed, so only a player who has a Creeping Corruption.
      ifThen(hasCreepingCorruption(thatPlayer), heal(6, identityOf(thatPlayer))),
    ),
  ),
  "65067.hellbride-action": heroAction(
    { while: valueAtMost(remainingHpOf(self), 2), cost: exhaustYourHero },
    discard(self),
    removeCorruption(1),
  ),

  "65069.snakeroot-elders-constant": constant(
    gainsKeyword({ name: "guard" }, { self: true }, { while: valueAtLeast(countersOn(self, CORRUPTION), 1) }),
    gainsKeyword({ name: "patrol" }, { self: true }, { while: valueAtLeast(countersOn(self, CORRUPTION), 1) }),
  ),
  "65069.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Place 1 corruption counter on your Creeping Corruption",
        { when: youHaveCreepingCorruption },
        placeCorruption(1),
      ),
      option("Place 1 corruption counter here", addCounters(CORRUPTION, 1, self)),
    ),
  ),

  "65070.veil-of-nightmares-action": heroAction(
    { while: youHaveCreepingCorruption, costEffects: 1 },
    placeCorruption(1),
    removeThreat(5, self),
  ),

  "65071.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Place 1 corruption counter on your Creeping Corruption",
        { when: youHaveCreepingCorruption },
        placeCorruption(1),
      ),
      option(
        "Remove 1 corruption counter from your Creeping Corruption and Krahllak attacks you",
        // Needs the Creeping Corruption as its target; with no counter on it the removal does nothing and Krahllak still
        // attacks (RRG 1.8 "Choose (Option)", p. 12; owner 2026-10-20 reversing Q8).
        { when: youHaveCreepingCorruption },
        removeCorruption(1),
        enemyAttack(theVillain, { against: you }),
      ),
    ),
  ),
  "65071.boost": boost(
    chooseOne(
      option(
        "Place 1 corruption counter on your Creeping Corruption",
        { when: youHaveCreepingCorruption },
        placeCorruption(1),
      ),
      option("Stun your identity", stun(yourIdentity)),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_HEART_OF_SHADOW_SKIPPED: Readonly<Record<string, string>> = {};
