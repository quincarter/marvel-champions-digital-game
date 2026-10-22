import { trait } from "@mc/content";
import type { AbilityRegistry, PlayerRef } from "@mc/engine";
import {
  addCounters,
  advanceMainScheme,
  alterEgoAction,
  attachCard,
  attacksGainKeywords,
  boost,
  canTakeStatus,
  chooseOne,
  chooseOneBy,
  chooseTarget,
  chosen,
  confuse,
  constant,
  countersOn,
  dealDamage,
  dealEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  discardAtRandom,
  eachPlayer,
  encounterSetAside,
  enemyAttack,
  exhaustYourHero,
  forcedInterrupt,
  forcedResponse,
  hasTrait,
  forEachPlayer,
  gainsKeyword,
  heal,
  heroAction,
  identityOf,
  ifThen,
  inMode,
  instead,
  interrupt,
  modifyAttack,
  not,
  on,
  option,
  placeThreat,
  preventDamage,
  putIntoPlay,
  query,
  remainingHpOf,
  removeThreat,
  selectCards,
  self,
  setup,
  spend,
  stun,
  takeDamage,
  thatPlayer,
  theVillain,
  threatOn,
  valueAtLeast,
  valueAtMost,
  varAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import {
  CORRUPTION,
  creepingCorruptionOf,
  hasCreepingCorruption,
  YOUR_CREEPING_CORRUPTION,
  placeCorruption,
  removeCorruption,
  youHaveCreepingCorruption,
} from "./creeping-corruption.js";

/**
 * Shadowland, the Heart of Shadow set (MC65, scenario 3; docs/phase7-shadowland.md section 6). Corruption counters sit on
 * each player's Creeping Corruption upgrade (`creeping-corruption.ts`); "your Creeping Corruption" is the upgrade the
 * player the card speaks to controls. A player who has none cannot place a counter on it: an option that places
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
 * **65058 / 65059 Krahllak II and III** (the villain's later stages, one card with three stages): the same interrupt; "Krahllak's
 *   attacks gain overkill" (III: "and piercing") is an attack-keyword grant to his own attacks (Retaliate, Steady and
 *   Toughness are data).
 * **65060a Dark Invitation** (main scheme 1A/1B, then 2A/2B "Beast Be Praised"; printed 65060/65061). 1B: when it would be
 *   completed, instead all its threat is removed and each player chooses (2 counters on their Creeping Corruption, or
 *   3 damage and a facedown encounter card for themself), so it stays at stage 1B until Krahllak falls. "After Krahllak is
 *   defeated" is `on.defeated` of the villain, heard when a stage of his is defeated (the next stage then revealed, the
 *   last ends the game as a win, RRG 1.8 "Villain Defeat" p. 47); it advances the scheme to 2A. 2A: each player whose
 *   Creeping Corruption has the Overpowering trait discards 1 random card from their hand, each other player (including
 *   one with no Creeping Corruption) discards a non-permanent ally, support, upgrade or player side scheme they control from play (a
 *   permanent card cannot be discarded); expert mode deals each player 1 facedown encounter card. 2B: after step one of
 *   the villain phase each player chooses a counter or 3 threat here; "if this stage is completed, the players lose"
 *   is data (`completionLoses`).
 * **65062 Dark Shroud** (attachment to Krahllak, +1 ATK is data): Interrupt, "you or an ally you control would deal 4 or
 *   more damage to Krahllak with an attack": that damage is prevented, one counter goes on your Creeping Corruption and
 *   this card is discarded. "Would deal" is read as "would be dealt" (it resolves before a tough status card).
 * **65063 Fear Projection** (attachment to Krahllak): he gains retaliate 1. Hero Action: placing 2 counters on your
 *   Creeping Corruption is the cost (`costEffects`), then discard it. Alter-Ego Action: spend 3 [mental], then discard it
 *   and remove 1 counter.
 * **65066 Fist** (minion): Patrol and Retaliate 2 are data. Hero Action: placing 1 counter is the cost, then 4 damage to Fist.
 * **65068 Retainer** (minion): his attacks gain overkill; the same interrupt as Krahllak.
 *
 * Cards (12):
 * - 65057 Krahllak (villain)
 * - 65060a Dark Invitation (main_scheme)
 * - 65062 Dark Shroud (attachment)
 * - 65063 Fear Projection (attachment)
 * - 65064 Mark of the Wicked (attachment)
 * - 65065 Pull of Power (attachment)
 * - 65066 Fist (minion)
 * - 65067 Hellbride (minion)
 * - 65068 Retainer (minion)
 * - 65069 Snakeroot Elders (minion)
 * - 65070 Veil of Nightmares (side_scheme)
 * - 65071 Submit or Suffer (treachery)
 */
/**
 * "[star] Interrupt: When [X] attacks you, you may place 1 corruption counter on your Creeping Corruption. If you do, [X]
 * gets -3 ATK for this attack." (Krahllak I to III, Retainer).
 */
const corruptionInterrupt = () =>
  interrupt(
    on.enemyAttacks("self", { againstYou: true }),
    { while: youHaveCreepingCorruption },
    addCounters(CORRUPTION, 1, YOUR_CREEPING_CORRUPTION, { bind: "placed" }),
    // "If you do": only a counter that was placed.
    ifThen(varAtLeast("placed.amount", 1), modifyAttack({ atkBonus: -3 })),
  );
const OVERPOWERING = trait("OVERPOWERING");
/** Whether `player`'s Creeping Corruption shows the Overpowering trait (72B); false for a player with none. */
const hasOverpowering = (player: PlayerRef) => hasTrait(creepingCorruptionOf(player), OVERPOWERING);
const OWN_ATTACKS = { attacker: { self: true } } as const;
const CREEPING_CORRUPTION_CARD = query("upgrade", { name: "Creeping Corruption" });
/** "Each player chooses: place `n` corruption counter(s) on their Creeping Corruption, or <other>." */
const eachPlayerChoosesCorruptionOr = (n: number, label: string, ...other: Parameters<typeof option>[1][]) =>
  forEachPlayer(
    eachPlayer,
    chooseOneBy(
      thatPlayer,
      option(
        n === 1
          ? "Place 1 corruption counter on your Creeping Corruption"
          : `Place ${n} corruption counters on your Creeping Corruption`,
        { when: hasCreepingCorruption(thatPlayer) },
        placeCorruption(n, thatPlayer),
      ),
      option(label, ...other),
    ),
  );

export const SHADOWLAND_HEART_OF_SHADOW: AbilityRegistry = defineAbilities({
  "65057.krahllak-interrupt": corruptionInterrupt(),
  "65058.krahllak-constant": constant(attacksGainKeywords(["overkill"], OWN_ATTACKS)),
  "65058.krahllak-interrupt": corruptionInterrupt(),
  "65059.krahllak-constant": constant(attacksGainKeywords(["overkill", "piercing"], OWN_ATTACKS)),
  "65059.krahllak-interrupt": corruptionInterrupt(),

  // Dark Invitation 1A. "Each player puts a Creeping Corruption upgrade into play. Set the rest aside." Each player with
  // none takes one of the copies out of the set-aside area (an upgrade enters play on its controller's identity); the
  // rest stay where they are. This needs the scenario builder to create the Creeping Corruption copies set aside and
  // held back from Appendix II step 11 (`setAsideUntilCalled`): a Setup-keyword copy left in the encounter deck is put
  // into the first player's area at step 11, all four of them, before this text resolves.
  "65060a.setup": setup(
    forEachPlayer(
      eachPlayer,
      ifThen(not(hasCreepingCorruption(thatPlayer)), [
        // The copies are identical: one at random is the first.
        selectCards("cc", encounterSetAside(CREEPING_CORRUPTION_CARD, { random: 1 })),
        putIntoPlay(chosen("cc"), thatPlayer),
      ]),
    ),
  ),
  "65060b.dark-invitation-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting("self"),
    instead(
      removeThreat(threatOn(self), self),
      eachPlayerChoosesCorruptionOr(
        2,
        "Take 3 damage and deal yourself 1 facedown encounter card",
        takeDamage(3, thatPlayer),
        dealEncounterCard(thatPlayer),
      ),
    ),
  ),
  "65060b.dark-invitation-forced-response": forcedResponse(
    on.defeated(query("villain", { name: "Krahllak" })),
    advanceMainScheme({ to: { stageNumber: 2 } }),
  ),
  "65061a.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      ifThen(hasOverpowering(thatPlayer), discardAtRandom(1, thatPlayer), [
        chooseTarget(
          "discarded",
          query(["ally", "support", "upgrade", "sideScheme"], {
            controlledBy: thatPlayer,
            withoutKeyword: "permanent",
          }),
          {
            chooser: thatPlayer,
          },
        ),
        discard(chosen("discarded")),
      ]),
    ),
    ifThen(inMode("expert"), dealEncounterCard(eachPlayer)),
  ),
  "65061b.beast-be-praised-forced-response": forcedResponse(
    on.villainStepResolved(),
    eachPlayerChoosesCorruptionOr(1, "Place 3 threat here", placeThreat(3, self)),
  ),

  "65062.dark-shroud-interrupt": interrupt(
    {
      ...on.damage("host", { fromAttack: true }),
      eventAtLeast: { amount: 4 },
      // "You or an ally you control" (RRG 1.8 "You, Your", p. 49: your identity and the cards that extend it): the damage's
      // source is a player's character or its extension, and the player offered the interrupt is that damage's player.
      sourceIs: { actsFor: query(["identity", "ally"]) },
    },
    { wouldBeDealt: true },
    preventDamage(),
    placeCorruption(1),
    discard(self),
  ),

  "65063.fear-projection-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, { hostOfSelf: true })),
  "65063.fear-projection-action": heroAction(
    { while: youHaveCreepingCorruption, costEffects: 1 },
    placeCorruption(2),
    discard(self),
  ),
  "65063.fear-projection-alter-ego-action": alterEgoAction(
    { cost: spend({ mental: 3 }) },
    discard(self),
    removeCorruption(1),
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

  "65066.fist-action": heroAction(
    { while: youHaveCreepingCorruption, costEffects: 1 },
    placeCorruption(1),
    dealDamage(4, self),
  ),

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

  "65068.retainer-constant": constant(attacksGainKeywords(["overkill"], OWN_ATTACKS)),
  "65068.retainer-interrupt": corruptionInterrupt(),

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
      // Barred when the identity cannot take the status (RRG 1.8 "Choose (Option)", p. 12; "Target", p. 42).
      option(
        "Stun your identity",
        chooseTarget("identity", query("identity", { controller: "you", ...canTakeStatus("stunned") })),
        stun(chosen("identity")),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const SHADOWLAND_HEART_OF_SHADOW_SKIPPED: Readonly<Record<string, string>> = {};
