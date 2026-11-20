import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  adjustBoostCount,
  boost,
  chooseCards,
  chosen,
  cards,
  constant,
  dealAsEncounterCard,
  dealtEncounterCount,
  defineAbilities,
  enemyAttack,
  enemyLeader,
  enemyScheme,
  enemyTeamChooses,
  encounterCards,
  firstPlayer,
  flipCard,
  forEachPlayer,
  forcedResponse,
  identityOf,
  ifThen,
  inCompetitiveMode,
  maxDamageTaken,
  moveCards,
  on,
  query,
  product,
  refCount,
  self,
  shuffleEncounterDeck,
  sum,
  thatPlayer,
  valueAtLeast,
  whenRevealed,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
  yourTeam,
  yourLeadersSetAsideCards,
  takeIntoHand,
  enemyAttacksEnemy,
  yourLeader,
} from "../../../dsl/index.js";

/** "Each player on your team": the players of the team whose area holds the card (MC56 p. 20). */
const PLAYERS_ON_YOUR_TEAM = refCount(identityOf(yourTeam));

/**
 * "The enemy team searches the top 5 cards of the encounter deck for a card": the first player's choice among them, in
 * a prompt marked as the enemy team's (owner's answer to question 6 = A, 2026-10-11; MC56 p. 6, the grim rule). The
 * ability that searches shuffles the whole encounter deck once it is done (RRG 1.8 "Search", p. 39: "If any portion of
 * a deck is searched, upon completion of that ... card ability, shuffle that entire deck"), as Secret Avengers (56159).
 */
const SEARCH_TOP_FIVE = chooseCards("found", encounterCards(["deck"], undefined, 5), {
  min: 1,
  max: 1,
  chooser: enemyTeamChooses,
});

/**
 * Righteous Cause (56125 / 56203): "The enemy leader schemes. If there is more than 1 player on your team, give the
 * enemy leader an additional boost card for this activation." Cooperatively the enemy leader is the villain and the
 * team is every player (MC56 p. 6).
 */
const RIGHTEOUS_CAUSE = whenRevealed(
  ifThen(
    valueAtLeast(PLAYERS_ON_YOUR_TEAM, 2),
    enemyScheme(enemyLeader, { against: you, extraBoostCards: 1 }),
    enemyScheme(enemyLeader, { against: you }),
  ),
);

/**
 * Whatever It Takes, Alter-Ego face: "The enemy leader attacks your leader." Needs a leader-versus-leader attack (MC56
 * p. 14, plan section 1.5) which the engine cannot run; cooperatively "your leader" cannot be resolved and nothing
 * happens (MC56 p. 6).
 */
const WHATEVER_IT_TAKES_ALTER_EGO = whenRevealedAlterEgo(
  // MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); Q5, Q6 (settled 2026-11-20): the
  // leader-versus-leader attack.
  enemyAttacksEnemy(enemyLeader, yourLeader, { boost: true }),
);

/** Whatever It Takes, Hero face: "The enemy leader attacks you." */
const WHATEVER_IT_TAKES_HERO = whenRevealedHero(enemyAttack(enemyLeader, { against: you }));

/** Targeted Strike: the enemy team picks one of the top 5 and deals it to the player who revealed this; then the shuffle. */
const TARGETED_STRIKE_WHEN_REVEALED = whenRevealed(
  SEARCH_TOP_FIVE,
  dealAsEncounterCard(chosen("found"), you),
  shuffleEncounterDeck(),
);

/** Targeted Strike Boost: "This card gains [boost] for each player on your team." (corrected text, scan check.) */
const TARGETED_STRIKE_BOOST = boost(adjustBoostCount(PLAYERS_ON_YOUR_TEAM));

/**
 * Choosing Sides, constant: "The enemy leader cannot take more than 2 damage from each attack." The rule's target is a
 * query, and the engine has no query for "the enemy leader of this card's team", so it names the villain: exact where
 * there is one leader (a cooperative game, the only state the engine runs), but in a two-team game it would also cap
 * the other team's leader. That one narrowing waits on a leader query; it is not a marker because the rule is a
 * constant, not an effect.
 */
const CHOOSING_SIDES_CONSTANT = constant(maxDamageTaken(query("villain"), 2));

/**
 * Choosing Sides, Forced Response: "After the last threat is removed from here, the enemy team searches the top 5 cards
 * of the encounter deck for 1[per_hero] encounter cards and deals one to each player as a facedown encounter card.
 * Flip this card." One pick for each player on the team in turn, by the enemy team, from the five that were on top when
 * the search began. A card dealt leaves the deck, so the four that remain are the first four of the deck, and so on:
 * the search of the next player reads the top (5 minus the facedown cards already dealt to the team). That count
 * assumes no other facedown card was waiting on the team when the search began (the engine has no per-search
 * snapshot nor "the nth player of a team"; a search that begins in the hero phase, when the piles are empty, is exact).
 * The deck is shuffled once, when every pick is dealt (RRG 1.8 "Search", p. 39: upon completion of the card ability).
 * The flip goes to the first player (Now It's Personal prints "Give to the first player", MC56 p. 16).
 */
const CHOOSING_SIDES_FORCED_RESPONSE = forcedResponse(
  on.lastThreatRemoved("self"),
  forEachPlayer(
    yourTeam,
    chooseCards("found", encounterCards(["deck"], undefined, sum(5, product(-1, dealtEncounterCount(yourTeam)))), {
      min: 1,
      max: 1,
      chooser: enemyTeamChooses,
    }),
    dealAsEncounterCard(chosen("found"), thatPlayer),
  ),
  shuffleEncounterDeck(),
  flipCard(self, { controller: firstPlayer }),
);

/**
 * Now It's Personal, constant: "Give to the first player." is carried out by the flip of Choosing Sides
 * (`controller: firstPlayer`), so nothing is left to script here.
 */
const NOW_ITS_PERSONAL_CONSTANT = constant();

/**
 * Now It's Personal, Action: "Remove this card from the game -> each player on your team chooses 2 of your leader's
 * set-aside player cards and adds them to their hand." The removal is the first effect (no self-removal cost exists).
 * MC56 p. 16 (defeating Choosing Sides earns two of your leader's basic player cards, then part of that player's deck);
 * Q12 A per owner decision 2026-11-20: they go to hand now and are that player's own cards from then on (taken into
 * hand, so owned: they discard and reshuffle with that player's deck); in 2v2 the players choose in turn, in player
 * order, from the four set aside, so each takes two; in 1v1 the other two stay set aside. Cooperatively "your leader"
 * cannot be resolved, so only the removal happens (MC56 p. 6).
 */
const NOW_ITS_PERSONAL_ACTION = action(
  moveCards(cards(self), "removedFromGame"),
  ifThen(inCompetitiveMode(), [
    forEachPlayer(
      yourTeam,
      chooseCards("earned", yourLeadersSetAsideCards(), { min: 2, max: 2, chooser: thatPlayer }),
      takeIntoHand(cards(chosen("earned")), thatPlayer),
    ),
  ]),
);

/**
 * Competitive encounter set `standard_pvp` (docs/phase7-wave10.md section 8.4, docs/phase7-wave10-box-heroes.md B8.4;
 * docs/competitive-mode-plan.md section 4 task 10). It replaces the Standard set only in competitive play (MC56 pp. 4,
 * 14), so the data marks it competitive-only and no cooperative scenario can seat it. It is scripted in full anyway for
 * when the mode is built: each card once, registered under the registration code (56125 to 56128) and the resistance
 * code (56203 to 56206), the two printings being the same cards (plan question 15).
 *
 * Written with `enemyLeader`, `yourTeam` and `enemyTeamChooses`; the competitive sentences run under
 * `inCompetitiveMode()`, Now It's Personal's reward included (`yourLeadersSetAsideCards`, plan M6). Choosing Sides'
 * damage cap names the villain for want of a leader query.
 *
 * Cards (10):
 * - 56125 Righteous Cause (treachery)
 * - 56126 Whatever It Takes (treachery)
 * - 56127 Targeted Strike (treachery)
 * - 56128a Choosing Sides (side_scheme)
 * - 56128b Now It's Personal (obligation)
 * - 56203 Righteous Cause (treachery)
 * - 56204 Whatever It Takes (treachery)
 * - 56205 Targeted Strike (treachery)
 * - 56206a Choosing Sides (side_scheme)
 * - 56206b Now It's Personal (obligation)
 */
export const COMPETITIVE_STANDARD_PVP: AbilityRegistry = defineAbilities({
  "56125.when-revealed": RIGHTEOUS_CAUSE,
  "56126.when-revealed-alter-ego": WHATEVER_IT_TAKES_ALTER_EGO,
  "56126.when-revealed-hero": WHATEVER_IT_TAKES_HERO,
  "56127.when-revealed": TARGETED_STRIKE_WHEN_REVEALED,
  "56127.boost": TARGETED_STRIKE_BOOST,
  "56128a.choosing-sides-constant": CHOOSING_SIDES_CONSTANT,
  "56128a.choosing-sides-forced-response": CHOOSING_SIDES_FORCED_RESPONSE,
  "56128b.now-its-personal-constant": NOW_ITS_PERSONAL_CONSTANT,
  "56128b.now-its-personal-action": NOW_ITS_PERSONAL_ACTION,

  "56203.when-revealed": RIGHTEOUS_CAUSE,
  "56204.when-revealed-alter-ego": WHATEVER_IT_TAKES_ALTER_EGO,
  "56204.when-revealed-hero": WHATEVER_IT_TAKES_HERO,
  "56205.when-revealed": TARGETED_STRIKE_WHEN_REVEALED,
  "56205.boost": TARGETED_STRIKE_BOOST,
  "56206a.choosing-sides-constant": CHOOSING_SIDES_CONSTANT,
  "56206a.choosing-sides-forced-response": CHOOSING_SIDES_FORCED_RESPONSE,
  "56206b.now-its-personal-constant": NOW_ITS_PERSONAL_CONSTANT,
  "56206b.now-its-personal-action": NOW_ITS_PERSONAL_ACTION,
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const COMPETITIVE_STANDARD_PVP_SKIPPED: Readonly<Record<string, string>> = {};
