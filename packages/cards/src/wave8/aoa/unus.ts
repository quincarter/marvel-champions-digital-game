import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  attachCard,
  boost,
  chooseOne,
  chooseTarget,
  chosen,
  constant,
  dealDamage,
  dealEncounterCard,
  defineAbilities,
  discard,
  each,
  enemyActivates,
  forEachPlayer,
  eachPlayer,
  forcedInterrupt,
  forcedResponse,
  gainsIcon,
  gainsKeyword,
  gets,
  giveTough,
  heal,
  ifElse,
  ifThen,
  inMode,
  isAttached,
  modifyStat,
  named,
  not,
  on,
  option,
  placeThreat,
  query,
  response,
  setup,
  spend,
  surge,
  thatPlayer,
  threatOn,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  activatingEnemy,
  self,
  you,
} from "../../dsl/index.js";

const GENE_POOL = named("Gene Pool");
const UNUS_VILLAIN = named("Unus");
const THIS_VILLAIN = query("villain", { self: true });
const INFINITE_MINION = query("minion", { trait: trait("INFINITE") });
const HOST_MINION = query("minion", { hostOfSelf: true });
const HOST_VILLAIN = query("villain", { hostOfSelf: true });
const atLeast = (n: number) => valueAtLeast(threatOn(GENE_POOL), n);

/**
 * Scenario set `unus` (Age of Apocalypse, docs/phase7-wave8.md §2.2, §3.2 to §3.5, §3.12, §3.14), the Unus villain
 * (stages I to III share one text) and Hunting Gene Traitors. Every card is existing vocabulary.
 *
 * Unus reads Gene Pool's threat live, so each cumulative tier (retaliate 1 at 3, stalwart at 6, an amplify icon
 *   at 9) turns off when threat leaves Gene Pool.
 * Hunting Gene Traitors 1A setup: Gene Pool is already in play from its own setup keyword (§2.2 step 5), so
 *   "reveal" changes nothing; only the expert-mode facedown deal is scripted.
 * Infinite Prelate (§4.1 Q8 = A): the additional boost card is part of the activation, so it is the activation's
 *   own `extraBoostCards`; the tough card and the heal follow the activation, each tier read live when it resolves.
 *
 * Cards (8):
 * - 45059 Unus (villain)
 * - 45062a Hunting Gene Traitors (main_scheme)
 * - 45063 Prelate Sidearm (attachment)
 * - 45064 Prelate Armor (attachment)
 * - 45065 Infinite Hunter (minion)
 * - 45066 Genetic Experiments (attachment)
 * - 45067 Infinite Prelate (treachery)
 * - 45068 Endless Ranks (side_scheme)
 */

/** One stage of Unus: the three cumulative tiers, the same text on 45059, 45060 and 45061. */
const unusStage = (id: string) => ({
  // 3: Unus gains retaliate 1.
  [`${id}.unus-constant`]: constant(gainsKeyword({ name: "retaliate", value: 1 }, THIS_VILLAIN, { while: atLeast(3) })),
  // 6: Unus also gains stalwart.
  [`${id}.unus-constant-2`]: constant(gainsKeyword({ name: "stalwart" }, THIS_VILLAIN, { while: atLeast(6) })),
  // 9: Unus also gains an amplify icon.
  [`${id}.unus-constant-3`]: constant(gainsIcon("amplify", THIS_VILLAIN, { while: atLeast(9) })),
});

/** "After Unus attacks and defeats an ally." */
const unusDefeatsAlly: EventPattern = {
  ...on.enemyAttacks("host"),
  targetIs: query("ally"),
  requireResults: { defeated: 1 },
};

export const UNUS: AbilityRegistry = defineAbilities({
  ...unusStage("45059"),
  ...unusStage("45060"),
  ...unusStage("45061"),

  // Hunting Gene Traitors 1A — Setup: Reveal Gene Pool (already in play, see header). In expert mode, deal each player
  // a facedown encounter card.
  "45062a.setup": setup(ifThen(inMode("expert"), forEachPlayer(eachPlayer, dealEncounterCard(thatPlayer)))),
  // 1B — [star] Forced Response: After resolving step one of the villain phase, place 1 threat on Gene Pool. ("If this
  // scheme is completed, the players lose the game" is data.)
  "45062b.hunting-gene-traitors-forced-response": forcedResponse(on.villainStepResolved(), placeThreat(1, GENE_POOL)),

  // Prelate Sidearm — Attach to Unus (data, +1 ATK). [star] Forced Response: After Unus attacks and defeats an ally,
  // place 1 threat on Gene Pool.
  "45063.prelate-sidearm-forced-response": forcedResponse(unusDefeatsAlly, placeThreat(1, GENE_POOL)),
  // Hero Response: After you make a basic attack against Unus, spend [energy][physical] resources -> discard this card.
  // A plain `response` with the hero as attacker: an attachment on an enemy has no controller (Heavy Armament, 40090).
  "45063.prelate-sidearm-response": response(
    on.attacks(query("hero"), { target: { hostOfSelf: true }, basic: true }),
    { cost: spend({ energy: 1, physical: 1 }) },
    discard(self),
  ),

  // Prelate Armor — Attach to Unus (data, +1 SCH). [star] Forced Response: After Unus schemes, give him a tough
  // status card.
  "45064.prelate-armor-forced-response": forcedResponse(on.enemySchemes("host"), giveTough(each(HOST_VILLAIN))),
  // Hero Response: After you make a basic attack against Unus, spend [mental][physical] resources -> discard this card.
  "45064.prelate-armor-response": response(
    on.attacks(query("hero"), { target: { hostOfSelf: true }, basic: true }),
    { cost: spend({ mental: 1, physical: 1 }) },
    discard(self),
  ),

  // Infinite Hunter — When Revealed: Deal 3 damage to an ally you control.
  "45065.when-revealed": whenRevealed(
    chooseTarget("ally", query("ally", { controller: "you" })),
    dealDamage(3, chosen("ally")),
  ),
  // [star] Boost: Choose to either place 2 threat on Gene Pool, or the activating enemy gets +2 SCH and +2 ATK for this
  // activation. The player the activation is against chooses.
  "45065.boost": boost(
    chooseOne(
      option("Place 2 threat on Gene Pool", placeThreat(2, GENE_POOL)),
      option(
        "Activating enemy gets +2 SCH and +2 ATK",
        modifyStat("sch", 2, activatingEnemy, "endOfAttack"),
        modifyStat("atk", 2, activatingEnemy, "endOfAttack"),
      ),
    ),
  ),

  // Genetic Experiments — Attach to an Infinite minion (data). Otherwise, this card gains surge.
  "45066.genetic-experiments-constant": whenRevealed(ifThen(not(isAttached(self)), surge())),
  // Attached minion gets +2 hit points.
  "45066.genetic-experiments-constant-2": constant(gets("hp", 2, HOST_MINION)),
  // Forced Interrupt: When attached minion is defeated, place 2 threat on Gene Pool.
  "45066.genetic-experiments-forced-interrupt": forcedInterrupt(on.defeated("host"), placeThreat(2, GENE_POOL)),
  // [star] Boost: Attach this card to an Infinite minion.
  "45066.boost": boost(chooseTarget("host", INFINITE_MINION), attachCard(self, chosen("host"))),

  // Infinite Prelate — When Revealed: Unus activates against you (at 9 threat with one more boost card, Q8 = A). Then,
  // at 3: give Unus a tough status card; at 6: also heal 3 damage from Unus.
  "45067.when-revealed": whenRevealed(
    enemyActivates(UNUS_VILLAIN, { against: you, extraBoostCards: ifElse(atLeast(9), 1, 0) }),
    ifThen(atLeast(3), giveTough(UNUS_VILLAIN)),
    ifThen(atLeast(6), heal(3, UNUS_VILLAIN)),
  ),

  // Endless Ranks — When Defeated: Place 3 threat on Gene Pool.
  "45068.when-defeated": whenDefeated(placeThreat(3, GENE_POOL)),
});

/** Unregistered refs and why. Empty: every ref of the group is scripted. */
export const UNUS_SKIPPED: Readonly<Record<string, string>> = {};
