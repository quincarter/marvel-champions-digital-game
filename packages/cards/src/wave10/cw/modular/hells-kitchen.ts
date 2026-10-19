import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  attachCard,
  boost,
  cannotAttach,
  chooseTarget,
  chosen,
  competitiveOnly,
  constant,
  defineAbilities,
  enemyActivates,
  enemyTeamChooses,
  exhaust,
  exists,
  firstPlayer,
  gainsKeyword,
  gets,
  ifThen,
  inCompetitiveMode,
  query,
  rule,
  self,
  surge,
  whenRevealed,
  you,
} from "../../../dsl/index.js";
import { STREET_DEFENDERS } from "./defenders.js";

const HOST_MINION = query("minion", { hostOfSelf: true });
// No "choose": an encounter card targeting one of several eligible cards; the first player selects
// (RRG 1.8 "First Player", p. 19).
const A_CHARACTER_YOU_CONTROL = chooseTarget("tired", query("character", { controller: "you" }), {
  chooser: firstPlayer,
});
const A_CHARACTER_THE_ENEMY_TEAM_PICKS = chooseTarget("tired", query("character", { controller: "you" }), {
  chooser: enemyTeamChooses,
});

/**
 * Modular encounter set `hells_kitchen` (Civil War, Resistance side; docs/phase7-wave10.md sections 3.5, 3.6 and
 * 3.23). Hinder 1[per_hero] on Defend Hell's Kitchen is a data keyword. Outside Civil War "the enemy leader" is the
 * villain (FFG ruling July 9, 2026), and in a cooperative game there is no "your leader" (MC56 p. 6).
 *
 * **Daredevil (56189)**: When Revealed: "the enemy team exhausts a character you control" is the first player's choice
 * among the revealing player's characters, in a prompt marked as the enemy team's (owner's answer to question 6 = A,
 * 2026-10-11). Boost: the first player chooses the character to exhaust.
 *
 * **Iron Fist (56190)**: When Revealed: "Iron Fist attacks your leader" has no leader to attack cooperatively, so the
 * "Otherwise" sentence resolves: he activates against you (a minion, so no boost card). Boost: "The enemy leader attacks
 * your leader (after this activation)" has no leader to attack and does nothing; both sentences are written in full
 * as competitive-only markers.
 *
 * **Resistance Fighter (56191)**: the attach sentence is the data host (`attachesTo`: a minion), several hosts being
 * the first player's choice (question 6 = A); with no minion in play the card gains surge (`cannotAttach`). The
 * attached minion gets +4 hit points and stalwart; the +1 ATK and +1 SCH are data. Boost: it is attached to a minion
 * engaged with the player activated against (chosen by the first player if several).
 *
 * **Street Defenders (56192)**: the same card as The Defenders' 56187, the one shared definition.
 *
 * **Defend Hell's Kitchen (56193)**: threat cannot be removed from it while a Defender minion is in play.
 *
 * Cards (5):
 * - 56189 Daredevil (minion)
 * - 56190 Iron Fist (minion)
 * - 56191 Resistance Fighter (attachment)
 * - 56192 Street Defenders (treachery)
 * - 56193 Defend Hell's Kitchen (side_scheme)
 */
export const MODULAR_HELLS_KITCHEN: AbilityRegistry = defineAbilities({
  "56189.when-revealed": whenRevealed(A_CHARACTER_THE_ENEMY_TEAM_PICKS, exhaust(chosen("tired"))),
  "56189.boost": boost(A_CHARACTER_YOU_CONTROL, exhaust(chosen("tired"))),

  "56190.when-revealed": whenRevealed(
    ifThen(
      inCompetitiveMode(),
      [competitiveOnly("Iron Fist attacks your leader.")],
      enemyActivates(self, { against: you }),
    ),
  ),
  "56190.boost": boost(
    ifThen(inCompetitiveMode(), [
      competitiveOnly(
        "The enemy leader attacks your leader (after this activation). Do not give it a boost card for this attack.",
      ),
    ]),
  ),

  "56191.resistance-fighter-constant": cannotAttach(surge()),
  "56191.resistance-fighter-constant-2": constant(
    gets("hp", 4, HOST_MINION),
    gainsKeyword({ name: "stalwart" }, HOST_MINION),
  ),
  "56191.boost": boost(
    chooseTarget("host", query("minion", { engagedWithPlayer: you }), { chooser: firstPlayer }),
    attachCard(self, chosen("host")),
  ),

  "56192.when-revealed": STREET_DEFENDERS,

  "56193.defend-hells-kitchen-constant": constant(
    rule({
      kind: "threatCannotBeRemoved",
      target: { self: true },
      while: exists(query("minion", { trait: trait("DEFENDER") })),
    }),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. Delete a line as its ref is scripted. */
export const MODULAR_HELLS_KITCHEN_SKIPPED: Readonly<Record<string, string>> = {};
