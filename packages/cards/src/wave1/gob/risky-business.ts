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
  faceNamed,
  removeCounters,
  STATE_OF_MADNESS,
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

  // Criminal Enterprise / State of Madness (02006a/02006b) — KNOWN_SKIPPED, see coverage.test.ts: the card data
  // provides only one ability ref per face (`02006a.criminal-enterprise-constant` / `02006b.state-of-madness-
  // constant`) for a two-mechanism behavior (docs/phase7-wave1.md §3.4): a persistent, edge-triggered "if there
  // are no infamy/madness counters here, flip" check (`AbilityTriggerSpec.stateCheck`) plus an independent forced
  // response to entering play/flipping that places the starting counters (`AbilityDefinition.trigger` is one
  // trigger per ability id — the two cannot be merged into one `AbilityDefinition`). The schema's own test fixture
  // (`packages/content/src/schema/wave1.test.ts` lines 223-245) shows the intended two-ref shape for this exact
  // card ("02006a.enters-with-infamy" + "02006a.flip"); the real `GOB_CARDS` data was curated with only one. A
  // data gap for `card-data-pipeline`, not an engine/DSL gap — the flip mechanism itself is proven end to end with
  // synthetic stubs in `packages/engine/src/flip.test.ts`.

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

/** Recorded gaps: see the comments beside `02006a`/`02006b`/`02007.when-revealed` above. */
export const RISKY_BUSINESS_SKIPPED = ["02006a.criminal-enterprise-constant", "02006b.state-of-madness-constant", "02007.when-revealed"] as const;
