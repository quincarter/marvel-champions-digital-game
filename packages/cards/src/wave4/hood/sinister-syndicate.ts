import { trait } from "@mc/content";
import {
  after,
  bindTargets,
  boost,
  chooseTarget,
  chosen,
  dealDamage,
  defineAbilities,
  discard,
  discardAtRandom,
  each,
  enemyAttack,
  enemyScheme,
  eventSource,
  exists,
  forcedInterrupt,
  forcedResponse,
  ifThen,
  on,
  printedCostOf,
  query,
  self,
  statOf,
  stun,
  superlative,
  surge,
  whenRevealedAlterEgo,
  whenRevealedHero,
  you,
} from "../../dsl/index.js";

/**
 * The Sinister Syndicate modular set (`hood` 24042-24048, docs/phase7-wave4.md §2.3): a side scheme (Crime Pays),
 * five minions (Beetle, Boomerang, Shocker, Speed Demon, White Rabbit) and a treachery (Sinister Onslaught).
 *
 * **Crime Pays (24042, `when-revealed`) is not scripted — a genuine engine gap.** "Search the encounter deck for a
 * Criminal minion and put it into play engaged with you" needs a search that CAN find nothing (unlike
 * `searchAndPutHydeInto`, where the named card is guaranteed to exist) and then read "was a minion put into play
 * this way" for the surge branch — no DSL primitive currently reports whether a search-and-put found a match.
 *
 * **Speed Demon (24046, `speed-demon-forced-interrupt`) is docs/phase7-wave4.md §3.21's own worked example** —
 * `forcedInterrupt({ on: "attack", selfIs: "target" }, enemyAttack(self, { targetCharacter: eventSource }))`.
 *
 * **White Rabbit's own Boost (24047, `boost`) is not scripted — a genuine engine gap.** "Discard 1
 * identity-specific card from your hand" needs a `TargetQuery` filter matching "the current player's own printed
 * identity set," dynamically — `identitySetTitled` only matches a fixed, printed list of names (Team-Up cards), not
 * whichever hero happens to be in the game.
 */

const CRIMINAL = trait("CRIMINAL");
const CRIMINAL_ENEMY = query("enemy", { trait: CRIMINAL });

export const SINISTER_SYNDICATE = defineAbilities({
  // Beetle (24043, minion; CRIMINAL, starIcon are data) — [star] Forced Response: after Beetle attacks and damages
  // you, discard the lowest-cost upgrade you control. [star] Boost: choose and discard an upgrade you control.
  "24043.beetle-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true, damages: true }),
    bindTargets(
      "lowest",
      superlative("lowest", each(query("upgrade", { controller: "you" })), printedCostOf(chosen("candidate"))),
    ),
    chooseTarget("pick", { inSlot: "lowest" }),
    discard(chosen("pick")),
  ),
  "24043.boost": boost(chooseTarget("pick", query("upgrade", { controller: "you" })), discard(chosen("pick"))),

  // Boomerang (24044, minion; CRIMINAL/MASTERS OF EVIL, starIcon are data) — [star] Forced Response: after
  // Boomerang attacks you, deal 1 damage to each ally you control. [star] Boost: deal 2 damage to an ally you
  // control.
  "24044.boomerang-forced-response": forcedResponse(
    after.enemyAttacks("self", { againstYou: true }),
    dealDamage(1, each(query("ally", { controller: "you" }))),
  ),
  "24044.boost": boost(chooseTarget("ally", query("ally", { controller: "you" })), dealDamage(2, chosen("ally"))),

  // Shocker (24045, minion; CRIMINAL/MASTERS OF EVIL, starIcon are data) — Forced Response: after Shocker is
  // attacked, stun the attacking character. [star] Boost: stun the character you control with the highest ATK.
  "24045.shocker-forced-response": forcedResponse({ on: "attack", selfIs: "target" }, stun(eventSource)),
  "24045.boost": boost(
    bindTargets(
      "highest",
      superlative("highest", each(query("character", { controller: "you" })), statOf(chosen("candidate"), "atk")),
    ),
    chooseTarget("pick", { inSlot: "highest" }),
    stun(chosen("pick")),
  ),

  // Speed Demon (24046, minion; CRIMINAL, starIcon are data; docs/phase7-wave4.md §3.21) — Forced Interrupt: when a
  // character attacks Speed Demon, Speed Demon attacks that character. [star] Boost: discard the lowest-cost
  // support you control.
  "24046.speed-demon-forced-interrupt": forcedInterrupt(
    { on: "attack", selfIs: "target" },
    enemyAttack(self, { targetCharacter: eventSource }),
  ),
  "24046.boost": boost(
    bindTargets(
      "lowest",
      superlative("lowest", each(query("support", { controller: "you" })), printedCostOf(chosen("candidate"))),
    ),
    chooseTarget("pick", { inSlot: "lowest" }),
    discard(chosen("pick")),
  ),

  // White Rabbit (24047, minion; CRIMINAL, starIcon are data) — [star] Forced Interrupt: when White Rabbit attacks
  // you, discard 1 card at random from your hand.
  "24047.white-rabbit-forced-interrupt": forcedInterrupt(
    on.enemyAttacks("self", { againstYou: true }),
    discardAtRandom(1),
  ),

  // Sinister Onslaught (24048, treachery) — When Revealed (Alter-Ego): each Criminal enemy in play schemes; if
  // none, this card gains surge. When Revealed (Hero): each Criminal enemy in play attacks you; if none, surge.
  "24048.when-revealed-alter-ego": whenRevealedAlterEgo(
    ifThen(exists(CRIMINAL_ENEMY), enemyScheme(each(CRIMINAL_ENEMY)), surge()),
  ),
  "24048.when-revealed-hero": whenRevealedHero(
    ifThen(exists(CRIMINAL_ENEMY), enemyAttack(each(CRIMINAL_ENEMY), { against: you }), surge()),
  ),
});
