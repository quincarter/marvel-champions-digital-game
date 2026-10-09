import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  attacksGainKeywords,
  boost,
  chooseOne,
  constant,
  discard,
  draw,
  enemyActivates,
  enemyAttack,
  eventTarget,
  find,
  giveBoostCard,
  forcedInterrupt,
  gets,
  heroAction,
  host,
  ifThen,
  modifyAttack,
  named,
  not,
  on,
  option,
  query,
  revealCard,
  self,
  surge,
  varAtLeast,
  whenRevealed,
  you,
  giveTough,
  defineAbilities,
} from "../../dsl/index.js";

const JOYSTICK = "Joystick";

/** "When Joystick activates against you": the activation's player is the one the ability's controller is. */
const JOYSTICK_ACTIVATES_AGAINST_YOU: EventPattern = { ...on.enemyActivating("self"), playerIs: "controller" };

/**
 * Modular encounter set `extreme_risk` (Black Panther (Shuri), a Thunderbolt set; docs/phase7-wave9.md section 3.49,
 * 3.52, 7.9). Villainous and Victory 1 on Joystick, Energy Truncheon's "Attach to Joystick. Otherwise, attach to the
 * villain." and Playing for Keeps' threat are data.
 *
 * **Joystick (51039)**: Forced Interrupt when she activates against you: choose to give her 1 additional boost card for
 * this activation and draw 1 card, or give her a tough status card. The interrupt runs before the activation's own
 * boost step, so a boost card given then (`giveBoostCard`, the spec's choice for 51041) is flipped in this activation,
 * ahead of and in addition to the automatic one (RRG 1.8 "Boost, Boost Icon", p. 11); `modifyAttack` has no activation
 * yet to change at that timing.
 *
 * **Energy Truncheon (51040)**: the attached enemy's attacks gain piercing. Hero Action: the attached enemy attacks you;
 * after the attack, discard this card and draw 1 card. The Fixer redirect of section 3.49 is not this set's.
 *
 * **Playing for Keeps (51041)**: each identity gets +1 hand size; Forced Interrupt when any enemy activates: it gets 1
 * additional boost card for that activation.
 *
 * **Extreme Risk (51042)**: finds and reveals Joystick (engaging you when already in play), who activates against you;
 * surge when nobody activated. Boost: you may give the activating enemy an additional boost card; if you do, draw 1.
 *
 * Cards (4):
 * - 51039 Joystick (minion)
 * - 51040 Energy Truncheon (attachment)
 * - 51041 Playing for Keeps (side_scheme)
 * - 51042 Extreme Risk (treachery)
 */
export const EXTREME_RISK: AbilityRegistry = defineAbilities({
  "51039.joystick-forced-interrupt": forcedInterrupt(
    JOYSTICK_ACTIVATES_AGAINST_YOU,
    chooseOne(
      option("Give her 1 additional boost card and draw 1 card", giveBoostCard(self), draw(1)),
      option("Give her a tough status card", giveTough(self)),
    ),
  ),

  "51040.energy-truncheon-constant": constant(
    attacksGainKeywords(["piercing"], { attacker: query("enemy", { hostOfSelf: true }) }),
  ),
  "51040.energy-truncheon-action": heroAction(enemyAttack(host, { against: you }), discard(self), draw(1)),

  "51041.playing-for-keeps-constant": constant(gets("handSize", 1, query("identity"))),
  "51041.playing-for-keeps-forced-interrupt": forcedInterrupt(on.enemyActivating(), giveBoostCard(eventTarget)),

  "51042.when-revealed": whenRevealed(
    revealCard(find(query("minion", { name: JOYSTICK })), you),
    enemyActivates(named(JOYSTICK), { against: you, bind: "activated" }),
    ifThen(not(varAtLeast("activated.made")), surge()),
  ),
  "51042.boost": boost(
    chooseOne(
      option(
        "Give the activating enemy an additional boost card and draw 1 card",
        modifyAttack({ extraBoostCards: 1 }),
        draw(1),
      ),
      option("Do not give an additional boost card"),
    ),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const EXTREME_RISK_SKIPPED: Readonly<Record<string, string>> = {};
