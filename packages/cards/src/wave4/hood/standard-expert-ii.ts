import {
  anyOfCards,
  attackInProgress,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardEncounterUntil,
  each,
  eachPlayer,
  encounterCards,
  enemyAttack,
  enemyScheme,
  exists,
  exhaust,
  firstPlayer,
  forEachPlayer,
  gainsKeyword,
  giveBoostCard,
  ifElse,
  ifThen,
  modifyAttack,
  placeThreat,
  printedCostOf,
  putIntoPlay,
  query,
  refMatches,
  revealCard,
  selectCards,
  setAside,
  shuffleEncounterDeck,
  superlative,
  surge,
  takeDamage,
  thatPlayer,
  theVillain,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
} from "../../dsl/index.js";

/**
 * The Hood's alternative difficulty sets (`hood` 24029–24032 Expert II, 24049–24054 Standard II; docs/phase7-wave4.md
 * §1.9, §4 Q5). The Hood insert p. 2, "Alternative Sets": each "may be used instead" of Core's Standard / Expert set
 * wherever a scenario requires that set, a setup choice (`DifficultySetChoice`, `CoreScenarioOptions.difficultySets`).
 *
 * Shadow of the Past (24053) is Core's 01190 reprinted and resolves through `../reprints.ts`. Formidable Foe (24049a/b)
 * enters play on the face its "Standard/Expert Mode Only" line names (§3.18, `modeOnly`); each face's steady grant is
 * scripted here.
 */

const YOUR_UPGRADES_AND_SUPPORTS = query(["upgrade", "support"], { controller: "you" });

/** "Give the villain 1 additional boost card for this activation." */
const oneMoreBoostCard = () => modifyAttack({ extraBoostCards: 1 });

export const STANDARD_EXPERT_II = defineAbilities({
  // --- Expert II -------------------------------------------------------------------------------------------------

  // Cruel Intentions (24029; Peril, Surge are data) — When Revealed: deal each player 1 facedown encounter card. Give
  // the villain 1 facedown boost card. [star] Boost: deal yourself 1 facedown encounter card.
  "24029.when-revealed": whenRevealed(
    forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer)),
    giveBoostCard(theVillain),
  ),
  "24029.boost": boost(dealEncounterCard(you)),

  // Ruination (24030; Incite 1, Peril are data) — When Revealed: discard cards from the top of the encounter deck until a
  // side scheme is discarded. Reveal that card. Place 2 threat on each scheme in play (the revealed one included: it
  // is in play once its own reveal has resolved).
  "24030.when-revealed": whenRevealed(
    discardEncounterUntil(query("sideScheme"), "found"),
    revealCard(chosen("found")),
    placeThreat(2, each(query("scheme"))),
  ),

  // Seek and Destroy (24031; Incite 1, Peril are data) — When Revealed: search the encounter deck, discard pile, and
  // set-aside area for your nemesis minion and put it into play engaged with you. (Shuffle.) The rest of the nemesis set
  // stays set aside (unlike Shadow of the Past); a nemesis minion already in play is in none of those areas, so
  // nothing happens beyond the shuffle.
  "24031.when-revealed": whenRevealed(
    selectCards(
      "nemesis",
      anyOfCards(
        encounterCards(["deck", "discard"], query("minion", { nemesisMinionOf: you })),
        setAside(you, query("minion", { nemesisMinionOf: you })),
      ),
    ),
    putIntoPlay(chosen("nemesis"), you),
    shuffleEncounterDeck(),
  ),

  // Slug It Out (24032; Peril, Surge are data) — When Revealed: exhaust your identity. Take 2 damage. [star] Boost: deal
  // 1 damage to each character you control. Give the villain 1 additional boost card for this activation.
  "24032.when-revealed": whenRevealed(exhaust(yourIdentity), takeDamage(2)),
  "24032.boost": boost(dealDamage(1, each(query("character", { controller: "you" }))), oneMoreBoostCard()),

  // --- Standard II -----------------------------------------------------------------------------------------------

  // Formidable Foe (24049a Standard face / 24049b Expert face; Permanent, Setup, modeOnly are data) — "The villain
  // gains steady." / "Each enemy gains steady."
  "24049a.formidable-foe-constant": constant(gainsKeyword({ name: "steady" }, query("villain"))),
  "24049b.formidable-foe-constant": constant(gainsKeyword({ name: "steady" }, query("enemy"))),

  // Dark Dealings (24050) — When Revealed: the villain schemes with +1 SCH. [star] Boost: give the villain 1 additional
  // boost card for this activation.
  "24050.when-revealed": whenRevealed(enemyScheme(theVillain, { schBonus: 1 })),
  "24050.boost": boost(oneMoreBoostCard()),

  // Mob Mentality (24051) — When Revealed (Alter-Ego): discard the top 7 cards from the encounter deck. Put the first
  // minion discarded this way into play engaged with you. When Revealed (Hero): the villain and each minion engaged
  // with you attacks you. This card gains surge.
  // "The first minion discarded this way": the discarded cards are bound in discard order, and a superlative that
  // scores a minion 1 and anything else 0 with `ties: "first"` picks the first minion; with no minion discarded it
  // picks a non-minion, which the guard leaves in the discard pile.
  "24051.when-revealed-alter-ego": whenRevealedAlterEgo(
    discardEncounterCards(7, { bind: "discarded" }),
    bindTargets(
      "first",
      superlative(
        "highest",
        chosen("discarded"),
        ifElse(refMatches(chosen("candidate"), query("minion"), { anywhere: true }), 1, 0),
        { ties: "first" },
      ),
    ),
    ifThen(refMatches(chosen("first"), query("minion"), { anywhere: true }), putIntoPlay(chosen("first"), you)),
  ),
  "24051.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you }),
    enemyAttack(each(query("minion", { engagedWith: "you" })), { against: you }),
    surge(),
  ),

  // Overwhelming Force (24052) — When Revealed: discard the highest-cost upgrade or support you control. If no card was
  // discarded this way, this card gains surge. [star] Boost: give the villain 1 additional boost card for this
  // activation. A tie is broken by the first player (RRG 1.8 "First Player", p. 19: an encounter card with several
  // eligible targets), as Core's Caught Off Guard does.
  "24052.when-revealed": whenRevealed(
    ifThen(
      exists(YOUR_UPGRADES_AND_SUPPORTS),
      [
        bindTargets(
          "highest",
          superlative("highest", each(YOUR_UPGRADES_AND_SUPPORTS), printedCostOf(chosen("candidate"))),
        ),
        chooseTarget("pick", { inSlot: "highest" }, { chooser: firstPlayer }),
        discard(chosen("pick")),
      ],
      surge(),
    ),
  ),
  "24052.boost": boost(oneMoreBoostCard()),

  // Total Annihilation (24054; Surge is data) — When Revealed (Hero): the villain attacks you. That attack gains
  // overkill. [star] Boost: if the villain is attacking, this attack gains overkill.
  "24054.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you, keywords: ["overkill"] })),
  "24054.boost": boost(
    ifThen(attackInProgress({ attacker: { categories: ["villain"] } }), modifyAttack({ overkill: true })),
  ),
});
