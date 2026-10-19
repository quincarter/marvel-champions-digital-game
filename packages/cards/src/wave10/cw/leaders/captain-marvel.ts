import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  applyRuleUntil,
  andThen,
  attachCard,
  boost,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  dealEncounterCard,
  defineAbilities,
  discard,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  eventSource,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  heal,
  heroResponse,
  ifThen,
  on,
  oneCopyOf,
  placeThreat,
  query,
  reduceDamageTo,
  removeEachCounterFrom,
  revealCard,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  spendSameType,
  theVillain,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  each,
  named,
  you,
} from "../../../dsl/index.js";

const ENERGY_CHANNEL = named("Energy Channel");
const ENERGY = "energy";
const ENERGY_ON_CHANNEL = countersOn(ENERGY_CHANNEL, ENERGY);
const CAPTAIN_MARVEL = query("villain", { name: "Captain Marvel" });
const HOST_VILLAIN = query("villain", { hostOfSelf: true });

/** "Place 1 energy counter on Energy Channel." Nothing happens if the card is not in play. */
const energyCounters = (n: number) => addCounters(ENERGY, n, ENERGY_CHANNEL);

/**
 * Setup of stages I and III: "The enemy team finds Energy Channel and attaches it to Captain Marvel." One copy is in
 * the set, so the find has nothing to decide and no prompt is shown (docs/phase7-wave10.md section 2.3, 3.5); a search
 * shuffles the encounter deck after it (RRG 1.8 "Search", p. 39). Energy Channel is Permanent: it never reaches a
 * discard pile.
 */
const captainMarvelSetup = () =>
  setup(
    selectCards("channel", oneCopyOf(encounterCards(["deck"], query("attachment", { name: "Energy Channel" })))),
    attachCard(chosen("channel"), theVillain),
    shuffleEncounterDeck(),
  );

/**
 * Every stage: "Forced Response: After Captain Marvel attacks and defeats a character, place 1 energy counter on Energy
 * Channel." Once per character defeated, so an overkill attack that defeats an ally and then the identity places two
 * (FFG ruling Jan 11, 2026, R1 and R2, docs/phase7-wave10.md section 3.22).
 */
const captainMarvelForcedResponse = () =>
  forcedResponse(on.defeated(query("character"), { byAttackFrom: CAPTAIN_MARVEL }), energyCounters(1));

/**
 * Stages II and IV: "When Revealed: Deal each player an encounter card. Captain Marvel cannot take damage this phase."
 * The stage is revealed when the one before it is defeated, in the player phase, so the lasting effect covers the rest
 * of that phase (the same card text as Spider-Woman's, docs/phase7-wave10.md section 3.7).
 */
const advancedWhenRevealed = () =>
  whenRevealed(
    dealEncounterCard(eachPlayer),
    applyRuleUntil({ kind: "cannotTakeDamage", target: CAPTAIN_MARVEL }, "endOfPhase"),
  );

/**
 * Cosmic Flight: "When Captain Marvel would take more than 3 damage from an attack, reduce that amount to 3. Then, discard
 * this card." The trigger needs the damage pending to be 4 or more, and the effect lowers that pending amount to 3.
 *
 * Two copies on one hit (owner's answer to question 29 = B, 2026-10-12; an interpretation of the RRG, not an FFG ruling
 * on this card): the first copy to resolve changes the damage that would be taken to 3, and "further interrupts to the
 * original triggering condition cannot be triggered" (RRG 1.8 "Interrupt", p. 25; "Replacement Effect", p. 37: a
 * replaced effect "is no longer considered imminent"). The engine reads the second copy's condition again against the
 * 3 now pending, which is not more than 3, so it does not resolve and stays attached for the next such hit. "Then"
 * (RRG 1.8 "'Then'", p. 44) ties the discard to the reduction, so a copy that reduces nothing is not discarded.
 *
 * With a tough status card on her, the tough card resolves first and prevents the damage (RRG 1.8 "Ability",
 * "Simultaneous Timing Priority", p. 5: status card Forced Interrupts come before Forced Interrupts), so this card
 * does not trigger and stays.
 */
const cosmicFlight = () =>
  forcedInterrupt(
    { ...on.damage("host", { fromAttack: true }), eventAtLeast: { amount: 4 } },
    reduceDamageTo(3),
    andThen(discard(self)),
  );

/**
 * Captain Marvel, the Registration leader (MC56 p. 3, docs/phase7-wave10.md section 2.3, 3.7, 3.20, 3.22): a villain in
 * a cooperative game; her four stages 56092 to 56095 (I and II standard, III and IV expert) and her encounter set
 * 56098 to 56104 (set "Captain Marvel").
 *
 * **Energy Channel (56098)**: Permanent, holding energy counters. As corrected by RRG 1.8 (p. 70) the cost arrow is
 * gone: at 4 or more counters all of them are removed and Captain Marvel attacks that character, the attack gaining
 * overkill, whether or not the attacker is still in play. "A leader" (MC56 p. 20, competitive only) matches no attack
 * in a cooperative game: no leader attacks her, so only a hero or an ally is heard.
 *
 * **Captain Marvel's Helmet (56099)**: unique, and it matches the Core upgrade 01016, so a revealed copy is discarded
 * and the player is dealt a facedown card when 01016 is in play (RRG 1.8 "Unique Icon", pp. 45-46; the Captain Marvel
 * hero may face the Captain Marvel leader, owner's answer to question 5 = A). Its Hero Response needs 3 resources of
 * the same type.
 *
 * **Cosmic Flight (56100)**: a Forced Interrupt on an attack's damage to her, 4 or more is lowered to 3 and the card
 * discarded; 3 or less is untouched and the card stays. Of two copies only one answers a hit (question 29 = B).
 *
 * **Photonic Blast (56101)**, **Crisis Interdiction (56102)**, **Energy Absorption (56103)** and **Alpha Flight Station
 * (56104)** place counters on Energy Channel; the first three heal or hurt as printed.
 *
 * Cards (8):
 * - 56092 Captain Marvel (villain)
 * - 56098 Energy Channel (attachment)
 * - 56099 Captain Marvel's Helmet (attachment)
 * - 56100 Cosmic Flight (attachment)
 * - 56101 Photonic Blast (treachery)
 * - 56102 Crisis Interdiction (treachery)
 * - 56103 Energy Absorption (treachery)
 * - 56104 Alpha Flight Station (side_scheme)
 */
export const LEADERS_CAPTAIN_MARVEL: AbilityRegistry = defineAbilities({
  "56092.setup": captainMarvelSetup(),
  "56092.captain-marvel-forced-response": captainMarvelForcedResponse(),
  "56093.when-revealed": advancedWhenRevealed(),
  "56093.captain-marvel-forced-response": captainMarvelForcedResponse(),
  "56094.setup": captainMarvelSetup(),
  "56094.captain-marvel-forced-response": captainMarvelForcedResponse(),
  "56095.when-revealed": advancedWhenRevealed(),
  "56095.captain-marvel-forced-response": captainMarvelForcedResponse(),

  "56098.energy-channel-forced-response": forcedResponse(
    on.attacks(query(["hero", "ally"]), { target: HOST_VILLAIN }),
    energyCounters(1),
    ifThen(valueAtLeast(ENERGY_ON_CHANNEL, 4), [
      removeEachCounterFrom(self, ENERGY),
      enemyAttack(theVillain, { targetCharacter: eventSource, keywords: ["overkill"] }),
    ]),
  ),

  "56099.captain-marvels-helmet-constant": constant(gainsKeyword({ name: "stalwart" }, HOST_VILLAIN)),
  "56099.captain-marvels-helmet-response": heroResponse(
    on.attacks(query("identity"), { basic: true, byYou: true, target: HOST_VILLAIN }),
    { cost: spendSameType(3) },
    discard(self),
  ),
  "56099.boost": boost(revealCard(self)),

  "56100.cosmic-flight-forced-interrupt": cosmicFlight(),
  "56100.boost": boost(revealCard(self)),

  "56101.when-revealed-alter-ego": whenRevealedAlterEgo(
    // No "choose": an encounter card targeting one of several eligible cards; the first player selects
    // (RRG 1.8 "First Player", p. 19).
    chooseTarget("lost", query(["ally", "support"], { controller: "you" }), { chooser: firstPlayer }),
    discard(chosen("lost")),
  ),
  "56101.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you }), energyCounters(1)),

  "56102.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(theVillain), energyCounters(1)),
  "56102.when-revealed-hero": whenRevealedHero(placeThreat(2, each(query("scheme")))),

  "56103.when-revealed": whenRevealed(energyCounters(1), heal(ENERGY_ON_CHANNEL, theVillain)),
  "56103.boost": boost(energyCounters(1)),

  "56104.when-defeated": whenDefeated(energyCounters(3)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const LEADERS_CAPTAIN_MARVEL_SKIPPED: Readonly<Record<string, string>> = {};
