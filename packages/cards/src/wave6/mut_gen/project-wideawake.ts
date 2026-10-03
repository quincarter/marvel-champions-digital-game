import { trait } from "@mc/content";
import type { RuleSpec } from "@mc/engine";
import {
  action,
  allOf,
  alterEgoAction,
  andThen,
  attachCard,
  attacksGainKeywords,
  boost,
  chooseCards,
  chooseOne,
  constant,
  coveredByEngineRule,
  cards,
  countAmong,
  damageAnEnemy,
  dealDamage,
  dealEncounterCard,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  encounterCards,
  encounterSetAside,
  endGame,
  enemyAttack,
  eventTarget,
  excludedFromAllyLimit,
  exhaust,
  exhaustThis,
  exhaustYourHero,
  firstPlayer,
  flipCard,
  forcedResponse,
  gainsKeyword,
  gets,
  heal,
  heroAction,
  named,
  on,
  option,
  otherPlayers,
  perHero,
  putIntoPlay,
  query,
  refMatches,
  removeStatus,
  removeThreat,
  response,
  revealCard,
  rule,
  searchAndReveal,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spend,
  stateCheck,
  takesConsequentialDamage,
  theVillain,
  threatOn,
  topOfDeck,
  tuckCards,
  tuckedUnderRef,
  valueAtLeast,
  varAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  yourIdentity,
  chosen,
  giveTough,
  ifThen,
} from "../../dsl/index.js";
import { discardThisObligation } from "../../core/obligations.js";

const SENTINEL = trait("SENTINEL");
const CAPTIVE = trait("CAPTIVE");

/** "Operation Zero Tolerance" (32104): the side scheme the scenario's facedown cards go under. */
const OZT = named("Operation Zero Tolerance");
const THE_VILLAIN_HOST = query("villain", { hostOfSelf: true });

/** "When your turn ends" (`wave2/trors/campaign-cards.ts`, `wave4/mts/spectrum-obligation-nemesis.ts`): no `on.*` wrapper. */
const turnEnding = { on: "turnEnding", playerIs: "controller" } as const;

/** Sentinel (I)'s search, shared by all three stages: "The first player searches the encounter deck and discard pile
 * for a copy of the Abduction Protocols side scheme and reveals it. (Shuffle.)" */
const searchAbductionProtocols = () => searchAndReveal("Abduction Protocols", ["deck", "discard"], firstPlayer);

/**
 * The Project Wideawake scenario's own encounter set (`mut_gen` 32084-32100, MC32 p. 9, docs/phase7-wave6.md §2.2):
 * the Sentinel villain (32084-32086), the main scheme Night of the Sentinels (32087a/b), Mutants at the Mall and the
 * Jubilee it flips into (32088a/b), the four Captive allies (32089-32092), Sentinel Mark IV, Gauntlet Beam,
 * Learning A.I., Adaptive Armor, Self-Repair, Mutant Detected, Warn the Others and Abduction Protocols. Operation
 * Zero Tolerance (32104) is scripted here too: it belongs to the Zero Tolerance set but is the scenario's own side
 * scheme (every card in this file puts cards under it).
 *
 * **"Set each [Captive] ally aside"** (32087a Setup) is the scenario builder's `SETASIDE_BY_SCENARIO`
 * (`../setup.ts`), as Taskmaster's Captive allies are (`wave2/setup.ts`): the Captive allies carry no
 * `encounterSetIds`, so no sweep of the encounter sets would put them in the game to be set aside.
 *
 * **Standalone, a Captive ally is ownerless** (docs/phase7-wave6.md §4.1 Q41): Abduction Protocols puts it into play
 * under the defeating player's control; when it leaves play it goes to the encounter discard pile.
 *
 * **Cannonball** (32091): "-1 consequential damage after he attacks and defeats a minion" is a `reduceDamageTaken`
 * scoped to his attack's consequential damage (docs/phase7-wave6.md §3.31), read as that damage is applied, after the
 * attack has reported into it: `attack.defeated`, and a minion among the characters it damaged (`attack.damaged`; read
 * `anywhere`, since the defeated minion is in the discard pile by then). Defeating a villain stage does not count.
 *
 * **Not scripted** (`KNOWN_SKIPPED`, `../coverage.test.ts`): Boom Boom (32090, needs a per-enemy damage amount).
 */
export const PROJECT_WIDEAWAKE_ABILITIES = defineAbilities({
  // Sentinel (I) — Toughness (data). When Revealed: search for Abduction Protocols and reveal it.
  "32084.when-revealed": whenRevealed(searchAbductionProtocols()),
  // Sentinel (II) — Steady. Toughness (data). When Revealed: as (I), then deal each other player a facedown
  // encounter card.
  "32085.when-revealed": whenRevealed(searchAbductionProtocols(), dealEncounterCard(otherPlayers(firstPlayer))),
  // Sentinel (III) — Stalwart. Toughness (data). When Revealed: as (II).
  "32086.when-revealed": whenRevealed(searchAbductionProtocols(), dealEncounterCard(otherPlayers(firstPlayer))),

  // Night of the Sentinels 1A — Setup: (Captive allies set aside by the scenario builder, above.) Reveal the
  // Operation Zero Tolerance and Mutants at the Mall side schemes.
  "32087a.setup": setup(
    searchAndReveal("Operation Zero Tolerance", ["deck"], firstPlayer),
    searchAndReveal("Mutants at the Mall", ["deck"], firstPlayer),
  ),
  // 1B — Operation Zero Tolerance gains permanent.
  "32087b.night-of-the-sentinels-constant": constant(
    gainsKeyword({ name: "permanent" }, query("sideScheme", { name: "Operation Zero Tolerance" })),
  ),
  // 1B — Forced Response: After threat is placed here, if there is at least 5[per_hero] threat here, the first player
  // places the top card of their deck facedown under Operation Zero Tolerance. Then, remove 5[per_hero] threat.
  "32087b.night-of-the-sentinels-forced-response": forcedResponse(
    on.threatPlaced("self"),
    ifThen(valueAtLeast(threatOn(self), perHero(5)), [
      tuckCards(topOfDeck(1, firstPlayer), OZT, true),
      andThen(removeThreat(perHero(5), self)),
    ]),
  ),

  // Mutants at the Mall (32088a) — When Defeated: the first player searches the encounter deck and discard pile for a
  // Sentinel minion and reveals it. Flip this card and put Jubilee into play, discarding any other ally version of
  // Jubilee from play (RRG 1.8 errata p. 68). Flipping into the ally face is "put Jubilee into play"
  // (`wave4/mts/mts-campaign-cards.ts`'s Cosmo: the new face enters under the first player's control).
  "32088a.when-defeated": whenDefeated(
    chooseCards("found", encounterCards(["deck", "discard"], query("minion", { trait: SENTINEL })), {
      min: 1,
      max: 1,
      chooser: firstPlayer,
    }),
    revealCard(chosen("found"), firstPlayer),
    shuffleEncounterDeck(),
    discard(each(query("ally", { name: "Jubilee" }))),
    flipCard(self),
  ),
  // Jubilee (32088b) — Victory -1 (data). The first player controls Jubilee. She does not count against your ally limit.
  "32088b.jubilee-constant": constant(
    rule({ kind: "controlledByFirstPlayer", target: { self: true } } as RuleSpec),
    excludedFromAllyLimit({ self: true }),
  ),
  // Action: Exhaust Jubilee and spend a [energy] resource → deal 2 damage to an enemy.
  "32088b.jubilee-action": action({ cost: [exhaustThis, spend({ energy: 1 })] }, damageAnEnemy(2)),

  // Rictor (32089) — [star] Response: After Rictor attacks, deal 1 damage to the villain and each minion engaged with you.
  "32089.rictor-response": response(
    on.attacks("self"),
    dealDamage(1, each({ anyOf: [query("villain"), query("minion", { engagedWith: "you" })] })),
  ),
  // Cannonball (32091) — [star] Cannonball takes -1 consequential damage after he attacks and defeats a minion.
  "32091.cannonball-constant": constant(
    rule(
      takesConsequentialDamage({ self: true }, -1, {
        from: "attack",
        if: allOf(
          varAtLeast("attack.defeated"),
          refMatches({ kind: "slot", slot: "attack.damaged" }, query("minion"), { anywhere: true }),
        ),
      }),
    ),
  ),
  // Wolfsbane (32092) — [star] Wolfsbane's attacks gain piercing.
  "32092.wolfsbane-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),

  // Sentinel Mark IV (32093) — Guard. Patrol (data). [star] Boost: Put Sentinel Mark IV into play engaged with you.
  "32093.boost": boost(putIntoPlay(self, you)),

  // Gauntlet Beam (32094) — Attach to the villain (data; +1 ATK is data). [star] The villain's attacks gain piercing
  // and ranged. Hero Action: Spend [physical][physical][physical] → discard this card. [star] Boost: Exhaust your identity.
  "32094.gauntlet-beam-constant": constant(attacksGainKeywords(["piercing", "ranged"], { attacker: THE_VILLAIN_HOST })),
  "32094.gauntlet-beam-action": heroAction({ cost: spend({ physical: 3 }) }, discard(self)),
  "32094.boost": boost(exhaust(yourIdentity)),

  // Learning A.I. (32095) — Attach to the villain (data; +1 SCH is data). The villain gains retaliate 1. Hero Action:
  // Spend [mental][mental][mental] → discard. [star] Boost: Attach this card to the villain.
  "32095.learning-ai-constant": constant(gainsKeyword({ name: "retaliate", value: 1 }, THE_VILLAIN_HOST)),
  "32095.learning-ai-action": heroAction({ cost: spend({ mental: 3 }) }, discard(self)),
  "32095.boost": boost(attachCard(self, theVillain)),

  // Adaptive Armor (32096) — Attach to the villain (data). The villain gets +8 hit points. Hero Action:
  // Spend [energy][energy][energy] → discard. [star] Boost: Attach this card to the villain.
  "32096.adaptive-armor-constant": constant(gets("hp", 8, THE_VILLAIN_HOST)),
  "32096.adaptive-armor-action": heroAction({ cost: spend({ energy: 3 }) }, discard(self)),
  "32096.boost": boost(attachCard(self, theVillain)),

  // Self-Repair (32097) — When Revealed: Discard each status card from the villain. Give the villain a tough status
  // card and heal 5 damage from it. [star] Boost: Give the villain a tough status card.
  "32097.when-revealed": whenRevealed(
    removeStatus(theVillain, "stunned"),
    removeStatus(theVillain, "confused"),
    removeStatus(theVillain, "tough"),
    giveTough(theVillain),
    heal(5, theVillain),
  ),
  "32097.boost": boost(giveTough(theVillain)),

  // Mutant Detected (32098) — When Revealed: Choose: place the top card of your deck facedown under Operation Zero
  // Tolerance; or the villain and each minion engaged with you attack you (even if you are in alter-ego form:
  // `enemyAttack` is an attack whatever the form, `wave5/nova/obligation-nemesis.ts` War Delivery).
  "32098.when-revealed": whenRevealed(
    chooseOne(
      option(
        "Place the top card of your deck facedown under Operation Zero Tolerance",
        tuckCards(topOfDeck(1, you), OZT, true),
      ),
      option(
        "The villain and each minion engaged with you attack you",
        enemyAttack(theVillain, { against: you }),
        enemyAttack(each(query("minion", { engagedWith: "you" })), { against: you }),
      ),
    ),
  ),

  // Warn the Others (32099, obligation) — Forced Response: After your turn ends, place this card facedown under
  // Operation Zero Tolerance. Alter-Ego Action: Exhaust your identity → discard this card.
  "32099.obligation": coveredByEngineRule(),
  "32099.warn-the-others-forced-response": forcedResponse(turnEnding, tuckCards(cards(self), OZT, true)),
  "32099.warn-the-others-action": alterEgoAction({ cost: exhaustYourHero }, discardThisObligation),

  // Abduction Protocols (32100) — Hinder 2[per_hero]. Victory 2 (data). When Defeated: The player who defeated this
  // scheme takes 1 random set-aside Captive ally and puts it into play under their control.
  "32100.when-defeated": whenDefeated(
    selectCards("captive", encounterSetAside(query("ally", { trait: CAPTIVE }), { random: 1 })),
    putIntoPlay(chosen("captive"), defeatingPlayer),
  ),

  // Operation Zero Tolerance (32104) — Forced Response: After an enemy attacks and defeats an ally, place that ally
  // facedown under this scheme. The card selector names the ally by the event, not by a zone, so it is found wherever it
  // ended up (RRG FAQ "Operation Zero Tolerance (#104)", p. 63). A facedown Drone's attack is no different (ruling
  // Jan 26, 2026 (4) #5: the facedown side is not in play and does not matter).
  "32104.operation-zero-tolerance-forced-response": forcedResponse(
    on.defeated({ categories: ["ally"] }, { byAttackFrom: { categories: ["enemy"] } }),
    tuckCards(cards(eventTarget), self, true),
  ),
  // If there are X facedown cards under this scheme, the players lose the game. X is 3 more than the number of players.
  "32104.operation-zero-tolerance-constant": stateCheck(
    valueAtLeast(countAmong(tuckedUnderRef(self), {}), perHero(1, 3)),
    endGame("loss"),
  ),
});
