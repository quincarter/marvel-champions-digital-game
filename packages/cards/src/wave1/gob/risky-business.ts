import {
  addCounters,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  countersOn,
  dealDamage,
  defineAbilities,
  each,
  eachPlayer,
  encounterCards,
  eventAmount,
  firstPlayer,
  forcedInterrupt,
  forcedResponse,
  forEachPlayer,
  ifThen,
  inPlay,
  instead,
  isHero,
  moveCards,
  named,
  not,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  remainingHpOf,
  selectCards,
  self,
  setup,
  shuffleEncounterDeck,
  surge,
  thatPlayer,
  theVillain,
  topOfDeck,
  varAtLeast,
  when,
  whenRevealed,
  you,
} from "../../dsl/index.js";
import {
  CRIMINAL_ENTERPRISE,
  dealIndirectDamage,
  enemyAttackCharacter,
  entersPlayOrFlipsHere,
  faceNamed,
  flipCard,
  flipsHere,
  noCounters,
  removeCounters,
  STATE_OF_MADNESS,
  stateCheck,
  superlative,
  whenCompleted,
} from "./local.js";

const infamyOrMadness = (n: number) =>
  ifThen(inPlay(CRIMINAL_ENTERPRISE), addCounters("infamy", n, named(CRIMINAL_ENTERPRISE)), removeCounters("madness", n, named(STATE_OF_MADNESS)));

/**
 * Risky Business: Norman Osborn / Green Goblin (02001a), Hostile Takeover (02004a), Criminal Enterprise / State of
 * Madness (02006a), Hired Gun (02007), Private Security Specialist (02008), Collapsing Bridge (02009), Oscorp
 * Manufacturing (02010), Payoff (02011), All in a Day's Work (02012), Mad Genius (02013).
 */
export const RISKY_BUSINESS = defineAbilities({
  // Norman Osborn (I/II/III) — [star] Forced Interrupt: When Norman Osborn would attack, place N infamy counter(s)
  // on Criminal Enterprise instead. Forced Interrupt: When Norman Osborn would take any amount of damage, remove
  // that many infamy counters from Criminal Enterprise instead.
  "02001a.norman-osborn-forced-interrupt": forcedInterrupt(when.enemyAttacks("self"), instead(addCounters("infamy", 1, named(CRIMINAL_ENTERPRISE)))),
  "02001a.norman-osborn-forced-interrupt-2": forcedInterrupt(when.damage("self"), instead(removeCounters("infamy", eventAmount, named(CRIMINAL_ENTERPRISE)))),
  "02002a.norman-osborn-forced-interrupt": forcedInterrupt(when.enemyAttacks("self"), instead(addCounters("infamy", 2, named(CRIMINAL_ENTERPRISE)))),
  "02002a.norman-osborn-forced-interrupt-2": forcedInterrupt(when.damage("self"), instead(removeCounters("infamy", eventAmount, named(CRIMINAL_ENTERPRISE)))),
  "02003a.norman-osborn-forced-interrupt": forcedInterrupt(when.enemyAttacks("self"), instead(addCounters("infamy", 3, named(CRIMINAL_ENTERPRISE)))),
  "02003a.norman-osborn-forced-interrupt-2": forcedInterrupt(when.damage("self"), instead(removeCounters("infamy", eventAmount, named(CRIMINAL_ENTERPRISE)))),

  // Green Goblin (I) — When Revealed: Deal 3 indirect damage to each player in hero form.
  // [star] Forced Interrupt: When Green Goblin would scheme, remove 1 madness counter from State of Madness instead.
  "02001b.when-revealed": whenRevealed(forEachPlayer(eachPlayer, ifThen(isHero(thatPlayer), dealIndirectDamage(3, thatPlayer)))),
  "02001b.green-goblin-forced-interrupt": forcedInterrupt(when.enemySchemes("self"), instead(removeCounters("madness", 1, named(STATE_OF_MADNESS)))),
  // Green Goblin (II) — When Revealed: Deal 3 indirect damage to each player (no hero-form restriction this stage).
  "02002b.when-revealed": whenRevealed(dealIndirectDamage(3, eachPlayer)),
  "02002b.green-goblin-forced-interrupt": forcedInterrupt(when.enemySchemes("self"), instead(removeCounters("madness", 1, named(STATE_OF_MADNESS)))),
  // Green Goblin (III) — When Revealed: Deal 4 damage (direct, not indirect) to each player.
  "02003b.when-revealed": whenRevealed(dealDamage(4, each(query("identity")))),
  "02003b.green-goblin-forced-interrupt": forcedInterrupt(when.enemySchemes("self"), instead(removeCounters("madness", 2, named(STATE_OF_MADNESS)))),

  // Hostile Takeover 1A — Setup: Put the Criminal Enterprise environment into play. Shuffle the encounter deck.
  // Advance to stage 1B (implicit, klaw.ts/rhino.ts convention). `firstPlayer`/`selectCards`+`encounterCards`, not
  // `you`/`named`: a setup ability resolves with no "current player" context (the `ultron.ts` "Ultron Drones"
  // convention), and the environment is still an un-shuffled deck card at this point, not yet a recognized `named` target.
  "02004a.setup": setup(
    selectCards("enterprise", encounterCards(["deck"], { name: CRIMINAL_ENTERPRISE })),
    putIntoPlay(chosen("enterprise"), firstPlayer),
    shuffleEncounterDeck(),
  ),
  // Hostile Takeover 1B — When Completed: Place 1[per_hero] infamy counters on Criminal Enterprise. Then discard 1
  // card from each player's deck for each infamy counter on Criminal Enterprise (read after the placement above).
  "02004b.when-completed": whenCompleted(
    addCounters("infamy", perHero(1), named(CRIMINAL_ENTERPRISE)),
    forEachPlayer(eachPlayer, moveCards(topOfDeck(countersOn(named(CRIMINAL_ENTERPRISE), "infamy"), thatPlayer), "discard")),
  ),
  // Corporate Acquisition 2A — When Revealed: Advance to stage 2B (implicit).
  "02005a.when-revealed": whenRevealed(),

  // Criminal Enterprise (02006a) — "Criminal Enterprise enter play with 2[per_hero] infamy counters on it. If
  // there are no infamy counters here, flip Norman Osborn and Criminal Enterprise."
  // State of Madness (02006b) — the same, with madness counters and Green Goblin.
  //
  // This is the scenario's entire win condition, so it is worth spelling out: Norman Osborn cannot be damaged at
  // all (his Forced Interrupt above turns damage into removed infamy counters), so the only way past him is to
  // strip those counters and flip him into Green Goblin, who can be damaged. Without these four abilities the
  // scenario has no reachable ending — the counters never arrive and the flip never fires.
  //
  // Two abilities per face, because they are two mechanisms and an `AbilityDefinition` carries one trigger: a
  // forced response that places the starting counters, and a persistent `stateCheck` that flips both cards once
  // they run out (docs/phase7-wave1.md §3.4). The state check is edge-triggered and a first observation only
  // records, which is what lets the counters be placed by a response to the same entering-play event without the
  // still-empty card flipping itself first.
  //
  // §4.1's reading — the new face's "enter play with N counters" applies on a flip — is why the front face
  // listens for `cardFlipped` as well as `cardEntersPlay`, and why the back face (only ever reached by a flip)
  // listens for `cardFlipped` alone. Without it State of Madness would arrive empty and flip straight back.
  "02006a.enters-with-infamy": forcedResponse(entersPlayOrFlipsHere, addCounters("infamy", perHero(2), self)),
  "02006a.flip": stateCheck(noCounters(self, "infamy"), flipCard(theVillain), flipCard(self)),
  "02006b.enters-with-madness": forcedResponse(flipsHere, addCounters("madness", perHero(2), self)),
  "02006b.flip": stateCheck(noCounters(self, "madness"), flipCard(theVillain), flipCard(self)),

  // Hired Gun — When Revealed: Choose to either give the villain 1 facedown boost card or place 2 infamy counters
  // on Criminal Enterprise. KNOWN_SKIPPED (only the first option): "give the villain N facedown boost card(s)"
  // outside an ongoing activation (stockpiled for its *next* activation) has no engine primitive — `CardDestination`
  // has no villain-boost-area entry, and `EffectSpec.modifyAttack.extraBoostCards` only "changes the attack/
  // activation in progress" (`spec.ts`), which does not exist yet when a When Revealed resolves mid-turn.
  // [star] Boost: Place 1 infamy counter on Criminal Enterprise. If you cannot, remove 1 madness counter from State
  // of Madness (fully scriptable; docs/phase7-wave1.md §3.4's "addCounters plus if not made" pattern, read here as
  // `ifThen(inPlay(name), …)` since `addCounters` itself has no `bind`/success flag).
  "02007.boost": boost(infamyOrMadness(1)),

  // Private Security Specialist — Guard (data). [star] Boost: same infamy/madness pattern.
  "02008.boost": boost(infamyOrMadness(1)),

  // Collapsing Bridge — [star] Boost: same infamy/madness pattern.
  "02009.boost": boost(infamyOrMadness(1)),

  // Oscorp Manufacturing — When Revealed (Norman Osborn): Place an additional 1[per_hero] threat here. (Card data's
  // ability id says "-constant"; the printed text is a face-conditioned When Revealed.)
  "02010.oscorp-manufacturing-constant": whenRevealed(ifThen(faceNamed(theVillain, "Norman Osborn"), placeThreat(perHero(1), self))),

  // Payoff — [star] Boost: same infamy/madness pattern.
  "02011.boost": boost(infamyOrMadness(1)),

  // All in a Day's Work — When Revealed: Place 2 infamy counters on Criminal Enterprise. If you cannot, remove 2
  // madness counters from State of Madness. [star] Boost: same infamy/madness pattern (1 counter).
  "02012.when-revealed": whenRevealed(infamyOrMadness(2)),
  "02012.boost": boost(infamyOrMadness(1)),

  // Mad Genius — When Revealed (Green Goblin): Green Goblin attacks the hero with the fewest hit points remaining
  // (first player decides ties, the Clash of the Titans convention — `wave1/hlk/nemesis.ts`). If no attack was made
  // this way, this card gains surge.
  "02013.mad-genius-constant": whenRevealed(
    ifThen(
      faceNamed(theVillain, "Green Goblin"),
      [
        bindTargets("fewestHp", superlative("lowest", each(query("hero")), remainingHpOf(chosen("candidate")))),
        chooseTarget("target", { inSlot: "fewestHp" }, { chooser: firstPlayer }),
        enemyAttackCharacter(theVillain, chosen("target"), "genius"),
        ifThen(not(varAtLeast("genius.made")), surge()),
      ],
    ),
  ),
  // Mad Genius — When Revealed (Norman Osborn): Discard the top card of your deck for each infamy counter on
  // Criminal Enterprise.
  "02013.mad-genius-constant-2": whenRevealed(
    ifThen(faceNamed(theVillain, "Norman Osborn"), moveCards(topOfDeck(countersOn(named(CRIMINAL_ENTERPRISE), "infamy"), you), "discard")),
  ),
});

/** Recorded gaps: see the comment beside `02007.when-revealed` above. */
export const RISKY_BUSINESS_SKIPPED = ["02007.when-revealed"] as const;
