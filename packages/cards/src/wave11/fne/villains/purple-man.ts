import { trait } from "@mc/content";
import type { AbilityRegistry, EffectSpec, TargetQuery, ValueSpec } from "@mc/engine";
import {
  attacksGainKeywords,
  bindTargets,
  boostCardsFromSet,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  controllerOf,
  dealAsEncounterCard,
  dealDamage,
  defeatingPlayer,
  defineAbilities,
  discard,
  each,
  encounterCards,
  engage,
  exhaustThis,
  firstPlayer,
  forcedAction,
  gainsAbility,
  gainsKeyword,
  gainsTrait,
  giveTough,
  host,
  identityOf,
  isAttached,
  placeThreat,
  query,
  removeCounter,
  revealCard,
  atEndOfActivation,
  boost,
  self,
  statOf,
  superlative,
  surge,
  theMainScheme,
  theVillain,
  treatAttachedAllyAsMinion,
  countAmong,
  valueAtLeast,
  whenDefeated,
  whenRevealed,
  you,
  printedCostOf,
  ifThen,
} from "../../../dsl/index.js";

const INFLUENCED = trait("INFLUENCED");
const INFLUENCED_MINION = query("minion", { trait: INFLUENCED });
/** The command counters on "Fight." / "Protect." / "Serve." (Uses data). */
const COMMAND = "command";
/**
 * The Boost the three villain stages grant: "[star] Boost: After this activation, deal this card to yourself as a
 * facedown encounter card." A `boost` ability on the set's boost cards, read as each is turned faceup; "yourself" is
 * the player the activation is against, the Boost's "you" (RRG 1.8 "Activation" p. 6, "Attacks Against Allies" p. 10, "Boost, Boost Icon" p. 11). It is listed on no
 * card's own abilities (the data keeps one ref for the constant that quotes it).
 */
const GRANTED_BOOST = "60097.granted-boost";

/** "Each Influenced minion gains guard[, patrol][, and villainous]." (60097-60099.) */
const influencedGain = (keywords: readonly ("guard" | "patrol" | "villainous")[]) =>
  constant(...keywords.map((name) => gainsKeyword({ name }, INFLUENCED_MINION)));
const grantsBoost = () => constant(gainsAbility(GRANTED_BOOST, { to: boostCardsFromSet("purple_man") }));

/** A tie for "the highest ..." among encounter-card targets is decided by the first player (RRG 1.8 p. 19). */
const highestToDiscard = (slot: string, pool: TargetQuery, measure: ValueSpec) =>
  [
    bindTargets("highest", superlative("highest", each(pool), measure)),
    chooseTarget(slot, { inSlot: "highest" }, { chooser: firstPlayer }),
    discard(chosen(slot)),
  ] as const;

/** One of "Fight." / "Protect." / "Serve.": Uses (3 command counters) is data; Forced Action as printed. */
const command = (...effects: readonly EffectSpec[]) =>
  forcedAction({ cost: [exhaustThis, removeCounter(COMMAND, 1)] }, ...effects);

/**
 * Purple Man (docs/phase7-wave11-scenarios.md section S6, S3.6, S3.9).
 *
 * **60097-60099 Purple Man I-III**: Influenced minions gain guard (II adds villainous, III adds patrol and
 * villainous), and every boost card of the Purple Man set gains the Boost "after this activation, deal this card to
 * yourself as a facedown encounter card" (engine `gainsAbility` to `boostCardsFromSet`, cancellable like a printed Boost).
 * **60100 Converted**: Beguiled's shape (`wave4/mts/enchantress.ts`): the attached ally is an Influenced minion with
 * SCH equal to its base THW (`treatAttachedAllyAsMinion`); When Revealed engages it, else surge. Owner Q206
 * (Converted and Baron Zemo on one ally) is built as default A: Converted only.
 * **60101-60104 civilians**: Vulnerable, Patrol and the Influenced trait are data; each When Defeated as printed. A
 * tie for "the highest" is decided by the first player (RRG 1.8 "First Player", p. 19, as Hammerhead's Power Struggle).
 * **60105-60107 Fight / Protect / Serve**: Uses (3 command counters) is data; each Forced Action exhausts the card and
 * removes a counter as its cost. **60108 Power of Suggestion**: Hinder is data; every minion gains Influenced.
 * **60109 Sway the Masses**: reveals a chosen Influenced minion from the encounter discard pile, else surge.
 *
 * Cards (11):
 * - 60097 Purple Man (villain)
 * - 60100 Converted (attachment)
 * - 60101 Firefighter (minion)
 * - 60102 Judge (minion)
 * - 60103 Security Guard (minion)
 * - 60104 Skater Punk (minion)
 * - 60105 "Fight." (obligation)
 * - 60106 "Protect." (obligation)
 * - 60107 "Serve." (obligation)
 * - 60108 Power of Suggestion (side_scheme)
 * - 60109 Sway the Masses (treachery)
 */
export const FNE_VILLAINS_PURPLE_MAN: AbilityRegistry = defineAbilities({
  "60097.purple-man-constant": influencedGain(["guard"]),
  "60097.purple-man-constant-2": grantsBoost(),
  "60098.purple-man-constant": influencedGain(["guard", "villainous"]),
  "60098.purple-man-constant-2": grantsBoost(),
  "60099.purple-man-constant": influencedGain(["guard", "patrol", "villainous"]),
  "60099.purple-man-constant-2": grantsBoost(),
  [GRANTED_BOOST]: boost(atEndOfActivation(dealAsEncounterCard(self, you))),

  // Owner Q206 = A: while Converted holds an ally it is Converted's Influenced minion, not an ally, so Baron Zemo
  // (60145) does not reach it; if Converted leaves while Zemo stays, Zemo makes it Deceived. RRG 1.8 p. 4; ruling
  // Dec 17, 2025; the July 8, 2022 Mind Control vs. Beguiled ruling does not force otherwise (see
  // engine/src/treat-as.ts syncRuleTreatments).
  "60100.converted-constant": constant(treatAttachedAllyAsMinion([INFLUENCED], { schFromThw: "base" })),
  "60100.when-revealed": whenRevealed(ifThen(isAttached(self), engage(host, controllerOf(host)), surge())),

  "60101.firefighter-constant": constant(attacksGainKeywords(["piercing"], { attacker: { self: true } })),
  "60101.when-defeated": whenDefeated(
    // Cost: RRG 1.8 "Base Value" p. 10; cost modifiers apply only while paying (p. 24). A Permanent card is not a valid
    // target of a leave-play effect (RRG 1.8 "Permanent", p. 32), so it is out of the pool: the non-permanent card goes.
    ...highestToDiscard(
      "costly",
      query(["support", "upgrade"], { withoutKeyword: "permanent" }),
      printedCostOf(chosen("candidate")),
    ),
  ),
  "60102.when-defeated": whenDefeated(placeThreat(3, theMainScheme)),
  "60103.when-defeated": whenDefeated(
    ...highestToDiscard("strongest", query("ally"), statOf(chosen("candidate"), "atk")),
  ),
  "60104.when-defeated": whenDefeated(dealDamage(3, identityOf(defeatingPlayer))),

  "60105.fight-constant": constant(),
  "60105.fight-forced-action": command(
    chooseTarget("victim", query(["hero", "ally"])),
    dealDamage(2, chosen("victim")),
  ),
  "60106.protect-constant": constant(),
  "60106.protect-forced-action": command(giveTough(theVillain)),
  "60107.serve-constant": constant(),
  "60107.serve-forced-action": command(placeThreat(2, theMainScheme)),

  "60108.power-of-suggestion-constant": constant(gainsTrait(INFLUENCED, query("minion"))),

  "60109.when-revealed": whenRevealed(
    // "Otherwise" (RRG 1.8 p. 31): no minion was chosen, so the reveal cannot be done.
    chooseCards("minion", encounterCards(["discard"], INFLUENCED_MINION), { min: 1, max: 1 }),
    ifThen(valueAtLeast(countAmong(chosen("minion"), query("minion")), 1), revealCard(chosen("minion"), you), surge()),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FNE_VILLAINS_PURPLE_MAN_SKIPPED: Readonly<Record<string, string>> = {};
