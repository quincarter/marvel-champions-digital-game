import {
  after,
  boost,
  bindTargets,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealDamage,
  defineAbilities,
  discard,
  discardRandomFromHandCost,
  each,
  enemyAttack,
  enemyScheme,
  encounterCards,
  exhaustYourHero,
  exists,
  FRIENDLY_CHARACTER,
  forcedResponse,
  gets,
  giveTough,
  heal,
  heroAction,
  host,
  ifElse,
  ifThen,
  isHero,
  modifyAttack,
  named,
  not,
  option,
  placeThreat,
  query,
  remainingHpOf,
  revealCard,
  rule,
  self,
  selectCards,
  setActiveVillain,
  spend,
  surge,
  theVillain,
  undefendedAttack,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";
import {
  enemyAttackAfterThisNoBoost,
  leastThreatSideScheme,
  leastThreatVillain,
  mostThreatVillain,
  pickVillainBy,
  pickedVillain,
  signatureSideSchemeOf,
  superlative,
  villainOfSideScheme,
  VILLAIN_PICK_SLOT,
} from "./local.js";

const WRECKER = query("villain", { name: "Wrecker" });

/**
 * Wrecker (07002/07003) and his own encounter set: Day of Reckoning (07004), Held Hostage (07005), Magic Crowbar
 * (07006), Wrecker's Command (07007), Corrupt Prison Guard (07008, no ability — Guard is card data),
 * Escaped Convict (07009), Buddy System (07010), Chaos In the Prison (07011), Crowbar Toss (07012), Get Wrecked!
 * (07013), I've Been Waiting For This! (07014), Mystical Link (07015), You're Dead Meat! (07016).
 */
export const WRECKER_SET = defineAbilities({
  // Wrecker (I/II) — [star] When Wrecker schemes, place the threat on his side scheme instead of the main scheme.
  // Landed `RuleSpec.schemeThreatDestination` (`abilities.ts`), whose own doc comment quotes this exact card.
  "07002.wrecker-constant": constant(rule({ kind: "schemeThreatDestination", enemy: WRECKER, scheme: "ownSignatureSideScheme" })),
  "07003.wrecker-constant": constant(rule({ kind: "schemeThreatDestination", enemy: WRECKER, scheme: "ownSignatureSideScheme" })),
  // Wrecker (I/II) — [star] While Wrecker is attacking, he gets +2 ATK if the attack is undefended.
  "07002.wrecker-constant-2": constant(gets("atk", 2, WRECKER, { while: undefendedAttack })),
  "07003.wrecker-constant-2": constant(gets("atk", 2, WRECKER, { while: undefendedAttack })),

  // Day of Reckoning — Wrecker's Side Scheme. This card cannot leave play while Wrecker is in play.
  "07004.day-of-reckoning-constant": constant(rule({ kind: "cannotLeavePlay", target: query("sideScheme", { name: "Day of Reckoning" }), while: exists(WRECKER) })),
  // The Wrecking Crew insert, "Signature Side Schemes": "These side schemes are not discarded when they have no
  // threat on them." Landed `RuleSpec.notDefeatedWithoutThreat`.
  "07004.day-of-reckoning-constant-2": constant(rule({ kind: "notDefeatedWithoutThreat", target: query("sideScheme", { name: "Day of Reckoning" }) })),
  // Hard Hitter — Forced Response: After threat is placed here, if there is 10 or more threat here, deal 2 damage
  // to each friendly character. Remove all but 3 threat from this scheme. KNOWN_SKIPPED: no `Predicate` reads a
  // scheme's live threat total against a threshold (`damagedAtLeast`/`counterAtLeast` exist; no threat equivalent).

  // Held Hostage — Attach to the active villain's side scheme. Threat cannot be removed from attached scheme by
  // thwarting.
  "07005.held-hostage-constant": constant(rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { hostOfSelf: true }), by: "thwart" })),
  // Hero Action: The villain corresponding to the attached side scheme attacks you. Then discard this card.
  "07005.held-hostage-action": heroAction(enemyAttack(villainOfSideScheme(host), { against: you }), discard(self)),

  // Magic Crowbar — Attach to Wrecker. [star] Forced Response: After Wrecker attacks, place 1 threat on the side
  // scheme with the least threat.
  "07006.magic-crowbar-forced-response": forcedResponse(after.enemyAttacks("host"), placeThreat(1, leastThreatSideScheme)),
  // Hero Action: Exhaust your hero and discard 1 card at random from your hand → discard this card.
  // `discardRandomFromHandCost` (`dsl/abilities.ts`) picks with the game's own seeded RNG, landed for exactly this
  // card (docs/phase7-wave1-scripting.md §6).
  "07006.magic-crowbar-action": heroAction({ cost: [exhaustYourHero, discardRandomFromHandCost(1)] }, discard(self)),

  // Wrecker's Command — Attach to Wrecker. [star] Forced Response: After Wrecker schemes, place 1 threat on each
  // other villain's side scheme. "Other" = every signature side scheme except the one bound to Wrecker himself
  // (`excludeSlots`, RRG-consistent with `TargetQuery.signatureSideScheme` + `hostOfSelf`).
  "07007.wreckers-command-forced-response": forcedResponse(
    after.enemySchemes("host"),
    bindTargets("wreckers-command-own-scheme", signatureSideSchemeOf(host)),
    placeThreat(1, each(query("sideScheme", { signatureSideScheme: true, excludeSlots: ["wreckers-command-own-scheme"] }))),
  ),
  // Hero Action: Spend [physical][physical] resources → discard this card.
  "07007.wreckers-command-action": heroAction({ cost: spend({ physical: 2 }) }, discard(self)),

  // Escaped Convict — Surge. [star] Boost: Move the active counter to the villain whose side scheme has the least
  // threat. If you are in hero form, that villain attacks you after this attack. That attack does not get a boost
  // card.
  "07009.boost": boost(setActiveVillain(leastThreatVillain), ifThen(isHero(), enemyAttackAfterThisNoBoost(theVillain, you))),

  // Buddy System — When Revealed: Choose the villain whose side scheme has the least threat. Reveal the top card of
  // his deck (top 2 cards instead if he is the only villain in play). "He is the only villain in play" = no *other*
  // villain exists, once the chosen one is excluded (`excludeSlots`), so no count-comparison predicate is needed.
  "07010.when-revealed": whenRevealed(
    pickVillainBy("lowest"),
    selectCards("looked", encounterCards(["deck"], undefined, ifElse(not(exists(query("villain", { excludeSlots: [VILLAIN_PICK_SLOT] }))), 2, 1), pickedVillain)),
    revealCard(chosen("looked")),
  ),
  // [star] Boost: Move the active counter to the villain whose side scheme has the least threat.
  "07010.boost": boost(setActiveVillain(leastThreatVillain)),

  // Chaos In the Prison — When Revealed: Choose to either discard an upgrade you control or place 1 threat on the
  // active villain's side scheme for each upgrade you control. If you do not control any upgrades, this card gains
  // surge.
  "07011.when-revealed": whenRevealed(
    ifThen(
      exists(query("upgrade", { controller: "you" })),
      chooseOne(
        option("Discard an upgrade you control", chooseTarget("discarded-upgrade", query("upgrade", { controller: "you" })), discard(chosen("discarded-upgrade"))),
        option("Place threat on the active villain's side scheme", placeThreat(countOf(query("upgrade", { controller: "you" })), signatureSideSchemeOf(theVillain))),
      ),
      surge(),
    ),
  ),
  // [star] Boost: If this attack is undefended, discard an upgrade you control.
  "07011.boost": boost(ifThen(undefendedAttack, [chooseTarget("chaos-boost-upgrade", query("upgrade", { controller: "you" })), discard(chosen("chaos-boost-upgrade"))])),

  // Crowbar Toss — When Revealed (Alter-Ego): Wrecker schemes. Then, move the active villain counter to the villain
  // whose side scheme has the least threat.
  "07012.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(named("Wrecker")), setActiveVillain(leastThreatVillain)),
  // When Revealed (Hero): Wrecker attacks you. Then, move the active villain counter to the villain whose side
  // scheme has the least threat.
  "07012.when-revealed-hero": whenRevealedHero(enemyAttack(named("Wrecker"), { against: you }), setActiveVillain(leastThreatVillain)),

  // Get Wrecked! — When Revealed (Alter-Ego): The villain whose side scheme has the most threat schemes.
  "07013.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(mostThreatVillain)),
  // When Revealed (Hero): The villain whose side scheme has the least threat attacks you.
  "07013.when-revealed-hero": whenRevealedHero(enemyAttack(leastThreatVillain, { against: you })),

  // I've Been Waiting For This! — When Revealed: The active villain heals 3 hit points. Give that villain a tough
  // status card. Errata (RRG 1.8 p. 65): "gains" became "heals" — the raw card data already carries the current
  // wording.
  "07014.when-revealed": whenRevealed(heal(3, theVillain), giveTough(theVillain)),
  // [star] Boost: Move the active counter to the villain with the least threat on his side scheme. That villain
  // schemes.
  "07014.boost": boost(setActiveVillain(leastThreatVillain), enemyScheme(theVillain)),

  // Mystical Link — When Revealed: Place 2 threat on each side scheme.
  "07015.when-revealed": whenRevealed(placeThreat(2, each(query("sideScheme")))),
  // [star] Boost: Wrecker gets +3 ATK for this activation unless you place 2 threat on his side scheme.
  "07015.boost": boost(
    chooseOne(
      option("Place 2 threat on Wrecker's side scheme", placeThreat(2, signatureSideSchemeOf(named("Wrecker")))),
      option("Wrecker gets +3 ATK for this activation", modifyAttack({ atkBonus: 3 })),
    ),
  ),

  // You're Dead Meat! — When Revealed: Deal 1 damage to the hero or ally with the fewest remaining hit points. If
  // that character is defeated this way, place 3 threat on Wrecker's side scheme.
  "07016.when-revealed": whenRevealed(
    dealDamage(1, superlative("lowest", each(FRIENDLY_CHARACTER), remainingHpOf(chosen("candidate")), { ties: "first" }), { bind: "hit" }),
    ifThen(varAtLeast("hit.defeated"), placeThreat(3, signatureSideSchemeOf(named("Wrecker")))),
  ),
});
