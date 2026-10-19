import { trait } from "@mc/content";
import type { AbilityRegistry, Predicate, PlayerRef } from "@mc/engine";
import {
  addCounters,
  allOf,
  boost,
  chooseCards,
  chooseTarget,
  chosen,
  defineAbilities,
  eitherCost,
  encounterCards,
  exhaustCardsCost,
  firstPlayer,
  forcedResponse,
  hasStatus,
  heroAction,
  ifElse,
  ifThen,
  not,
  placeThreat,
  query,
  refMatches,
  removeCountersFrom,
  revealCard,
  self,
  shuffleEncounterDeck,
  spend,
  varAtLeast,
  whenRevealed,
  you,
} from "../../../dsl/index.js";

/** The character a Disaster's exhaust cost picked (`exhaustCardsCost`'s default slot). */
const EXHAUSTED = chosen("exhausted");

/**
 * A Disaster environment's Hero Action: "Spend [X][X] resources or exhaust a hero or ally you control -> remove 1 civilian
 * counter from here (2 instead if you exhausted a [bonus] character)." One `eitherCost`: branch 0 spends, branch 1
 * exhausts a hero or ally the player controls. The bonus reads the exhausted character, so it needs branch 1
 * (`cost.branch`). The last counter removed discards the card (Uses is data, RRG 1.8 "Uses", p. 46).
 */
const disasterAction = (resource: "mental" | "energy" | "physical", bonus: Predicate) =>
  heroAction(
    { cost: eitherCost(spend({ [resource]: 2 }), exhaustCardsCost(query(["hero", "ally"], { controller: "you" }))) },
    removeCountersFrom(self, "civilian", ifElse(allOf(varAtLeast("cost.branch", 1), bonus), 2, 1)),
  );

const DISASTER_ENVIRONMENT = query("environment", { trait: trait("DISASTER") });

/**
 * "Place 1 civilian counter on a Disaster environment". The When Revealed has Peril, so the revealing player picks
 * (RRG 1.8 "Peril", p. 32: they cannot consult the other players); the Boost has no Peril, so the first player picks.
 */
const placeCivilian = (chooser: PlayerRef, bind?: string) => [
  // No "choose": an encounter card targeting one of several eligible cards; the first player selects
  // (RRG 1.8 "First Player", p. 19), except under Peril.
  chooseTarget("environment", DISASTER_ENVIRONMENT, { chooser }),
  addCounters("civilian", 1, chosen("environment"), bind ? { bind } : {}),
];

/**
 * The Disasters modular set (docs/phase7-wave11-scenarios.md section S6).
 *
 * **60177-60179 Mystic Incursion, Sinking Ferry, Towering Inferno**: `disasterAction`; the bonus is a Mystic character,
 * an Aerial character, or a character with a tough status card, read from the card the exhaust cost picked.
 * **60180 Collapsing Bridge**: Hinder and the starting threat are data. The Forced Response answers any removal that
 * took threat off it (`removeThreat` on itself, which only fires for a removal of at least 1).
 * **60181 Bystanders in Peril**: Peril is data. When Revealed: the revealing player (Peril) picks a Disaster environment in play for the
 * counter; "if no counter was placed" (none in play) the encounter deck and discard pile are searched for one (the deck
 * is shuffled, RRG 1.8 "Search", p. 39) and it is revealed. The Boost places the counter the same way (the first player picks), with no search.
 *
 * Cards (5):
 * - 60177 Mystic Incursion (environment)
 * - 60178 Sinking Ferry (environment)
 * - 60179 Towering Inferno (environment)
 * - 60180 Collapsing Bridge (side_scheme)
 * - 60181 Bystanders in Peril (treachery)
 */
export const FNE_MODULAR_DISASTERS: AbilityRegistry = defineAbilities({
  "60177.mystic-incursion-action": disasterAction(
    "mental",
    refMatches(EXHAUSTED, query([], { trait: trait("MYSTIC") })),
  ),
  "60178.sinking-ferry-action": disasterAction("energy", refMatches(EXHAUSTED, query([], { trait: trait("AERIAL") }))),
  "60179.towering-inferno-action": disasterAction("physical", hasStatus(EXHAUSTED, "tough")),

  "60180.collapsing-bridge-forced-response": forcedResponse(
    { on: "removeThreat", selfIs: "target" },
    placeThreat(1, self),
  ),

  "60181.when-revealed": whenRevealed(
    ...placeCivilian(you, "placed"),
    ifThen(not(varAtLeast("placed.amount")), [
      chooseCards("found", encounterCards(["deck", "discard"], DISASTER_ENVIRONMENT), { min: 1, max: 1 }),
      shuffleEncounterDeck(),
      revealCard(chosen("found")),
    ]),
  ),
  "60181.boost": boost(...placeCivilian(firstPlayer)),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const FNE_MODULAR_DISASTERS_SKIPPED: Readonly<Record<string, string>> = {};
