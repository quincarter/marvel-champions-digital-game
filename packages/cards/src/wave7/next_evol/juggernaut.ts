import type { AbilityRegistry } from "@mc/engine";
import {
  addCounters,
  attachCard,
  attacksGainKeywords,
  bindTargets,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countersOn,
  coveredByEngineRule,
  dealIndirectDamage,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  enemyAttack,
  eventResult,
  exists,
  flipCard,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsKeywordX,
  gets,
  giveTough,
  heroAction,
  heroResponse,
  host,
  ifThen,
  increaseDamageTaken,
  inMode,
  instead,
  on,
  option,
  placeThreat,
  printedCostOf,
  query,
  remainingHpOf,
  removeEachCounterFrom,
  removeThreat,
  searchAndReveal,
  selectCards,
  self,
  setup,
  spendEqualTo,
  spendSameType,
  statOf,
  superlative,
  takeDamage,
  thatPlayer,
  theMainScheme,
  theVillain,
  threatOn,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  dealDamage,
  encounterSetAside,
} from "../../dsl/index.js";

/**
 * The Juggernaut scenario's own set (40118-40129: the three villain stages, The Unstoppable Juggernaut, the Helmet /
 * Exposed, Head of Steam and the side scheme and treacheries). Hope Summers and Captive Hope are `hope-summers.ts`.
 *
 * Momentum is a script-named counter on the villain's instance (`momentum`); a villain stage's defeat keeps the
 * instance, so the counters carry over to the next stage (MC40 p. 14; RRG 1.8 "Villain Defeat", p. 47).
 * "Juggernaut Exposed" is the showing face of the Helmet card (a double-sided attachment), matched by title.
 */
const THE_VILLAIN = query("villain");
/** "An upgrade or support you control". */
const YOUR_UPGRADES_AND_SUPPORTS = query(["upgrade", "support"], { controller: "you" });
const ATTACHED_VILLAIN = query("villain", { hostOfSelf: true });
const HIS_ATK = statOf(theVillain, "atk");
const MOMENTUM = "momentum";
/** "If Juggernaut Exposed is in play": the Helmet card while it shows its b face. */
const EXPOSED = query("attachment", { name: "Juggernaut Exposed" });
const exposedInPlay = () => exists(EXPOSED);
const flipExposed = () => flipCard(each(EXPOSED));
const addMomentum = (target = theVillain) => addCounters(MOMENTUM, 1, target);
/** "If Juggernaut Exposed is in play, flip it. Otherwise, give Juggernaut a tough status card." */
const flipOrToughen = () => ifThen(exposedInPlay(), flipExposed(), giveTough(theVillain));
/** "[star] Juggernaut gets +1 ATK for each momentum counter here." */
const momentumAttack = () => constant(gets("atk", countersOn(self, MOMENTUM), query("villain", { self: true })));

export const JUGGERNAUT: AbilityRegistry = defineAbilities({
  // The Unstoppable Juggernaut 1A — Setup: Attach Juggernaut's Helmet to Juggernaut (set aside by the scenario builder:
  // it is permanent). Put Hope Summers into play under the first player's control is her own Setup keyword (Appendix II
  // step 11), so it is not repeated here.
  "40121a.setup": setup(
    selectCards("helmet", encounterSetAside({ name: "Juggernaut's Helmet" })),
    attachCard(chosen("helmet"), theVillain),
  ),
  // 1B — Forced Interrupt: when this scheme would be completed, instead do each of the following in order.
  "40121b.the-unstoppable-juggernaut-forced-interrupt": forcedInterrupt(
    on.mainSchemeCompleting("self"),
    instead(
      removeThreat(threatOn(self), self),
      ifThen(exposedInPlay(), flipExposed()),
      addMomentum(),
      // Each attack is an effect-caused one, so the player's form is not checked ("even if in alter-ego form").
      forEachPlayer(eachPlayer, enemyAttack(theVillain, { against: thatPlayer })),
    ),
  ),
  // The four numbered steps print as constants in the data; they are the interrupt's own steps above.
  "40121b.the-unstoppable-juggernaut-constant": coveredByEngineRule(),
  "40121b.the-unstoppable-juggernaut-constant-2": coveredByEngineRule(),
  "40121b.the-unstoppable-juggernaut-constant-3": coveredByEngineRule(),
  "40121b.the-unstoppable-juggernaut-constant-4": coveredByEngineRule(),

  // Juggernaut I / II / III (40118-40120).
  "40118.juggernaut-constant": momentumAttack(),
  "40118.when-revealed": whenRevealed(addMomentum(self), giveTough(theVillain)),
  "40119.juggernaut-constant": momentumAttack(),
  "40119.when-revealed": whenRevealed(addMomentum(self), flipOrToughen()),
  "40120.juggernaut-constant": momentumAttack(),
  "40120.when-revealed": whenRevealed(searchAndReveal("Head of Steam"), flipOrToughen()),

  // Juggernaut's Helmet (40122a): permanent and the attach are data. Stalwart, and his attacks gain overkill.
  "40122a.juggernauts-helmet-constant": constant(
    gainsKeyword({ name: "stalwart" }, ATTACHED_VILLAIN),
    attacksGainKeywords(["overkill"], { attacker: ATTACHED_VILLAIN }),
  ),
  // Hero Action: Spend 3 resources of the same type → remove each momentum counter from Juggernaut. Flip this card.
  "40122a.juggernauts-helmet-action": heroAction(
    { cost: spendSameType(3) },
    removeEachCounterFrom(theVillain, MOMENTUM),
    flipCard(self),
  ),
  // Juggernaut Exposed (40122b): 1 additional damage from each card with a printed [mental] resource.
  "40122b.juggernaut-exposed-constant": constant(
    increaseDamageTaken(ATTACHED_VILLAIN, 1, { fromSource: { printedResource: "mental" } }),
  ),
  // [star] Forced Response: After Juggernaut schemes, place 1 momentum counter on Juggernaut. Flip this card.
  "40122b.juggernaut-exposed-forced-response": forcedResponse(
    on.enemySchemes("host"),
    addMomentum(host),
    flipCard(self),
  ),

  // Head of Steam (40123) — retaliate X, X = momentum counters on Juggernaut.
  "40123.head-of-steam-constant": constant(
    gainsKeywordX("retaliate", countersOn(theVillain, MOMENTUM), ATTACHED_VILLAIN),
  ),
  // When Revealed: Attach Head of Steam to Juggernaut and place 1 momentum counter on him.
  "40123.when-revealed": whenRevealed(attachCard(self, theVillain), addMomentum()),
  // Hero Response: After Juggernaut attacks you, spend 1 resource for each damage dealt by that attack -> discard this
  // card. X is read from the attack being answered; Q15 = A: a 0-damage attack costs 0 and the card may be discarded.
  "40123.head-of-steam-response": heroResponse(
    on.enemyAttacks("host", { againstYou: true }),
    { cost: spendEqualTo(eventResult("damage")) },
    discard(self),
  ),

  // Building Momentum (40124) — Hero Response: After you defend against an attack from Juggernaut, remove 1 threat from
  // this scheme. Acceleration icons and boost icons are data.
  "40124.building-momentum-response": heroResponse(
    { ...on.defends(query("hero")), playerIs: "controller" as const, sourceIs: THE_VILLAIN },
    removeThreat(1, self),
  ),

  // Breakthrough (40125) — Choose: take damage equal to Juggernaut's ATK, or discard the highest-cost upgrade or support
  // you control. An option is offered only if it can be carried out in full (Q8 = A); the player picks among ties.
  "40125.when-revealed": whenRevealed(
    chooseOne(
      option("Take damage equal to Juggernaut's ATK", takeDamage(HIS_ATK)),
      option(
        "Discard the highest-cost upgrade or support you control",
        { when: exists(YOUR_UPGRADES_AND_SUPPORTS) },
        bindTargets(
          "highest",
          superlative("highest", each(YOUR_UPGRADES_AND_SUPPORTS), printedCostOf(chosen("candidate")), { ties: "all" }),
        ),
        chooseTarget("pick", { inSlot: "highest" }),
        discard(chosen("pick")),
      ),
    ),
  ),

  // Flatten (40126) — Choose to either take damage equal to Juggernaut's ATK or place 1 momentum counter on him.
  "40126.when-revealed": whenRevealed(
    chooseOne(
      option("Take damage equal to Juggernaut's ATK", takeDamage(HIS_ATK)),
      option("Place 1 momentum counter on Juggernaut", addMomentum()),
    ),
  ),
  // [star] Boost: Give Juggernaut a tough status card.
  "40126.boost": boost(giveTough(theVillain)),

  // Ground Pound (40127) — The players as a group take indirect damage equal to Juggernaut's ATK. [star] Boost: Take 1
  // indirect damage.
  "40127.when-revealed": whenRevealed(dealIndirectDamage("group", HIS_ATK)),
  "40127.boost": boost(dealIndirectDamage(you, 1)),

  // Trample (40128) — Alter-Ego: take 2 indirect damage. Hero: Juggernaut attacks the ally with the fewest remaining hit
  // points (any player's; the revealing player picks among ties; no ally, no attack). [star] Boost: Deal 1 damage to an
  // ally you control.
  "40128.when-revealed-alter-ego": whenRevealedAlterEgo(dealIndirectDamage(you, 2)),
  "40128.when-revealed-hero": whenRevealedHero(
    ifThen(exists(query("ally")), [
      bindTargets(
        "fewest",
        superlative("lowest", each(query("ally")), remainingHpOf(chosen("candidate")), { ties: "all" }),
      ),
      chooseTarget("victim", { inSlot: "fewest" }),
      enemyAttack(theVillain, { targetCharacter: chosen("victim") }),
    ]),
  ),
  "40128.boost": boost(
    ifThen(exists(query("ally", { controller: "you" })), [
      chooseTarget("ally", query("ally", { controller: "you" })),
      dealDamage(1, chosen("ally")),
    ]),
  ),

  // Cyttorak's Exemplar (40129) — In expert mode, gains incite 1.
  "40129.cyttoraks-exemplar-constant": constant(
    gainsKeywordX("incite", 1, { self: true }, { while: inMode("expert") }),
  ),
  // When Revealed: If Juggernaut Exposed is in play, flip it and place 1 momentum counter on Juggernaut. Otherwise,
  // place threat on the main scheme equal to Juggernaut's ATK.
  "40129.when-revealed": whenRevealed(
    ifThen(exposedInPlay(), [flipExposed(), addMomentum()], placeThreat(HIS_ATK, theMainScheme)),
  ),
});
