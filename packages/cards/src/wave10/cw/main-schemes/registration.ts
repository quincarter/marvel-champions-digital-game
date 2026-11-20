import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  chooseCards,
  chosen,
  constant,
  dealAsEncounterCard,
  defineAbilities,
  moveCards,
  eachPlayer,
  encounterCards,
  encounterSetOf,
  enemyTeamChooses,
  entersPlayExhausted,
  find,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsKeywordX,
  gainsTrait,
  grantedTo,
  identityOf,
  ifThen,
  inCompetitiveMode,
  on,
  oncePerPhasePerEventPlayer,
  perHero,
  placeThreat,
  product,
  query,
  refCount,
  revealCard,
  self,
  setup,
  shuffleEncounterDeck,
  theVillain,
  thatPlayer,
  tuckCards,
  topOfDeck,
  tuckedCount,
  valueAtLeast,
  whenRevealed,
  yourTeam,
  cards,
  dealDamage,
  eventTarget,
  gets,
} from "../../../dsl/index.js";

const UNREGISTERED = trait("UNREGISTERED");

/**
 * 1A Setup, on the stage 1 chosen (56063a, 56096a, 56121a, 56122a read the same): "In competitive mode, the enemy team
 * finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side
 * scheme and reveal it." In competitive mode the find reaches only this stage's own side of the table, so it takes the
 * copy of Choosing Sides in the encounter deck this team faces (each scenario holds its own copy, Q15), and "your team"
 * reveals it: the team's first player, who is the first player while its area sets up (`GameStep teamScenarioSetup`;
 * MC56 pp. 14-16, scenario rules override RRG per Golden Rule, RRG p. 4; Q4 A per owner decision 2026-11-20). Which
 * player of the enemy team "finds" a single named card changes nothing, so nobody is asked. The cooperative branch
 * finds the one side scheme of the villain's own encounter set (the chosen leader's set, 10 cards,
 * docs/phase7-wave10.md section 1.5) in the encounter deck or its discard pile and the first player reveals it; the
 * decks searched are shuffled after.
 */
/** The Standard PvP set's permanent side scheme (56128a, 56206a), by title: either printing (Q15). */
const CHOOSING_SIDES = query("sideScheme", { titled: { names: ["Choosing Sides"] } });

const registrationSetup = () =>
  setup(
    ifThen(
      inCompetitiveMode(),
      [revealCard(find(CHOOSING_SIDES), firstPlayer)],
      [revealCard(find(query("sideScheme", encounterSetOf(theVillain))), firstPlayer)],
    ),
  );

/**
 * "If there is more than 1 player on your team, this stage gains hinder 2[per_hero]." Printed on all four stage 1s and
 * conditional on every one of them: with one player on the team the stage has no hinder. The engine places the threat
 * as the stage turns to its B side (MC56 p. 9, RRG 1.8 "Hinder X" p. 22), before the stage's When Revealed.
 */
const stageGainsHinder = () =>
  constant(
    gainsKeywordX("hinder", perHero(2), { self: true }, { while: valueAtLeast(refCount(identityOf(yourTeam)), 2) }),
  );

/**
 * "The enemy team searches the encounter deck [and discard pile] for 1[per_hero] [type] and deals one to each player on
 * your team as a facedown encounter card." One pick for each player of the team in turn, by the enemy team (the first
 * player answers in a marked prompt; owner's answer to question 6 = A, MC56 p. 6, the grim rule); the pick is dealt to
 * that player, so a card dealt is no longer a candidate for the next. The deck is shuffled once after the search (RRG 1.8
 * "Search", p. 39). Fewer matches than players: each player that finds one is dealt one.
 */
const searchAndDealOnePerPlayer = (zones: readonly ("deck" | "discard")[], kind: "minion" | "sideScheme") => [
  forEachPlayer(
    yourTeam,
    chooseCards("found", encounterCards(zones, query(kind)), { min: 1, max: 1, chooser: enemyTeamChooses }),
    dealAsEncounterCard(chosen("found"), thatPlayer),
  ),
  shuffleEncounterDeck(),
];

/** Hunting Rebel Heroes 56097b: owner's answer to question 12 = A (docs/phase7-wave10.md section 4.1, 2026-10-11). */
const huntingResponse = () =>
  forcedResponse(
    on.cardRevealedGranting(UNREGISTERED, { to: query("hero"), another: true }),
    dealDamage(2, grantedTo(UNREGISTERED, query("hero"))),
  );

/**
 * The Civil War registration main scheme (MC56 pp. 4-5, docs/phase7-wave10.md sections 1.2, 2.6, 7.5): one card of eight
 * stages. A scenario picks one stage 1 and one stage 2 by the `printedCardId` of their B faces; each stage 1 has the
 * same side A (its Setup) and completing any stage 2 loses the game (data: `completionLoses`).
 *
 * **Stage 1 B sides**: all four print "If there is more than 1 player on your team, this stage gains hinder 2[per_hero]",
 * a conditional grant (`gainsKeywordX("hinder", perHero(2), { self: true }, { while: more than one player on the team })`).
 * **Cut Off Support (56063b)**: a Forced Interrupt when a player reveals a treachery, 1 threat here, limited once per
 * phase per player by the player who revealed it (`oncePerPhasePerEventPlayer`). **S.H.I.E.L.D. Recruits (56096b)**:
 * When Revealed, one minion for each player of the team. **Homeland Security (56121b)**: each minion gains guard.
 * **Public Outrage (56122b)**: after step 1 of the villain phase, each player discards the top 3 cards of their deck.
 *
 * **Stage 2 B sides**: **Negative Zone Prison (56064b)** lowers the target threat by 1 for each card tucked under it
 * and tucks a defeated ally facedown (every card it tucks is facedown). **Hunting Rebel Heroes (56097b)**: each hero
 * gains Unregistered; a revealed card that gives heroes the trait deals them 2 damage (question 12 = A: every hero the
 * card's text reaches, a hero that already had the trait included; an identity in alter-ego form takes none).
 * **The Initiative (56123b)**: When Revealed, one side scheme for each player, from the deck and the discard pile.
 * **No Going Back (56124b)**: allies enter play exhausted.
 *
 * Cards (1):
 * - 56063a Superhero Registration Act (main_scheme)
 */
export const MAIN_SCHEMES_REGISTRATION: AbilityRegistry = defineAbilities({
  "56063a.setup": registrationSetup(),
  "56096a.setup": registrationSetup(),
  "56121a.setup": registrationSetup(),
  "56122a.setup": registrationSetup(),

  // Cut Off Support
  "56063b.cut-off-support-constant": stageGainsHinder(),
  "56063b.cut-off-support-forced-interrupt": forcedInterrupt(
    on.encounterCardRevealed(query("treachery")),
    { limit: oncePerPhasePerEventPlayer },
    placeThreat(1, self),
  ),

  // Negative Zone Prison: "[star] Reduce the target threat value of this scheme by 1 for each facedown card under it."
  "56064b.negative-zone-prison-constant": constant(
    gets("targetThreat", product(-1, tuckedCount(self)), { self: true }),
  ),
  "56064b.negative-zone-prison-forced-response": forcedResponse(
    on.defeated(query("ally"), { byAttackFrom: query("enemy") }),
    tuckCards(cards(eventTarget), self, true),
  ),

  // S.H.I.E.L.D. Recruits
  "56096b.shield-recruits-constant": stageGainsHinder(),
  "56096b.when-revealed": whenRevealed(...searchAndDealOnePerPlayer(["deck"], "minion")),

  // Hunting Rebel Heroes
  "56097b.hunting-rebel-heroes-constant": constant(gainsTrait(UNREGISTERED, query("hero"))),
  "56097b.hunting-rebel-heroes-forced-response": huntingResponse(),

  // Homeland Security
  "56121b.homeland-security-constant": stageGainsHinder(),
  "56121b.homeland-security-constant-2": constant(gainsKeyword({ name: "guard" }, query("minion"))),

  // Public Outrage: "[star] Forced Response: After resolving step 1 of the villain phase, each player discards the top 3
  // cards of their deck."
  "56122b.public-outrage-constant": stageGainsHinder(),
  "56122b.public-outrage-forced-response": forcedResponse(
    on.villainStepResolved(),
    forEachPlayer(eachPlayer, moveCards(topOfDeck(3, thatPlayer), "discard")),
  ),

  // The Initiative
  "56123b.when-revealed": whenRevealed(...searchAndDealOnePerPlayer(["deck", "discard"], "sideScheme")),

  // No Going Back
  "56124b.no-going-back-constant": constant(entersPlayExhausted(query("ally"))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const MAIN_SCHEMES_REGISTRATION_SKIPPED: Readonly<Record<string, string>> = {};
