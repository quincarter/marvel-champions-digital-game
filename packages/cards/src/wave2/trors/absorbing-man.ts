import { trait } from "@mc/content";
import {
  addCounters,
  ANY_RESOURCE,
  anyOf,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  coveredByEngineRule,
  countersOn,
  dealEncounterCard,
  dealIndirectDamage,
  defineAbilities,
  discard,
  discardAtRandom,
  discardEncounterUntil,
  discardFromHand,
  each,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  eventTarget,
  exhaust,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsTrait,
  gainsTraitsOf,
  giveBoostCard,
  giveTough,
  hasTrait,
  heal,
  heroAction,
  ifElse,
  ifThen,
  inPlay,
  moveCards,
  on,
  option,
  placeThreat,
  putIntoPlay,
  query,
  revealCard,
  scaled,
  searchAndReveal,
  self,
  setup,
  spend,
  spendResources,
  stun,
  surge,
  theMainScheme,
  theVillain,
  thatPlayer,
  undefendedAttack,
  valueAtLeast,
  valueEquals,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const ICE = trait("ICE");
const METAL = trait("METAL");
const STONE = trait("STONE");
const WOOD = trait("WOOD");
const SUPER_ABSORBING_POWER = cardName("04092");
const DELAY = "delay";
/** "5 or more delay counters on the main scheme" (Dense Forest, Snowy Hillside, Rocky Outcrop, Abandoned Facility, Stall Tactics). */
const HIGH_DELAY = valueAtLeast(countersOn(theMainScheme, DELAY), 5);

/**
 * The Absorbing Man scenario (`absorbing_man` encounter set, plus the Hydra Patrol modular set — no new cards of
 * its own beyond `trors/hawkeye-obligation-nemesis.ts`'s Hydra-nemesis pool): the villain (04076–04078), main
 * scheme "None Shall Pass" (04079), and his own encounter set (04080–04092).
 *
 * **Reading: "After resolving step one of the villain phase."** The engine has no dedicated trigger event for a
 * villain-phase step completing; step one's entire job (RRG 1.8 "Villain Phase", p. 46) is placing threat on the
 * main scheme from acceleration, and that IS an interruptible `placeThreat` event (`on.threatPlaced`). For a
 * standalone (non-separate-game-area) scenario, "after resolving step one" and "after the main scheme's step-one
 * threat is placed" are the same moment, so `forcedResponse(on.threatPlaced(query("mainScheme")), …)` is used
 * rather than inventing a new primitive for an event the engine already announces under a different name.
 *
 * **Reading: "Absorbing Man activates against you"** (04078's `[star]`) as "attacks you" (`on.villainAttacks`),
 * matching every other "against you" phrasing in this pack (Mockingbird, docs/phase7-wave2-scripting.md §6.6) —
 * RRG 1.8 "Against" isn't a defined term, but every other printed use of it in cycle 1 names an attack's target,
 * never a scheme activation's.
 *
 * **Data gap flagged for `card-data-pipeline` (docs/phase7-wave2-scripting.md):** Omni-Morph Duplication (04089)
 * prints one "When Revealed:" line followed by four bulleted sub-clauses, but the data carries FIVE ability refs
 * (`.when-revealed` plus four more suffixed `-constant`/`-constant-2/3/4`) — the whole bulleted list reads as one
 * ability (a single reveal effect with four trait-conditional branches), so the four "constant" refs look like a
 * parser artifact that split the bullets into spurious extra ids rather than one that a reader would expect to
 * carry a genuinely independent constant ability. They're stood up as empty (`coveredByEngineRule()`) rather than
 * left unscripted, since `.when-revealed` already carries all four branches faithfully.
 */
export const ABSORBING_MAN_SET = defineAbilities({
  // Absorbing Man (I) — Absorbing Man gains the trait of each environment in play.
  "04076.absorbing-man-constant": constant(gainsTraitsOf(query("environment"), query("villain", { self: true }))),
  // Absorbing Man (II) — same constant, plus When Revealed: if Super Absorbing Power is in play, deal 1 encounter
  // card to each player. Otherwise, search for it and reveal it (entering play), shuffling only if searched.
  "04077.absorbing-man-constant": constant(gainsTraitsOf(query("environment"), query("villain", { self: true }))),
  "04077.when-revealed": whenRevealed(
    ifThen(
      inPlay(SUPER_ABSORBING_POWER),
      dealEncounterCard(eachPlayer),
      searchAndReveal(SUPER_ABSORBING_POWER, ["deck", "discard"], firstPlayer),
    ),
  ),
  // Absorbing Man (III) — same constant, plus Forced Response: after he activates against you, Ice/Stone place 1
  // threat; Metal/Wood take 1 indirect damage. The four extra ability refs the data carries beyond the response
  // (`-constant-2`/`-3`) are the same "gains the trait" constant repeated per stage in the source data; only the
  // first (`04078.absorbing-man-constant`) needs a body since the trigger reads the villain's current traits live.
  "04078.absorbing-man-constant": constant(gainsTraitsOf(query("environment"), query("villain", { self: true }))),
  "04078.absorbing-man-forced-response": forcedResponse(
    on.villainAttacks({ againstYou: true }),
    ifThen(anyOf(hasTrait(theVillain, ICE), hasTrait(theVillain, STONE)), placeThreat(1, theMainScheme)),
    ifThen(anyOf(hasTrait(theVillain, METAL), hasTrait(theVillain, WOOD)), dealIndirectDamage(you, 1)),
  ),
  "04078.absorbing-man-constant-2": coveredByEngineRule(),
  "04078.absorbing-man-constant-3": coveredByEngineRule(),

  // None Shall Pass 1A — Setup: discard until an environment is found, put it into play, shuffle the discard back
  // into the encounter deck.
  "04079a.setup": setup(
    discardEncounterUntil(query("environment"), "found"),
    putIntoPlay(chosen("found"), firstPlayer),
    moveCards(encounterCards(["discard"]), "encounterDeckShuffle"),
  ),
  // None Shall Pass — Forced Response: after resolving step one of the villain phase, place 1 delay counter here.
  "04079b.none-shall-pass-forced-response": forcedResponse(
    on.threatPlaced(query("mainScheme")),
    addCounters(DELAY, 1, self),
  ),
  // None Shall Pass — Forced Interrupt: when an environment enters play, discard each other environment card in
  // play. `cardEntersPlay` is now interruptible (its own enter-play keywords resolve as that event's *apply* step,
  // not before it's announced), and `TargetQuery.excluding` names "every environment except the one that just
  // entered" (docs/phase7-wave2.md §3.13.10) — this was pinned in `KNOWN_SKIPPED` pending both.
  "04079b.none-shall-pass-forced-interrupt": forcedInterrupt(
    on.entersPlay(query("environment")),
    discard(each(query("environment", { excluding: eventTarget }))),
  ),

  // Dense Forest / Snowy Hillside / Rocky Outcrop / Abandoned Facility — Surge (data). Forced Response: after
  // Absorbing Man makes an undefended attack against you, a worse effect if 5+ delay counters on the main scheme.
  // [star] Boost: Put this card into play.
  "04080.dense-forest-forced-response": forcedResponse(
    on.villainAttacks({ againstYou: true }),
    ifThen(undefendedAttack, dealIndirectDamage(you, ifElse(HIGH_DELAY, 2, 1))),
  ),
  "04080.boost": boost(putIntoPlay(self, firstPlayer)),
  "04081.snowy-hillside-forced-response": forcedResponse(
    on.villainAttacks({ againstYou: true }),
    ifThen(undefendedAttack, placeThreat(ifElse(HIGH_DELAY, 2, 1), theMainScheme)),
  ),
  "04081.boost": boost(putIntoPlay(self, firstPlayer)),
  "04082.rocky-outcrop-forced-response": forcedResponse(
    on.villainAttacks({ againstYou: true }),
    ifThen(undefendedAttack, heal(ifElse(HIGH_DELAY, 2, 1), theVillain)),
  ),
  "04082.boost": boost(putIntoPlay(self, firstPlayer)),
  "04083.abandoned-facility-forced-response": forcedResponse(
    on.villainAttacks({ againstYou: true }),
    ifThen(undefendedAttack, discardFromHand(ifElse(HIGH_DELAY, 2, 1), you, { filter: ANY_RESOURCE })),
  ),
  "04083.boost": boost(putIntoPlay(self, firstPlayer)),

  // Ball and Chain — Attach to Absorbing Man (data). Hero Action: spend a [physical] resource → shuffle this card
  // into the encounter deck. [star] Boost: Reveal this card.
  "04084.ball-and-chain-action": heroAction(
    { cost: spend({ physical: 1 }) },
    moveCards({ kind: "ref", ref: self }, "encounterDeckShuffle"),
  ),
  "04084.boost": boost(revealCard(self, firstPlayer)),

  // Stall Tactics — When Revealed: place 1 threat per 2 delay counters; if that's 0, gain surge instead. [star]
  // Boost: if 5+ delay counters, take 1 indirect damage.
  "04085.when-revealed": whenRevealed(
    ifThen(
      valueEquals(scaled(countersOn(theMainScheme, DELAY), { divide: { by: 2, round: "down" } }), 0),
      surge(),
      placeThreat(scaled(countersOn(theMainScheme, DELAY), { divide: { by: 2, round: "down" } }), theMainScheme),
    ),
  ),
  "04085.boost": boost(ifThen(HIGH_DELAY, dealIndirectDamage(you, 1))),

  // Swinging Stone — When Revealed (Alter-Ego): Absorbing Man schemes (+1 SCH if he has the Stone trait). When
  // Revealed (Hero): Absorbing Man attacks you (+1 ATK if Stone).
  "04086.when-revealed-alter-ego": whenRevealedAlterEgo(
    enemyScheme(theVillain, { schBonus: ifElse(hasTrait(theVillain, STONE), 1, 0) }),
  ),
  "04086.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you, atkBonus: ifElse(hasTrait(theVillain, STONE), 1, 0) }),
  ),

  // Steel Kick — When Revealed (Alter-Ego): place 2 threat (3 if Metal). When Revealed (Hero): take 3 indirect
  // damage (4 if Metal).
  "04087.when-revealed-alter-ego": whenRevealedAlterEgo(
    placeThreat(ifElse(hasTrait(theVillain, METAL), 3, 2), theMainScheme),
  ),
  "04087.when-revealed-hero": whenRevealedHero(dealIndirectDamage(you, ifElse(hasTrait(theVillain, METAL), 4, 3))),

  // Piercing Thorns — When Revealed: discard 1 card at random from your hand; if Absorbing Man has the Wood
  // trait, also discard 1 card you control. [star] Boost: if Stone or Wood, you are stunned.
  "04088.when-revealed": whenRevealed(
    discardAtRandom(1, you),
    ifThen(hasTrait(theVillain, WOOD), [
      chooseTarget("controlled", query(["ally", "upgrade", "support"], { controller: "you" })),
      discard(chosen("controlled")),
    ]),
  ),
  "04088.boost": boost(ifThen(anyOf(hasTrait(theVillain, STONE), hasTrait(theVillain, WOOD)), stun(yourIdentity))),

  // Omni-Morph Duplication — When Revealed: branch on Absorbing Man's current trait (module docblock: the other
  // four ability refs the data carries are a parser artifact, stood up empty below).
  "04089.when-revealed": whenRevealed(
    ifThen(hasTrait(theVillain, ICE), exhaust(yourIdentity)),
    ifThen(hasTrait(theVillain, METAL), [giveTough(theVillain), heal(1, theVillain)]),
    ifThen(hasTrait(theVillain, STONE), giveBoostCard(theVillain, 1)),
    ifThen(hasTrait(theVillain, WOOD), discardAtRandom(1, you)),
  ),
  "04089.omni-morph-duplication-constant": coveredByEngineRule(),
  "04089.omni-morph-duplication-constant-2": coveredByEngineRule(),
  "04089.omni-morph-duplication-constant-3": coveredByEngineRule(),
  "04089.omni-morph-duplication-constant-4": coveredByEngineRule(),

  // Icy Grip — When Revealed: you are stunned; if Ice, also take 2 indirect damage. [star] Boost: if Ice or
  // Metal, give the villain a tough status card.
  "04090.when-revealed": whenRevealed(
    stun(yourIdentity),
    ifThen(hasTrait(theVillain, ICE), dealIndirectDamage(you, 2)),
  ),
  "04090.boost": boost(ifThen(anyOf(hasTrait(theVillain, ICE), hasTrait(theVillain, METAL)), giveTough(theVillain))),

  // Avalanche! — When Revealed: each player must choose to spend an [energy] resource or take indirect damage
  // (worse if 5+ delay counters).
  "04091.when-revealed": whenRevealed(
    forEachPlayer(
      eachPlayer,
      chooseOne(
        option("Spend a [energy] resource", spendResources({ energy: 1 }, "spent", thatPlayer)),
        option("Take indirect damage", dealIndirectDamage(thatPlayer, ifElse(HIGH_DELAY, 3, 2))),
      ),
    ),
  ),

  // Super Absorbing Power — Absorbing Man gains the Ice, Metal, Stone and Wood traits. [star] Boost: reveal this card.
  "04092.super-absorbing-power-constant": constant(
    gainsTrait(ICE, query("villain")),
    gainsTrait(METAL, query("villain")),
    gainsTrait(STONE, query("villain")),
    gainsTrait(WOOD, query("villain")),
  ),
  "04092.boost": boost(revealCard(self, firstPlayer)),
});
