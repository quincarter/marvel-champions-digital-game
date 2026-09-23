import {
  activationIs,
  adjustBoostCount,
  attachCard,
  boost,
  cancelWhenRevealed,
  chooseOne,
  constant,
  controllerOf,
  dealEncounterCardsCost,
  defineAbilities,
  discard,
  each,
  encounterCards,
  encounterSetAside,
  enemyAttack,
  enemyScheme,
  exhaustCardsCost,
  exists,
  firstPlayer,
  firstPlayerAction,
  forcedInterrupt,
  gainsKeyword,
  giveBoostCard,
  giveTough,
  hasAttachment,
  hasStatus,
  heroAction,
  identityOf,
  ifThen,
  interrupt,
  made,
  modifyAttack,
  moveCards,
  named,
  not,
  on,
  option,
  placeThreat,
  putIntoPlay,
  query,
  removeCountersFrom,
  removeThreat,
  rule,
  searchAndReveal,
  selectCards,
  setup,
  spend,
  spendSameType,
  surge,
  takeDamage,
  takeDamageCost,
  theMainScheme,
  theVillain,
  cards,
  chosen,
  self,
  atEndOfAttack,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  exhaust,
} from "../../dsl/index.js";

/**
 * Ronan the Accuser: the villain Ronan the Accuser I–III (16103–16105), the main scheme Interception Imminent →
 * "Take What Is Mine" (16106–16107), Kree Command Ship (16108), Universal Weapon (16109), Fanaticism (16110), the
 * side schemes Cut the Power/Pincer Maneuver/Superior Tactics (16111–16113), the treacheries Single-Minded Fury/
 * Kree Physiology/"You Stand Accused!" (16114–16116), and the Kree Militants modular set (16131–16134). Power Stone
 * (16149, shared with Nebula) is scripted in `nebula.ts`, where it landed first.
 *
 * **"Attach the Power Stone to the first player" (16106a's own Setup text) is not redundant.** Unlike Nebula's own
 * Setup text (`gmw/nebula.ts`'s own docblock), the Power Stone's `setup` keyword only auto-attaches it to *the
 * villain* by default (RRG 1.8 Appendix II step 11) — Ronan's own Setup text moves it again, to the first player's
 * identity, which `attachCard` does regardless of the stone's current host.
 *
 * **"Ronan the Accuser activates against you, give him 1 additional boost card if you control the Power Stone"**
 * (16103–16105, identical text on all three stages): "you" is the villain-phase player the activation concerns —
 * the same reading `gmw/nebula.ts`'s own Forced Interrupt docblock uses for the same shape — and "you control the
 * Power Stone" is read as "the Power Stone is attached to your identity" (docs/phase7-wave3.md §3.19, §4 Q11:
 * encounter cards are controlled by the scenario, RRG 1.8 "Ownership and Control" p. 31, so the printed "control"
 * has to mean the attachment relationship MC16 p. 15's own campaign text uses the same wording for).
 *
 * **`16114.when-revealed`** ("Ronan the Accuser attacks the player who controls the Power Stone (even if that
 * player is in alter-ego form). If no attack was made this way, this card gains surge.") — docs/phase7-wave3.md
 * §3.39/§3.40, §4 Q11: "controls the Power Stone" is "the Power Stone is attached to that player's identity",
 * `controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" }))))`. With the stone on the villain
 * (an encounter card, controlled by the scenario, RRG 1.8 "Ownership and Control" p. 31) the ref names nobody,
 * `enemyAttack` makes no attack against an empty `against`, and the card's own sentence gives the surge.
 *
 * **`16131.kree-combat-armor-action`** ("Hero Action: Spend 3 resources of the same type → discard this card.") —
 * docs/phase7-wave3.md §3.43: `AbilityCost.sameResourceType` (`spendSameType(3)`), the payer's choice of type, a
 * wild counting as any type.
 */

const exhaustMilano = exhaustCardsCost(query("support", { name: "Milano" }));
const POWER_STONE_ON_VILLAIN = query("attachment", { name: "Power Stone", host: theVillain });

/** "[star] Forced Interrupt: When Ronan the Accuser activates against you, give him 1 additional boost card if
 * you control the Power Stone." — identical text on all three stages. */
const ronanBoostsIfYouControlPowerStone = () =>
  forcedInterrupt(
    on.enemySchemesOrAttacks("self"),
    ifThen(
      exists(query("attachment", { name: "Power Stone", host: yourIdentity })),
      modifyAttack({ extraBoostCards: 1 }),
    ),
  );

export const RONAN = defineAbilities({
  // Villain: Ronan the Accuser I/II/III (16103–16105) ---------------------------------------------------------

  // Ronan I — Toughness (data). Forced Interrupt as above.
  "16103.ronan-the-accuser-forced-interrupt": ronanBoostsIfYouControlPowerStone(),

  // Ronan II — Toughness (data). When Revealed: search for and reveal Cut the Power (shuffle). Same Forced
  // Interrupt as I.
  "16104.when-revealed": whenRevealed(...searchAndReveal("Cut the Power")),
  "16104.ronan-the-accuser-forced-interrupt": ronanBoostsIfYouControlPowerStone(),

  // Ronan III — Retaliate 1. Toughness (data). When Revealed: search for and reveal Superior Tactics (shuffle).
  // Same Forced Interrupt as I/II.
  "16105.when-revealed": whenRevealed(...searchAndReveal("Superior Tactics")),
  "16105.ronan-the-accuser-forced-interrupt": ronanBoostsIfYouControlPowerStone(),

  // Main scheme: Interception Imminent → "Take What Is Mine" (16106–16107) -----------------------------------

  // 1A — Setup: Put the Kree Command Ship environment and the Milano support into play. Attach the Universal
  // Weapon to Ronan the Accuser. Attach the Power Stone to the first player (module docblock: not redundant with
  // the engine's own villain-default auto-attach).
  "16106a.setup": setup(
    selectCards("ship", encounterCards(["deck"], { name: "Kree Command Ship" })),
    putIntoPlay(chosen("ship"), firstPlayer),
    selectCards("milano", encounterSetAside({ name: "Milano" })),
    putIntoPlay(chosen("milano"), firstPlayer),
    selectCards("weapon", encounterCards(["deck"], { name: "Universal Weapon" })),
    attachCard(chosen("weapon"), theVillain),
    attachCard(named("Power Stone"), identityOf(firstPlayer)),
  ),
  // 1B — First Player Action: Exhaust the Milano → remove 3 threat from this scheme.
  "16106b.interception-imminent-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // 2A — When Revealed: Attach the Power Stone to Ronan the Accuser. If it is already attached to him, give him 1
  // facedown boost card. (Checked before the attach, the same "already" shape used throughout this pack.)
  "16107a.when-revealed": whenRevealed(
    ifThen(exists(POWER_STONE_ON_VILLAIN), giveBoostCard(theVillain)),
    attachCard(named("Power Stone"), theVillain),
  ),
  // 2B — While the Power Stone is attached to Ronan the Accuser, threat cannot be removed from this scheme. ("If
  // this stage is completed, the players lose the game" is the RRG 1.8 "Villain Defeat" (p. 47) default for a
  // main scheme's final stage — no ability ref for it, matching every other cycle 2 final-stage scheme.)
  "16107b.take-what-is-mine-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: { self: true }, while: exists(POWER_STONE_ON_VILLAIN) }),
  ),

  // Kree Command Ship (16108, environment) ---------------------------------------------------------------------

  // First Player Interrupt: When a treachery card is revealed from the encounter deck, exhaust the Milano and
  // spend 1 resource of any type → cancel that card's "When Revealed" effects.
  "16108.kree-command-ship-constant": interrupt(
    on.encounterCardRevealed(query("treachery")),
    { firstPlayerOnly: true, cost: [exhaustMilano, spend(1)] },
    cancelWhenRevealed(),
  ),

  // Universal Weapon (16109, attachment; Attach to Ronan the Accuser is data-driven) ----------------------------

  // Ronan the Accuser gains stalwart.
  "16109.universal-weapon-constant": constant(gainsKeyword({ name: "stalwart" }, { hostOfSelf: true })),
  // Hero Action: Take 2 damage and deal yourself 1 facedown encounter card → shuffle Universal Weapon into the
  // encounter deck.
  "16109.universal-weapon-action": heroAction(
    { cost: [takeDamageCost(2), dealEncounterCardsCost(1)] },
    moveCards(cards(self), "encounterDeckShuffle"),
  ),
  // [star] Boost: Attach Universal Weapon to Ronan the Accuser.
  "16109.boost": boost(attachCard(self, theVillain)),

  // Fanaticism (16110, attachment; Attach to Ronan the Accuser, Surge, Uses are data-driven) --------------------

  // [star] Forced Interrupt: When Ronan the Accuser attacks you, that attack gains overkill and piercing. At the
  // end of that attack, remove 1 fury counter from here.
  "16110.fanaticism-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("host", { againstYou: true }),
    modifyAttack({ keywords: ["overkill", "piercing"] }),
    atEndOfAttack(removeCountersFrom(self, "fury", 1)),
  ),

  // Cut the Power (16111, side scheme; crisis icon is data-driven) ---------------------------------------------

  // [star] Boost: Choose to either exhaust the Milano or place 2 threat on the main scheme.
  "16111.boost": boost(
    chooseOne(
      option("Exhaust the Milano", exhaust(named("Milano"))),
      option("Place 2 threat on the main scheme", placeThreat(2, theMainScheme)),
    ),
  ),

  // Pincer Maneuver (16112, side scheme; Hinder is data-driven) ------------------------------------------------

  // First Player Action: Exhaust the Milano → remove 3 threat from this scheme.
  "16112.pincer-maneuver-constant": firstPlayerAction({ cost: exhaustMilano }, removeThreat(3, self)),

  // Superior Tactics (16113, side scheme) ----------------------------------------------------------------------

  // The Power Stone cannot be unattached from Ronan the Accuser.
  "16113.superior-tactics-constant": constant(rule({ kind: "cannotBeUnattached", target: { name: "Power Stone" } })),
  // When Revealed: Attach the Power Stone to Ronan the Accuser. If it is already attached to him, place 1[per_hero]
  // threat here. (Checked before the attach, same "already" shape as 16107a above.)
  "16113.when-revealed": whenRevealed(
    ifThen(exists(POWER_STONE_ON_VILLAIN), placeThreat(1, self)),
    attachCard(named("Power Stone"), theVillain),
  ),

  // Single-Minded Fury (16114, treachery) — When Revealed: Ronan attacks the player who controls the Power Stone
  // (even if that player is in alter-ego form). If no attack was made this way, this card gains surge (module
  // docblock, docs/phase7-wave3.md §3.39/§3.40, §4 Q11).
  "16114.when-revealed": whenRevealed(
    enemyAttack(theVillain, {
      against: controllerOf(each(query("identity", hasAttachment({ name: "Power Stone" })))),
      bind: "fury",
    }),
    ifThen(not(made("fury")), surge()),
  ),
  // [star] Boost: Attach the Power Stone to Ronan the Accuser.
  "16114.boost": boost(attachCard(named("Power Stone"), theVillain)),

  // Kree Physiology (16115, treachery; Surge is data-driven) ---------------------------------------------------

  // When Revealed: Give Ronan the Accuser a tough status card. If he already has a tough status card, take 1
  // damage. (Checked before the give, same shape as 16107a/16113 above.)
  "16115.when-revealed": whenRevealed(
    ifThen(hasStatus(theVillain, "tough"), takeDamage(1, you)),
    giveTough(theVillain),
  ),

  // "You Stand Accused!" (16116, treachery) --------------------------------------------------------------------

  // When Revealed (Alter-Ego): Ronan the Accuser schemes with +1 SCH. When Revealed (Hero): Ronan the Accuser
  // attacks you with +1 ATK. [star] Boost: Give the villain 1 additional boost card for this activation.
  "16116.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain, { schBonus: 1 })),
  "16116.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you, atkBonus: 1 })),
  "16116.boost": boost(modifyAttack({ extraBoostCards: 1 })),

  // Kree Militants (modular: 16131–16134) ----------------------------------------------------------------------

  // Kree Combat Armor — Attach to the enemy with the highest ATK (data-driven `attachesTo`). Reduce the amount of
  // damage attached character takes from each attack by 1.
  "16131.kree-combat-armor-constant": constant(
    rule({ kind: "reduceDamageTaken", target: { hostOfSelf: true }, amount: 1, fromAttack: true }),
  ),
  // Hero Action: Spend 3 resources of the same type → discard this card (module docblock, docs/phase7-wave3.md
  // §3.43).
  "16131.kree-combat-armor-action": heroAction({ cost: spendSameType(3) }, discard(self)),

  // Kree Commando — Patrol (data). [star] Boost: If this is an attack, this attack gains piercing.
  "16132.boost": boost(ifThen(activationIs("attack"), modifyAttack({ keywords: ["piercing"] }))),

  // Kree Lieutenant — Guard. Stalwart. (data). [star] Boost: If this activation is an attack, this card gets +3
  // boost icons for this activation.
  "16133.boost": boost(ifThen(activationIs("attack"), adjustBoostCount(3))),

  // Kree Private — Quickstrike (data). [star] Boost: If this activation is an attack, this attack gains overkill.
  "16134.boost": boost(ifThen(activationIs("attack"), modifyAttack({ keywords: ["overkill"] }))),
});
