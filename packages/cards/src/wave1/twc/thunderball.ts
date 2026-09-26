import {
  andThen,
  after,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  countOf,
  dealDamage,
  defendingCharacter,
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
  giveTough,
  heal,
  heroAction,
  host,
  ifElse,
  ifThen,
  isHero,
  named,
  not,
  option,
  placeThreat,
  query,
  removeThreat,
  revealCard,
  rule,
  scaled,
  self,
  selectCards,
  setActiveVillain,
  stun,
  surge,
  theMainScheme,
  theVillain,
  threatAtLeast,
  threatOn,
  undefendedAttack,
  varAtLeast,
  when,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";
import {
  enemyAttackAfterThisNoBoost,
  leastThreatSideScheme,
  leastThreatVillain,
  mostThreatSideScheme,
  mostThreatVillain,
  moveThreat,
  pickVillainBy,
  pickedVillain,
  signatureSideSchemeOf,
  villainOfSideScheme,
  VILLAIN_PICK_SLOT,
} from "./local.js";

const THUNDERBALL = query("villain", { name: "Thunderball" });

/**
 * Thunderball (07017/07018) and his own encounter set: Thunderstruck (07019), Ball and Chain (07020), Held Hostage
 * (07021), Radioactive Buildup (07022), Corrupt Prison Guard (07023, no ability), Escaped Convict (07024), Buddy
 * System (07025), Chaos In the Prison (07026), Energy Projectiles (07027), Get Wrecked! (07028), I've Been Waiting
 * For This! (07029), Lightning Blast (07030), Tactical Prowess (07031).
 *
 * Several cards here print byte-identical text to Wrecker's copy of the same card (`wrecker.ts`) — each is its own
 * physical card with its own ability id, so each gets its own registry entry, but the script bodies are
 * intentionally identical (never a shared reference across files: `docs/phase7-wave1-scripting.md` "a pack agent
 * never imports another pack's folder" extends to never importing across a scenario pack's own per-villain modules
 * either, so `wrecker.ts` stays readable standalone).
 */
export const THUNDERBALL_SET = defineAbilities({
  // Thunderball (I/II) — [star] When Thunderball schemes, place the threat on his side scheme instead of the main
  // scheme.
  "07017.thunderball-constant": constant(
    rule({ kind: "schemeThreatDestination", enemy: THUNDERBALL, scheme: "ownSignatureSideScheme" }),
  ),
  "07018.thunderball-constant": constant(
    rule({ kind: "schemeThreatDestination", enemy: THUNDERBALL, scheme: "ownSignatureSideScheme" }),
  ),
  // Thunderball (I/II) — [star] Forced Response: After Thunderball attacks you, deal 1 damage to each character you
  // control. `enemyAttacks("self", { againstYou: true })`'s `usesAttackedPlayer` scopes "you" to the attacked player.
  "07017.thunderball-forced-response": forcedResponse(
    when.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, each(query(["identity", "ally"], { controller: "you" }))),
  ),
  "07018.thunderball-forced-response": forcedResponse(
    when.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, each(query(["identity", "ally"], { controller: "you" }))),
  ),

  // Thunderstruck — Thunderball's Side Scheme. This card cannot leave play while Thunderball is in play.
  "07019.thunderstruck-constant": constant(
    rule({
      kind: "cannotLeavePlay",
      target: query("sideScheme", { name: "Thunderstruck" }),
      while: exists(THUNDERBALL),
    }),
  ),
  "07019.thunderstruck-constant-2": constant(
    rule({ kind: "notDefeatedWithoutThreat", target: query("sideScheme", { name: "Thunderstruck" }) }),
  ),
  // Gamma Blast — Forced Response: After threat is placed here, if there is 10 or more threat here, stun each
  // friendly character. Remove all but 3 threat from this scheme. `threatAtLeast` (wave B primitives batch,
  // docs/phase7-wave1-scripting.md §6) is the same live-threat-vs-threshold read Day of Reckoning's Hard Hitter
  // needed (`wrecker.ts`).
  "07019.gamma-blast": forcedResponse(
    after.threatPlaced("self"),
    ifThen(threatAtLeast(self, 10), [
      stun(each(FRIENDLY_CHARACTER)),
      removeThreat(scaled(threatOn(self), { plus: -3 }), self),
    ]),
  ),

  // Ball and Chain — Attach to Thunderball. [star] Forced Response: After Thunderball attacks, place 1 threat on
  // the main scheme.
  "07020.ball-and-chain-forced-response": forcedResponse(after.enemyAttacks("host"), placeThreat(1, theMainScheme)),
  // Hero Action: Exhaust your hero and discard 1 card at random from your hand → discard this card. Same
  // `discardRandomFromHandCost` shape as Magic Crowbar (`wrecker.ts`).
  "07020.ball-and-chain-action": heroAction({ cost: [exhaustYourHero, discardRandomFromHandCost(1)] }, discard(self)),

  // Held Hostage — same text as Wrecker's copy (07005).
  "07021.held-hostage-constant": constant(
    rule({ kind: "threatCannotBeRemoved", target: query("sideScheme", { hostOfSelf: true }), by: "thwart" }),
  ),
  // A stunned villain removes its stun instead of attacking, so the attack did not happen and "then discard this
  // card" is skipped (`activationDidNotHappen`, RRG 1.8 "'Then'", p. 44; "Stun", p. 41).
  "07021.held-hostage-action": heroAction(
    enemyAttack(villainOfSideScheme(host), { against: you }),
    andThen(discard(self)),
  ),

  // Radioactive Buildup — Attach to Thunderball. Excess damage dealt by Thunderball is placed as threat on his
  // corresponding side scheme. `RuleSpec.excessDamageAsThreat` (wave B primitives batch,
  // docs/phase7-wave1-scripting.md §6) is a **constant**, not a forced response on the attack: as a response it
  // would race this card's own "After Thunderball attacks, discard this card" below. Excess damage is what
  // overkill would spill (RRG 1.8 "Overkill", p. 31, superseding ruling Jan 26, 2026 (3)), so a tough, prevented or
  // "cannot take damage" target yields no threat; its interaction with overkill is open (both apply today).
  "07022.radioactive-buildup-constant": constant(
    rule({ kind: "excessDamageAsThreat", source: { hostOfSelf: true }, scheme: signatureSideSchemeOf(host) }),
  ),
  // [star] Forced Response: After Thunderball attacks, discard this card.
  "07022.radioactive-buildup-forced-response": forcedResponse(after.enemyAttacks("host"), discard(self)),

  // Escaped Convict — same text as Wrecker's copy (07009).
  "07024.boost": boost(
    setActiveVillain(leastThreatVillain),
    ifThen(isHero(), enemyAttackAfterThisNoBoost(theVillain, you)),
  ),

  // Buddy System — same text as Wrecker's copy (07010).
  "07025.when-revealed": whenRevealed(
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
  "07025.boost": boost(setActiveVillain(leastThreatVillain)),

  // Chaos In the Prison — same text as Wrecker's copy (07011).
  "07026.when-revealed": whenRevealed(
    ifThen(
      exists(query("upgrade", { controller: "you" })),
      chooseOne(
        option(
          "Discard an upgrade you control",
          chooseTarget("discarded-upgrade", query("upgrade", { controller: "you" })),
          discard(chosen("discarded-upgrade")),
        ),
        option(
          "Place threat on the active villain's side scheme",
          placeThreat(countOf(query("upgrade", { controller: "you" })), signatureSideSchemeOf(theVillain)),
        ),
      ),
      surge(),
    ),
  ),
  "07026.boost": boost(
    ifThen(undefendedAttack, [
      chooseTarget("chaos-boost-upgrade", query("upgrade", { controller: "you" })),
      discard(chosen("chaos-boost-upgrade")),
    ]),
  ),

  // Energy Projectiles — When Revealed: Deal 1 damage to each friendly character you control.
  "07027.when-revealed": whenRevealed(dealDamage(1, each(query(["identity", "ally"], { controller: "you" })))),
  // [star] Boost: Deal 1 damage to the defending character. `defendingCharacter` (wave B primitives batch,
  // docs/phase7-wave1-scripting.md §6) names the defender of the enemy attack in progress — the ref a Boost
  // ability needs since it has no triggering event of its own for `eventTarget` to read. Empty (no-op) for an
  // undefended attack.
  "07027.boost": boost(dealDamage(1, defendingCharacter)),

  // Get Wrecked! — same text as Wrecker's copy (07013).
  "07028.when-revealed-alter-ego": whenRevealedAlterEgo(enemyScheme(mostThreatVillain)),
  "07028.when-revealed-hero": whenRevealedHero(enemyAttack(leastThreatVillain, { against: you })),

  // I've Been Waiting For This! — same text as Wrecker's copy (07014).
  "07029.when-revealed": whenRevealed(heal(3, theVillain), giveTough(theVillain)),
  "07029.boost": boost(setActiveVillain(leastThreatVillain), enemyScheme(theVillain)),

  // Lightning Blast — When Revealed (Alter-Ego): Place 3 threat on the side scheme with the most threat.
  "07030.when-revealed-alter-ego": whenRevealedAlterEgo(placeThreat(3, mostThreatSideScheme)),
  // When Revealed (Hero): Thunderball attacks you. If this attack is undefended, place 3 threat on Thunderball's
  // side scheme.
  "07030.when-revealed-hero": whenRevealedHero(
    enemyAttack(named("Thunderball"), { against: you, bind: "blast" }),
    ifThen(varAtLeast("blast.undefended"), placeThreat(3, signatureSideSchemeOf(named("Thunderball")))),
  ),

  // Tactical Prowess — When Revealed: Move all threat from the side scheme with the least threat to the side scheme
  // with the most threat. If that scheme's "Forced Response" ability is not triggered this way, this card gains
  // surge.
  "07031.when-revealed": whenRevealed(
    moveThreat(leastThreatSideScheme, mostThreatSideScheme, { bind: "moved" }),
    ifThen(not(varAtLeast("moved.forcedResponses")), surge()),
  ),
});
