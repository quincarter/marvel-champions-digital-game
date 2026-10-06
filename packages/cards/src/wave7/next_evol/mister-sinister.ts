import { trait } from "@mc/content";
import type { AbilityRegistry, RuleSpec } from "@mc/engine";
import {
  activatingEnemy,
  advanceMainScheme,
  attachCard,
  boost,
  canPayResources,
  chooseOneBy,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  coveredByEngineRule,
  countOf,
  dealDamage,
  dealEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discard,
  eachPlayer,
  encounterSetAside,
  enemyScheme,
  confuse,
  eventAmount,
  eventSource,
  exhaust,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  gets,
  hasTrait,
  heal,
  ifThen,
  instead,
  modifyAttack,
  moveCards,
  named,
  on,
  option,
  perHero,
  placeThreat,
  query,
  refMatches,
  removeMainSchemeStages,
  retargetAttack,
  rule,
  selectCards,
  self,
  shuffleMainSchemeStageGroup,
  spendResources,
  stun,
  superlative,
  surge,
  theMainScheme,
  theVillain,
  bindTargets,
  each,
  remainingHpOf,
  giveTough,
  valueAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  yourIdentity,
  enemyAttack,
  you,
} from "../../dsl/index.js";

/**
 * The Mister Sinister scenario's own set: the villain (40136-40138), the five-stage main scheme deck (40139-40143) and
 * 40144-40150. The three SUPERPOWER sets (Flight 40151-, Super Strength, Telepathy), Hope Summers (40130), the Nasty Boys
 * and the standard sets are other modules.
 *
 * "SUPERPOWER attachments on Mister Sinister" is a count of attachments with that trait hosted by the villain
 * (`host: theVillain`); the three attachments are what grant the traits his treacheries read (`hasTrait`).
 */
const AERIAL = trait("AERIAL");
const BRUTE = trait("BRUTE");
const PSIONIC = trait("PSIONIC");
const SUPERPOWER = trait("SUPERPOWER");
const THE_VILLAIN = query("villain");
const SUPERPOWER_ATTACHMENTS = countOf(query("attachment", { trait: SUPERPOWER, host: theVillain }));
/** "Each friendly character": a hero or alter-ego and every ally. */
const FRIENDLY = query(["identity", "ally"]);

/** "Forced Response: After a status card is placed on Mister Sinister, place N threat on the main scheme." (§3.27) */
const statusPlacedThreat = (n: number) => forcedResponse(on.statusPlaced("self"), placeThreat(n, theMainScheme));

/** "When Revealed: Place N[per_hero] threat on the main scheme (M[per_hero] instead if he has fewer than 2 SUPERPOWER attachments)." */
const revealedThreat = (enough: number, fewer: number) =>
  whenRevealed(
    ifThen(
      valueAtLeast(SUPERPOWER_ATTACHMENTS, 2),
      placeThreat(perHero(enough), theMainScheme),
      placeThreat(perHero(fewer), theMainScheme),
    ),
  );

/**
 * A stage 2B's When Revealed: attach the set's one SUPERPOWER attachment to Mister Sinister and shuffle the rest of
 * that encounter set into the encounter deck (the set's other cards were set aside whole; the third set stays aside for
 * the whole game). The attachment is attached, not revealed: it has no When Revealed (docs/phase7-wave7.md §3.29).
 * The stage's "When Completed: Advance to the other stage 2A. If you cannot, advance to stage 3A" is the default walk
 * over the stored order, which the completion already pushes, so it prints no advance of its own to script (§3.28).
 */
const attachSuperpower = (attachment: string, setId: string) =>
  whenRevealed(
    selectCards("power", encounterSetAside(query("attachment", { name: attachment }))),
    attachCard(chosen("power"), theVillain),
    moveCards(encounterSetAside({ inEncounterSet: setId }), "encounterDeckShuffle"),
  );

export const MISTER_SINISTER: AbilityRegistry = defineAbilities({
  // Mister Sinister I-III — Forced Response: After a status card is placed on Mister Sinister, place 1 / 2 / 3 threat on
  // the main scheme.
  "40136.mister-sinister-forced-response": statusPlacedThreat(1),
  // II — When Revealed: Place 1[per_hero] threat on the main scheme (2[per_hero] instead if fewer than 2 SUPERPOWER
  // attachments). In expert mode the stage 2 main scheme is revealed first (MC40 p. 21), so he counts its attachment.
  "40137.when-revealed": revealedThreat(1, 2),
  "40137.mister-sinister-forced-response": statusPlacedThreat(2),
  // III — 2[per_hero] (3[per_hero] instead).
  "40138.when-revealed": revealedThreat(2, 3),
  "40138.mister-sinister-forced-response": statusPlacedThreat(3),

  // Sinister Intent 1A — Setup: Set aside the Flight, Super Strength, and Telepathy encounter sets. Put Hope Summers into
  // play under the first player's control. Both are the scenario builder's: the sets are `Scenario.setAsideCardIds`, and
  // Hope Summers' setup keyword puts her into play at Appendix II step 11 (Q20 = B: the set-aside attachments' own setup
  // keyword is exempted by this scenario's rule, MC40 p. 16, so they stay aside).
  "40139a.setup": coveredByEngineRule(),
  // 1B — When Revealed: Remove 1 random stage 2 from the game. Then advance to a random stage 2A.
  "40139b.when-revealed": whenRevealed(removeMainSchemeStages(2), shuffleMainSchemeStageGroup(2), advanceMainScheme()),

  // Taking Off / Bulking Up / Focusing In (40140-40142 b).
  "40140b.when-revealed": attachSuperpower("Flight", "flight"),
  "40140b.when-completed": coveredByEngineRule(),
  "40141b.when-revealed": attachSuperpower("Super Strength", "super_strength"),
  "40141b.when-completed": coveredByEngineRule(),
  "40142b.when-revealed": attachSuperpower("Telepathy", "telepathy"),
  "40142b.when-completed": coveredByEngineRule(),

  // Sinister Ends 3A — When Revealed: Deal each player 1 facedown encounter card.
  "40143a.when-revealed": whenRevealed(dealEncounterCard(eachPlayer)),
  // 3B — Forced Interrupt: When Mister Sinister attacks, he attacks Hope Summers instead. (Other characters may defend
  // the attack.) The attacked player becomes her controller (Q16 = A). "If this stage is completed, the players lose the
  // game" is `MainSchemeStage.completionLoses`.
  "40143b.sinister-ends-forced-interrupt": forcedInterrupt(on.villainAttacks(), retargetAttack(named("Hope Summers"))),

  // Sinister Disguise (40144) — Attach to Mister Sinister (data). Forced Interrupt: When a player would deal damage to
  // Mister Sinister, that player may spend [mental][mental] resources. If they do not, they deal that damage to the
  // friendly character with the fewest remaining hit points instead (a tie is the first player's choice, RRG 1.8 "First
  // Player", p. 19). Discard this card whether or not the resources were spent. The dealing player is the source's
  // controller, so damage no player deals (an encounter card's) never triggers it.
  "40144.sinister-disguise-forced-interrupt": forcedInterrupt(
    { ...on.damage("host"), sourceIs: query([], { controller: "other" }) },
    chooseOneBy(
      controllerOf(eventSource),
      option(
        "Spend [mental][mental] resources",
        { when: canPayResources({ mental: 2 }, controllerOf(eventSource)) },
        spendResources({ mental: 2 }, "spent", controllerOf(eventSource)),
      ),
      option(
        "Do not spend resources: deal that damage to the friendly character with the fewest remaining hit points",
        bindTargets("lowest", superlative("lowest", each(FRIENDLY), remainingHpOf(chosen("candidate")))),
        chooseTarget("victim", { inSlot: "lowest" }, { chooser: firstPlayer }),
        instead(dealDamage(eventAmount, chosen("victim"), { sourceFromEvent: true })),
      ),
    ),
    discard(self),
  ),

  // Sinister Soldier (40145) — [star] gets +1 SCH and +1 ATK for each SUPERPOWER attachment on Mister Sinister.
  "40145.sinister-soldier-constant": constant(
    gets("sch", SUPERPOWER_ATTACHMENTS, { self: true }),
    gets("atk", SUPERPOWER_ATTACHMENTS, { self: true }),
  ),
  // [star] Boost: For this activation, Mister Sinister gets +1 SCH and +1 ATK for each SUPERPOWER attachment on him. Only
  // when he is the one activating (the boost's bonus is his); an attack reads the ATK, a scheme the SCH.
  "40145.boost": boost(
    ifThen(
      refMatches(activatingEnemy, THE_VILLAIN),
      modifyAttack({ atkBonus: SUPERPOWER_ATTACHMENTS, threatBonus: SUPERPOWER_ATTACHMENTS }),
    ),
  ),

  // Teleported Away (40146) — Hinder 1[per_hero] (data). Mister Sinister cannot take damage.
  "40146.teleported-away-constant": constant(rule({ kind: "cannotTakeDamage", target: THE_VILLAIN } as RuleSpec)),
  // Forced Interrupt: When Mister Sinister would attack, he schemes instead. A replacement of the attack itself (Hope's
  // Captor's reading, Q9 = A): heard before Sinister Ends redirects, and the scheme gets the attack's boost card.
  "40146.teleported-away-forced-interrupt": forcedInterrupt(
    on.villainAttacks(),
    { would: true },
    instead(enemyScheme(theVillain)),
  ),

  // Genetic Mastery (40147) — When Revealed: If Mister Sinister has the following traits: AERIAL — take 2 indirect
  // damage; BRUTE — exhaust your identity; PSIONIC — place 2 threat on the main scheme. Each trait he has applies, in
  // the order printed.
  "40147.when-revealed": whenRevealed(
    ifThen(hasTrait(theVillain, AERIAL), dealIndirectDamage(you, 2)),
    ifThen(hasTrait(theVillain, BRUTE), exhaust(yourIdentity)),
    ifThen(hasTrait(theVillain, PSIONIC), placeThreat(2, theMainScheme)),
  ),

  // Molecular Control (40148) — When Revealed: Give Mister Sinister a tough status card. If he has the BRUTE trait, he
  // heals 4 damage. [star] Boost: Give Mister Sinister a tough status card. (Either way the tough card is a status card
  // placed on him, so his Forced Response answers it.)
  "40148.when-revealed": whenRevealed(giveTough(theVillain), ifThen(hasTrait(theVillain, BRUTE), heal(4, theVillain))),
  "40148.boost": boost(giveTough(theVillain)),

  // Sinister Schemes (40149) — When Revealed: Mister Sinister schemes. If he has the PSIONIC trait, you are confused.
  // [star] Boost: You are confused.
  "40149.when-revealed": whenRevealed(
    enemyScheme(theVillain),
    ifThen(hasTrait(theVillain, PSIONIC), confuse(yourIdentity)),
  ),
  "40149.boost": boost(confuse(yourIdentity)),

  // Sinister Strike (40150) — When Revealed (Alter-Ego): This card gains surge. (Hero): Mister Sinister attacks you. If he
  // has the AERIAL trait, you are stunned. [star] Boost: You are stunned.
  "40150.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  "40150.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you }),
    ifThen(hasTrait(theVillain, AERIAL), stun(yourIdentity)),
  ),
  "40150.boost": boost(stun(yourIdentity)),
});
