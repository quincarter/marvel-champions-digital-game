import {
  andThen,
  after,
  allOf,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  confuse,
  constant,
  defineAbilities,
  discard,
  each,
  eachPlayer,
  enemyAttack,
  enemyScheme,
  encounterCards,
  exists,
  forcedResponse,
  forEachPlayer,
  gets,
  giveTough,
  hasStatus,
  heal,
  heroAction,
  host,
  ifElse,
  ifThen,
  isHero,
  modifyAttack,
  named,
  not,
  placeThreat,
  query,
  removeThreat,
  response,
  revealCard,
  rule,
  scaled,
  self,
  selectCards,
  setActiveVillain,
  spend,
  surge,
  thatPlayer,
  theVillain,
  threatAtLeast,
  threatOn,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
  YOUR_HERO,
} from "../../dsl/index.js";
import {
  enemyAttackAfterThisNoBoost,
  leastThreatVillain,
  mostThreatVillain,
  pickVillainBy,
  pickedVillain,
  printedCostOf,
  removeStatus,
  signatureSideSchemeOf,
  superlative,
  villainOfSideScheme,
  VILLAIN_PICK_SLOT,
} from "./local.js";

const PILEDRIVER = query("villain", { name: "Piledriver" });

/**
 * Piledriver (07032/07033) and his own encounter set: Pile It On! (07034), Distracting Taunts (07035), Held Hostage
 * (07036), Corrupt Prison Guard (07037, no ability), Escaped Convict (07038), Buddy System (07039), Get Wrecked!
 * (07040), I've Been Waiting For This! (07041), Oversized Hands (07042), Escape Plan (07043), Pummel (07044),
 * Uncanny Resilience (07045). Piledriver's Retaliate 1 is card data (`keywords`), no script.
 */
export const PILEDRIVER_SET = defineAbilities({
  // Piledriver (I/II) — [star] When Piledriver schemes, place the threat on his side scheme instead of the main
  // scheme.
  "07032.piledriver-constant": constant(
    rule({ kind: "schemeThreatDestination", enemy: PILEDRIVER, scheme: "ownSignatureSideScheme" }),
  ),
  "07033.piledriver-constant": constant(
    rule({ kind: "schemeThreatDestination", enemy: PILEDRIVER, scheme: "ownSignatureSideScheme" }),
  ),

  // Pile It On! — Piledriver's Side Scheme. This card cannot leave play while Piledriver is in play.
  "07034.pile-it-on-constant": constant(
    rule({ kind: "cannotLeavePlay", target: query("sideScheme", { name: "Pile It On!" }), while: exists(PILEDRIVER) }),
  ),
  "07034.pile-it-on-constant-2": constant(
    rule({ kind: "notDefeatedWithoutThreat", target: query("sideScheme", { name: "Pile It On!" }) }),
  ),
  // Pile Drive — Forced Response: After threat is placed here, if there is 10 or more threat here, each player
  // discards the upgrade or support they control with the highest cost. Remove all but 3 threat from this scheme.
  // `threatAtLeast` (wave B primitives batch, docs/phase7-wave1-scripting.md §6) is the same live-threat-vs-
  // threshold read Day of Reckoning's Hard Hitter needed (`wrecker.ts`). A tie is broken by each player's own
  // choice among their tied cards, matching Burn Notice's identical "the card with the highest cost" reading
  // (`wave1/bkw/obligation.ts`).
  "07034.pile-drive": forcedResponse(
    after.threatPlaced("self"),
    ifThen(threatAtLeast(self, 10), [
      forEachPlayer(
        eachPlayer,
        ifThen(exists(query(["upgrade", "support"], { controlledBy: thatPlayer })), [
          bindTargets(
            "pd",
            superlative(
              "highest",
              each(query(["upgrade", "support"], { controlledBy: thatPlayer })),
              printedCostOf(chosen("candidate")),
            ),
          ),
          chooseTarget("burned", { inSlot: "pd" }, { chooser: thatPlayer }),
          discard(chosen("burned")),
        ]),
      ),
      removeThreat(scaled(threatOn(self), { plus: -3 }), self),
    ]),
  ),

  // Distracting Taunts — Attach to Piledriver. Piledriver gets +3 hit points. Players cannot attack other villains.
  "07035.distracting-taunts-constant": constant(
    gets("hp", 3, query("villain", { hostOfSelf: true })),
    rule({ kind: "cannotAttack", target: query("villain", { hostOfSelf: false }) }),
  ),
  // Response: After your hero attacks Piledriver, spend [physical][physical] resources → discard this card.
  "07035.distracting-taunts-response": response(
    after.attacks(YOUR_HERO, { target: query("villain", { hostOfSelf: true }) }),
    { cost: spend({ physical: 2 }) },
    discard(self),
  ),

  // Held Hostage — same text as Wrecker's copy (07005).
  "07036.held-hostage-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { hostOfSelf: true }), by: "thwart" }),
  ),
  // A stunned villain removes its stun instead of attacking, so the attack did not happen and "then discard this
  // card" is skipped (`activationDidNotHappen`, RRG 1.8 "'Then'", p. 44; "Stun", p. 41).
  "07036.held-hostage-action": heroAction(
    enemyAttack(villainOfSideScheme(host), { against: you }),
    andThen(discard(self)),
  ),

  // Escaped Convict — same text as Wrecker's copy (07009).
  "07038.boost": boost(
    setActiveVillain(leastThreatVillain),
    ifThen(isHero(), enemyAttackAfterThisNoBoost(theVillain, you)),
  ),

  // Buddy System — same text as Wrecker's copy (07010).
  "07039.when-revealed": whenRevealed(
    pickVillainBy("lowest"),
    selectCards(
      "looked",
      encounterCards(
        ["deck"],
        undefined,
        ifElse(not(exists(query("villain", { excludeSlots: [VILLAIN_PICK_SLOT] }))), 2, 1),
        pickedVillain,
      ),
    ),
    revealCard(chosen("looked")),
  ),
  "07039.boost": boost(setActiveVillain(leastThreatVillain)),

  // Get Wrecked! — same text as Wrecker's copy (07013).
  "07040.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(mostThreatVillain)),
  "07040.when-revealed-hero": whenRevealedHero(enemyAttack(leastThreatVillain, { against: you })),

  // I've Been Waiting For This! — same text as Wrecker's copy (07014).
  "07041.when-revealed": whenRevealed(heal(3, theVillain), giveTough(theVillain)),
  "07041.boost": boost(setActiveVillain(leastThreatVillain), enemyScheme(theVillain)),

  // Oversized Hands — When Revealed: Discard the support you control with the highest cost. If no support was
  // discarded this way, place 2 threat on the active villain's scheme.
  "07042.when-revealed": whenRevealed(
    ifThen(
      exists(query("support", { controller: "you" })),
      discard(
        superlative("highest", each(query("support", { controller: "you" })), printedCostOf(chosen("candidate")), {
          ties: "first",
        }),
      ),
      placeThreat(2, signatureSideSchemeOf(theVillain)),
    ),
  ),
  // [star] Boost: Discard a support you control.
  "07042.boost": boost(
    ifThen(exists(query("support", { controller: "you" })), [
      chooseTarget("oversized-hands-support", query("support", { controller: "you" })),
      discard(chosen("oversized-hands-support")),
    ]),
  ),

  // Escape Plan — When Revealed: You are confused. If you are already confused, Piledriver schemes.
  "07043.when-revealed": whenRevealed(
    ifThen(hasStatus(yourIdentity, "confused"), enemyScheme(named("Piledriver")), confuse(yourIdentity)),
  ),
  // [star] Boost: Give the active villain a tough status card. If they already have a tough status card, place 2
  // threat on their scheme.
  "07043.boost": boost(
    ifThen(hasStatus(theVillain, "tough"), placeThreat(2, signatureSideSchemeOf(theVillain)), giveTough(theVillain)),
  ),

  // Pummel — When Revealed (Alter-Ego): Piledriver schemes. If Piledriver is tough, he gets +2 SCH for this
  // activation.
  "07044.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(named("Piledriver")),
    ifThen(hasStatus(named("Piledriver"), "tough"), modifyAttack({ threatBonus: 2 })),
  ),
  // When Revealed (Hero): Piledriver attacks you. If Piledriver is tough, he gets +2 ATK for this activation.
  "07044.when-revealed-hero": whenRevealedHero(
    enemyAttack(named("Piledriver"), { against: you }),
    ifThen(hasStatus(named("Piledriver"), "tough"), modifyAttack({ atkBonus: 2 })),
  ),

  // Uncanny Resilience — When Revealed: Remove each stunned and confused status card from each villain. If no
  // status cards were removed, this card gains surge.
  "07045.when-revealed": whenRevealed(
    ifThen(
      allOf(
        not(exists(query("villain", { hasStatus: "stunned" }))),
        not(exists(query("villain", { hasStatus: "confused" }))),
      ),
      surge(),
      [removeStatus(each(query("villain")), "stunned"), removeStatus(each(query("villain")), "confused")],
    ),
  ),
  // [star] Boost: You are confused.
  "07045.boost": boost(confuse(yourIdentity)),
});
