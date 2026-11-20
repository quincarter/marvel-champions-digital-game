import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  attachCard,
  chooseTarget,
  choosePlayer,
  chosen,
  chosenPlayer,
  confuse,
  constant,
  defineAbilities,
  discard,
  each,
  engage,
  enemyLeader,
  enemyTeam,
  forcedInterrupt,
  forcedResponse,
  gainsTrait,
  giveBoostCard,
  giveTough,
  heal,
  heroAction,
  host,
  ifThen,
  inCompetitiveMode,
  on,
  paidWith,
  query,
  removeThreat,
  response,
  self,
  spend,
  stun,
  theMainScheme,
  eachPlayer,
  yourLeader,
  you,
  enemyAttacksEnemy,
  instead,
  attackingEnemy,
  yourLeadersMainScheme,
  placeThreat,
  allOf,
  applyRuleUntil,
  bindTargets,
  enemyScheme,
  refCount,
  valueAtLeast,
} from "../../../dsl/index.js";

const TECH = trait("TECH");
const ENERGY = "energy";
const SKILL = "skill";

/** "Your Captain Marvel leader's Energy Channel attachment": the Channel attached to a leader that is yours. */
const YOUR_ENERGY_CHANNEL = query("attachment", { name: "Energy Channel", host: yourLeader, anyGameArea: true });
/** "Her Finesse attachment" / "your Spider-Woman leader's Finesse attachment". */
const YOUR_FINESSE = query("attachment", { name: "Finesse", host: yourLeader, anyGameArea: true });
/** The Finesse on the leader this upgrade is attached to ("her Finesse attachment"). */
const HOST_FINESSE = query("attachment", { name: "Finesse", host: host });

/**
 * The reading of the rulebook's cooperative rules (MC56 p. 6) shared by all sixteen cards: "the enemy leader" is the
 * villain, "your leader" cannot be resolved ("Do as much as you can"), and these cards are "used only when playing in
 * competitive mode" (MC56 p. 3). So a clause aimed at "your leader" is written with `yourLeader` and does nothing when
 * the game has none.
 */

/**
 * "Your <name> leader attacks the enemy leader." (the four attack events): the leader-versus-leader attack, MC56 p. 16
 * (MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); Q6, settled 2026-11-20): your leader is
 * given a boost card from the deck of the area it sits in, the first player of the team in that area turns it, no
 * defender, no guard, its total ATK dealt. Nothing cooperatively (no "your leader", MC56 p. 6).
 */
const LEADER_ATTACKS_ENEMY_LEADER = enemyAttacksEnemy(yourLeader, enemyLeader, { boost: true });

/** Whether "your leader" is in play: none in a cooperative game (MC56 p. 6), nor once it has left play. */
const HAS_YOUR_LEADER = valueAtLeast(refCount(yourLeader), 1);

/**
 * Competitive cards (docs/competitive-mode-plan.md section 4 task 11): the sixteen leader-specific basic player cards of
 * the Civil War box, four per leader (MC56 p. 3). The data marks them competitive-only and a cooperative deck holding one
 * is refused (`competitive_card`), so they are played only in a competitive game. Every sentence is scripted (plan
 * milestone M3: the leader-versus-leader attack, a leader scheming across the table, a leader's main scheme,
 * redirecting an attack onto a leader, a minion moving to the other team's area).
 *
 * Cooperative reading, followed by every card (owner's answer to question 11 = A for the like case of Darkforce, 2026-10-11):
 * a sentence aimed at "your leader" does nothing, and the rest of the card resolves. So the leader attack events still
 * run their rider against the enemy leader (the villain): paying with the named resource confuses, stuns or strips it.
 * A Forced ability whose instruction cannot be resolved still triggers and its "Discard this card" still happens.
 *
 * Iron Man
 * - 56129 The Futurist: your Iron Man leader schemes in its own area, with no boost card.
 * - 56130 Target Lock: marker for the attack; "if you spent a [mental] resource" the discard of a Hero Response or Hero
 *   Interrupt attachment on the enemy leader (`abilityTiming`).
 * - 56131 High-Tech Suit: attaches to your leader (card data), counts as a Tech attachment (the Iron Man leader counts Tech
 *   attachments), Hero Action: spend [energy][mental] to discard it, any player may trigger it.
 * - 56132 Suit Up: after you spend it, give your Iron Man leader a tough status card.
 *
 * Captain Marvel
 * - 56133 Provoked Response: the redirect onto your leader, capped at 3 damage for that attack; discards itself.
 * - 56134 You Started This: marker for the attack; with [energy] paid, confuse the enemy leader.
 * - 56135 Alpha Flight Recruit: after energy counters are placed on your leader's Energy Channel, heal 1 from the ally.
 * - 56136 Raw Power: after you spend it, place 2 energy counters on your leader's Energy Channel.
 *
 * Captain America
 * - 56207 No, You Move!: attaches Cap's Shield to your leader (a no-op without one); marker for "resolve this attack
 *   against him instead"; discards itself.
 * - 56208 Fighting Dirty: marker for the attack; with [physical] paid, stun the enemy leader.
 * - 56209 Recruited by Cap: choose a minion engaged with you and a player on the enemy team; the minion engages that player.
 * - 56210 The People's Hero: after you spend it, give your Captain America leader a facedown boost card.
 *
 * Spider-Woman
 * - 56211 Double Agent: remove 2 threat from the main scheme; marker for "Place 2 threat on your leader's main scheme."
 * - 56212 Spider-Blast: marker for the attack; with [mental] paid, confuse the enemy leader.
 * - 56213 Hard to Hit: attaches to your leader (card data), gives her a tough status card as it enters play; Forced
 *   Response: after she attacks, 2 skill counters on her Finesse, then discard.
 * - 56214 Secret Contact: after you spend it, place 2 skill counters on your leader's Finesse.
 *
 * Wherever a card reads "Your <name> leader", the leader is the one on the player's own team; it is the only leader the
 * card can be in a deck with (the data's `specificTo` leader set), so the name is not checked again.
 */
export const COMPETITIVE_LEADER_CARDS: AbilityRegistry = defineAbilities({
  // ---- Iron Man ----
  "56129.the-futurist-action": action(
    // A scheme across the table, in the area your leader is in, placing threat on its main scheme (MC56 pp. 16-17, 20
    // (scenario rules override RRG per Golden Rule, RRG p. 4)). Cooperatively there is no "your leader" (p. 6).
    enemyScheme(yourLeader, { noBoost: true }),
  ),

  "56130.target-lock-action": action(
    { readsPaidTypes: { types: ["mental"] } },
    LEADER_ATTACKS_ENEMY_LEADER,
    ifThen(paidWith("mental"), [
      chooseTarget(
        "attachment",
        query("attachment", { host: enemyLeader, abilityTiming: ["heroResponse", "heroInterrupt"] }),
      ),
      discard(chosen("attachment")),
    ]),
  ),

  "56131.high-tech-suit-constant": constant(gainsTrait(TECH, { self: true })),
  "56131.high-tech-suit-action": heroAction(
    { cost: spend({ energy: 1, mental: 1 }), triggerableBy: eachPlayer },
    discard(self),
  ),

  "56132.suit-up-response": response(on.youSpendThis(), giveTough(yourLeader)),

  // ---- Captain Marvel ----
  "56133.provoked-response-forced-interrupt": forcedInterrupt(
    on.villainAttacks({ againstYou: true }),
    { would: true },
    // "would" interrupt resolves before the attack initiates (RRG v1.8 Interrupt p. 24), so no boost is dealt yet;
    // redirected attack resolves per MC56 p. 16 (one boost from the leader's deck, turned by the defending leader's
    // team's first player). A replacement, so nothing more answers the attack on you. "She cannot take more than 3
    // damage from this attack": a cap scoped to the attack the redirect makes (`attack: "initiated"`). Cooperatively
    // there is no leader and the attack goes on against you (MC56 p. 6).
    ifThen(allOf(inCompetitiveMode(), HAS_YOUR_LEADER), [
      instead(
        bindTargets("provoked", yourLeader),
        applyRuleUntil(
          { kind: "maxDamageTakenPerAttack", target: { inSlot: "provoked", anyGameArea: true }, amount: 3 },
          "endOfAttack",
          undefined,
          { attack: "initiated" },
        ),
        enemyAttacksEnemy(attackingEnemy, yourLeader, { boost: true }),
      ),
    ]),
    discard(self),
  ),

  "56134.you-started-this-action": action(
    { readsPaidTypes: { types: ["energy"] } },
    LEADER_ATTACKS_ENEMY_LEADER,
    ifThen(paidWith("energy"), confuse(enemyLeader)),
  ),

  "56135.alpha-flight-recruit-response": response(on.countersPlaced(ENERGY, YOUR_ENERGY_CHANNEL), heal(1, host)),

  "56136.raw-power-response": response(on.youSpendThis(), addCounters(ENERGY, 2, each(YOUR_ENERGY_CHANNEL))),

  // ---- Captain America ----
  "56207.no-you-move-forced-interrupt": forcedInterrupt(
    on.villainAttacks({ againstYou: true }),
    { would: true },
    // Cap's Shield is on the other side of the table, which the card names (MC56 p. 16).
    attachCard(each(query("attachment", { name: "Cap's Shield", anyGameArea: true })), yourLeader),
    // "Resolve this attack against him instead": the enemy leader's attack becomes a leader-versus-leader attack on
    // your leader (MC56 pp. 16-17, 20 (scenario rules override RRG per Golden Rule, RRG p. 4); Q6). "would" interrupt
    // resolves before the attack initiates (RRG v1.8 Interrupt p. 24), so no boost is dealt yet; redirected attack
    // resolves per MC56 p. 16 (one boost from the leader's deck, turned by the defending leader's team's first
    // player). Cooperatively there is no leader and the attack goes on against you.
    ifThen(
      allOf(inCompetitiveMode(), HAS_YOUR_LEADER),
      instead(enemyAttacksEnemy(attackingEnemy, yourLeader, { boost: true })),
    ),
    discard(self),
  ),

  "56208.fighting-dirty-action": action(
    { readsPaidTypes: { types: ["physical"] } },
    LEADER_ATTACKS_ENEMY_LEADER,
    ifThen(paidWith("physical"), stun(enemyLeader)),
  ),

  "56209.recruited-by-cap-action": action(
    chooseTarget("minion", query("minion", { engagedWith: "you" })),
    choosePlayer("recruited", you, { among: enemyTeam }),
    engage(chosen("minion"), chosenPlayer("recruited")),
  ),

  "56210.the-peoples-hero-response": response(on.youSpendThis(), giveBoostCard(yourLeader)),

  // ---- Spider-Woman ----
  "56211.double-agent-action": action(removeThreat(2, theMainScheme), placeThreat(2, yourLeadersMainScheme)),

  "56212.spider-blast-action": action(
    { readsPaidTypes: { types: ["mental"] } },
    LEADER_ATTACKS_ENEMY_LEADER,
    ifThen(paidWith("mental"), confuse(enemyLeader)),
  ),

  "56213.hard-to-hit-constant": forcedResponse(after.entersPlay("self"), giveTough(host)),
  "56213.hard-to-hit-forced-response": forcedResponse(
    on.enemyAttacks("host"),
    addCounters(SKILL, 2, each(HOST_FINESSE)),
    discard(self),
  ),

  "56214.secret-contact-response": response(on.youSpendThis(), addCounters(SKILL, 2, each(YOUR_FINESSE))),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. None. */
export const COMPETITIVE_LEADER_CARDS_SKIPPED: Readonly<Record<string, string>> = {};
