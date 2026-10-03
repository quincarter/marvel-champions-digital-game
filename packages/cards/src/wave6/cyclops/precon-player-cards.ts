import { trait } from "@mc/content";
import { THOR_PACK_CARDS } from "../../wave1/thor/pack-cards.js";
import { PHOENIX_EVENTS } from "../phoenix/phoenix/events.js";
import {
  chooseTarget,
  chosen,
  defineAbilities,
  eventTarget,
  hasAttachment,
  heal,
  heroAction,
  interrupt,
  modifyStat,
  on,
  query,
  ready,
} from "../../dsl/index.js";

const TRAINING = trait("TRAINING");

/**
 * The Cyclops pack's aspect and basic events no hero folder owns (`cyclops` 33017, 33018, 33022; docs/phase7-wave6.md
 * §3.44). Psychic Rapport 33023 is printed identically to Phoenix's 34023 (one title, two printings); aliased.
 *
 * - **Teamwork (33017)**: printed identically to Thor's `06032`; aliased.
 * - **Effective Leadership (33018)**: a resource whose "When you spend this card to play an ally" interrupt gives the
 *   ally being paid for (`eventTarget`) +1 THW and +1 ATK until the end of the phase. Not offered for a non-ally card.
 * - **Game Time (33022)**: "Hero Action: Choose an ally with a TRAINING upgrade attached -> ready that ally and heal
 *   1 damage from it." The choice is mandatory; with no such ally the event cannot be played for an effect.
 */
export const CYCLOPS_PRECON_PLAYER_CARDS = defineAbilities({
  "33017.teamwork-constant": THOR_PACK_CARDS["06032.teamwork-constant"]!,

  "33023.psychic-rapport-action": PHOENIX_EVENTS["34023.psychic-rapport-action"]!,

  "33018.effective-leadership-interrupt": interrupt(
    on.youSpendThis({ toPlay: query("ally") }),
    modifyStat("thw", 1, eventTarget, "endOfPhase"),
    modifyStat("atk", 1, eventTarget, "endOfPhase"),
  ),

  "33022.game-time-action": heroAction(
    chooseTarget("ally", query("ally", hasAttachment(query("upgrade", { trait: TRAINING })))),
    ready(chosen("ally")),
    heal(1, chosen("ally")),
  ),
});
