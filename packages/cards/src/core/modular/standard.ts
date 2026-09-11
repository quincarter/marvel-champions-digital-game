import {
  chooseTarget,
  chosen,
  defineAbilities,
  discard,
  discardEncounterUntil,
  each,
  enemyAttack,
  enemyScheme,
  exhaust,
  exists,
  firstPlayer,
  ifThen,
  moveCards,
  not,
  placeThreat,
  query,
  revealCard,
  revealEncounterCard,
  selectCards,
  setAside,
  surge,
  theVillain,
  varAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourIdentity,
} from "../../dsl/index.js";

const YOUR_UPGRADES_AND_SUPPORTS = query(["upgrade", "support"], { controller: "you" });

/** The Standard encounter set (01186–01190). */
export const STANDARD_SET = defineAbilities({
  // Advance — When Revealed: The villain schemes.
  "01186.when-revealed": whenRevealed(enemyScheme(theVillain)),
  // Assault — When Revealed (Alter-Ego): This card gains surge. / When Revealed (Hero): The villain attacks you.
  "01187.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  "01187.when-revealed-hero": whenRevealedHero(enemyAttack(theVillain, { against: you })),
  // Caught Off Guard — When Revealed: Discard an upgrade or support you control. If no cards were discarded this way, this card gains surge.
  // No "choose": the card targets, so with several eligible cards the first player selects (RRG "First Player").
  "01188.when-revealed": whenRevealed(
    ifThen(
      exists(YOUR_UPGRADES_AND_SUPPORTS),
      [chooseTarget("card", YOUR_UPGRADES_AND_SUPPORTS, { chooser: firstPlayer }), discard(chosen("card"))],
      surge(),
    ),
  ),
  // Gang-Up — When Revealed (Alter-Ego): This card gains surge. / When Revealed (Hero): The villain and each minion engaged with you attacks you.
  "01189.when-revealed-alter-ego": whenRevealedAlterEgo(surge()),
  "01189.when-revealed-hero": whenRevealedHero(
    enemyAttack(theVillain, { against: you }),
    enemyAttack(each(query("minion", { engagedWith: "you" })), { against: you }),
  ),
  // Shadow of the Past — When Revealed: Reveal your set-aside nemesis minion and put it into play engaged with you. Reveal your
  // set-aside nemesis side scheme and put it into play. Shuffle the rest of your set-aside nemesis encounter set into the encounter
  // deck. If your nemesis minion does not enter the game this way, this card gains surge.
  "01190.when-revealed": whenRevealed(
    selectCards("nemesisMinion", setAside(you, query("minion"))),
    revealCard(chosen("nemesisMinion")),
    selectCards("nemesisScheme", setAside(you, query("sideScheme"))),
    revealCard(chosen("nemesisScheme")),
    moveCards(setAside(you), "encounterDeckShuffle"),
    ifThen(not(varAtLeast("nemesisMinion.count")), surge()),
  ),
});

/** The Expert encounter set (01191–01193). */
export const EXPERT_SET = defineAbilities({
  // Exhaustion — Surge. When Revealed: Exhaust your identity card.
  "01191.when-revealed": whenRevealed(exhaust(yourIdentity)),
  // Masterplan — When Revealed: Place 4 threat on each side scheme. If there are no side schemes in play, discard cards from the
  // top of the encounter deck until a side scheme is discarded. Reveal that side scheme.
  "01192.when-revealed": whenRevealed(
    ifThen(
      exists(query("sideScheme")),
      placeThreat(4, each(query("sideScheme"))),
      [discardEncounterUntil(query("sideScheme"), "found"), revealCard(chosen("found"))],
    ),
  ),
  // Under Fire — Surge. When Revealed: Reveal the top card of the encounter deck.
  "01193.when-revealed": whenRevealed(revealEncounterCard(you)),
});
