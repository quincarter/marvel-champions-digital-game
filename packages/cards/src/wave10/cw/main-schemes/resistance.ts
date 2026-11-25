import type { AbilityRegistry } from "@mc/engine";
import {
  attackInProgress,
  chooseCards,
  chosen,
  constant,
  dealAsEncounterCard,
  defineAbilities,
  discardEncounterCards,
  eachPlayer,
  encounterCards,
  encounterSetOf,
  enemyTeamChooses,
  find,
  firstPlayer,
  forEachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsKeyword,
  gainsKeywordX,
  gets,
  identityOf,
  ifThen,
  inCompetitiveMode,
  on,
  oncePerPhasePerEventPlayer,
  perHero,
  placeThreat,
  putIntoPlay,
  query,
  refCount,
  refMatches,
  revealCard,
  self,
  setup,
  shuffleEncounterDeck,
  thatPlayer,
  theAffectedCard,
  theVillain,
  undefendedAttack,
  valueAtLeast,
  whenRevealed,
  yourTeam,
} from "../../../dsl/index.js";

/**
 * The enemy leader as a constant's target. A cooperative game has no other (MC56 p. 6; ruling of July 9, 2026 (3)
 * answer 2: the enemy leader is the villain), and competitive mode is not built, so a card query reads the villain.
 */
const ENEMY_LEADER = query("villain");

/**
 * 1A Setup, on the stage 1 chosen (56141a, 56172a, 56199a, 56200a read the same): "In competitive mode, the enemy team
 * finds the Choosing Sides side scheme and your team reveals it. In cooperative mode, find the chosen leader's side
 * scheme and reveal it." In competitive mode the find reaches only this stage's own side of the table, so it takes the
 * copy of Choosing Sides in the encounter deck this team faces, and the team's first player reveals it (as the
 * registration module's Setup; MC56 pp. 14-16, scenario rules override RRG per Golden Rule, RRG p. 4; Q4 A per owner
 * decision 2026-11-20). The cooperative branch finds the one side scheme of the villain's own encounter set (the chosen
 * leader's set) in the encounter deck or its discard pile and the first player reveals it. Local to this module: the
 * registration module writes the same Setup.
 */
/** The Standard PvP set's permanent side scheme (56128a, 56206a), by title: either printing (Q15). */
const CHOOSING_SIDES = query("sideScheme", { titled: { names: ["Choosing Sides"] } });

const resistanceSetup = () =>
  setup(
    ifThen(
      inCompetitiveMode(),
      [revealCard(find(CHOOSING_SIDES), firstPlayer)],
      [revealCard(find(query("sideScheme", encounterSetOf(theVillain))), firstPlayer)],
    ),
  );

/**
 * "If there is more than 1 player on your team, this stage gains hinder 2[per_hero]." Printed on all four stage 1s and
 * conditional on every one of them (as the scans read): with one player on the team the stage has no hinder. The
 * engine places the threat as the stage turns to its B side (MC56 p. 9, RRG 1.8 "Hinder X" p. 22), before the
 * stage's When Revealed. Local to this module: the registration module writes the same sentence.
 */
const stageGainsHinder = () =>
  constant(
    gainsKeywordX("hinder", perHero(2), { self: true }, { while: valueAtLeast(refCount(identityOf(yourTeam)), 2) }),
  );

/**
 * "The enemy team searches the encounter deck [and discard pile] for 1[per_hero] [type] and deals one to each player
 * on your team as a facedown encounter card." One pick for each player of the team in turn, by the enemy team (the
 * first player answers in a marked prompt; owner's answer to question 6 = A, MC56 p. 6); the pick is dealt to that
 * player, so a card dealt is no longer a candidate for the next. The deck is shuffled once after the search (RRG 1.8
 * "Search", p. 39). Local to this module: the registration module writes the same search.
 */
const searchAndDealOnePerPlayer = (zones: readonly ("deck" | "discard")[], kind: "minion" | "sideScheme") => [
  forEachPlayer(
    yourTeam,
    chooseCards("found", encounterCards(zones, query(kind)), { min: 1, max: 1, chooser: enemyTeamChooses }),
    dealAsEncounterCard(chosen("found"), thatPlayer),
  ),
  shuffleEncounterDeck(),
];

/**
 * The Civil War resistance main scheme (MC56 pp. 4-5, docs/phase7-wave10.md sections 1.2, 2.6, 7.6): one card of eight
 * stages. A scenario picks one stage 1 and one stage 2 by the `printedCardId` of their B faces; each stage 1 has the
 * same side A (its Setup) and completing any stage 2 loses the game (data: `completionLoses`).
 *
 * **Stage 1 B sides**: all four print "If there is more than 1 player on your team, this stage gains hinder
 * 2[per_hero]" (a conditional grant, `gainsKeywordX` with a `while`). **Gathering Support (56141b)**: When Revealed,
 * one minion for each player of the team. **Open Rebellion (56172b)**: a Forced Interrupt when a player reveals a
 * treachery, 1 threat here, limited once per phase per player by the player who revealed it
 * (`oncePerPhasePerEventPlayer`). **Rallying Call (56199b)**: each minion gains guard. **Going Underground
 * (56200b)**: the enemy leader gains steady.
 *
 * **Stage 2 B sides**: **Secret Avengers (56142b)**: the enemy leader gets +1 ATK while attacking, +2 instead if the
 * attack is undefended (two modifiers, +1 and a further +1 when undefended). **Neighborhood Protectors (56173b)**: When
 * Revealed, one side scheme for each player, from the deck and the discard pile. **Guerilla Warfare (56201b)**: after
 * a status card is placed on the enemy leader, 1 threat here. **Superhero Jailbreak (56202b)**: after step 1 of the
 * villain phase each player discards the top card of the encounter deck, and a minion discarded is put into play
 * engaged with that player (a player's own discard resolves before the next player's).
 *
 * Cards (1):
 * - 56141a Superhero Resistance (main_scheme)
 */
export const MAIN_SCHEMES_RESISTANCE: AbilityRegistry = defineAbilities({
  "56141a.setup": resistanceSetup(),
  "56172a.setup": resistanceSetup(),
  "56199a.setup": resistanceSetup(),
  "56200a.setup": resistanceSetup(),

  // Gathering Support
  "56141b.gathering-support-constant": stageGainsHinder(),
  "56141b.when-revealed": whenRevealed(...searchAndDealOnePerPlayer(["deck"], "minion")),

  // Open Rebellion
  "56172b.open-rebellion-constant": stageGainsHinder(),
  "56172b.open-rebellion-forced-interrupt": forcedInterrupt(
    on.encounterCardRevealed(query("treachery")),
    { limit: oncePerPhasePerEventPlayer },
    placeThreat(1, self),
  ),

  // Rallying Call
  "56199b.rallying-call-constant": stageGainsHinder(),
  "56199b.rallying-call-constant-2": constant(gainsKeyword({ name: "guard" }, query("minion"))),

  // Going Underground
  "56200b.going-underground-constant": stageGainsHinder(),
  "56200b.going-underground-constant-2": constant(gainsKeyword({ name: "steady" }, ENEMY_LEADER)),

  // Secret Avengers: +1 ATK while attacking, +2 instead when undefended.
  "56142b.secret-avengers-constant": constant(
    gets("atk", 1, ENEMY_LEADER, { while: attackInProgress({ attacker: theAffectedCard }) }),
    gets("atk", 1, ENEMY_LEADER, { while: undefendedAttack }),
  ),

  // Neighborhood Protectors
  "56173b.when-revealed": whenRevealed(...searchAndDealOnePerPlayer(["deck", "discard"], "sideScheme")),

  // Guerilla Warfare
  "56201b.guerilla-warfare-forced-response": forcedResponse(on.statusPlaced(ENEMY_LEADER), placeThreat(1, self)),

  // Superhero Jailbreak
  "56202b.superhero-jailbreak-forced-response": forcedResponse(
    on.villainStepResolved(),
    forEachPlayer(
      eachPlayer,
      discardEncounterCards(1, { bind: "jailbreak" }),
      ifThen(
        refMatches(chosen("jailbreak"), query("minion"), { anywhere: true }),
        putIntoPlay(chosen("jailbreak"), thatPlayer),
      ),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const MAIN_SCHEMES_RESISTANCE_SKIPPED: Readonly<Record<string, string>> = {};
