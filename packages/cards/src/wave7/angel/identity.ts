import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  alterEgoAction,
  anEnemy,
  chosen,
  dealDamage,
  defineAbilities,
  draw,
  eventTarget,
  heal,
  heroResponse,
  on,
  oncePerPhase,
  oncePerRound,
  printedCostOf,
  query,
  yourIdentity,
} from "../../dsl/index.js";

const AERIAL = trait("AERIAL");

/** "an AERIAL event" you just played. */
const AN_AERIAL_EVENT = query("event", { trait: AERIAL });

/**
 * Angel / Warren Worthington III / Archangel (42001a/b/c): docs/phase7-wave7.md §7.2, §3.62, §3.63, §4.2 Q42. A
 * foldable three-face identity card (Angel insert, "Foldable Cards"). The faces' stats, hand sizes and Archangel's
 * printed acceleration icon (`schemeIcons: ["acceleration"]` on the 42001c face) are data; the engine reads the icon
 * through the face showing, so it adds threat in villain phase step one only while Archangel is up (RRG
 * "Acceleration Icon", p. 5). Changing between the three faces is the engine's `changeForm` command.
 *
 * - **Regrowth (42001b)**, Action, alter-ego: heal 1 damage from Warren Worthington III, once per round.
 * - **Angel of Life (42001a)**, Response: after you play an AERIAL event, draw 1 card, once per phase.
 * - **Angel of Death (42001c)**, Response: after you play an AERIAL event, deal damage to an enemy equal to that
 *   event's printed cost, once per phase. Each face's ability keeps its own limit across a flip (January 26, 2026 -
 *   Ruling 6), and the face showing once the event has resolved is the one that answers (Q42, so Metamorphosis played
 *   as Angel into Archangel offers Angel of Death for its printed cost). The enemy is chosen (a minion or the villain).
 */
export const ANGEL_IDENTITY: AbilityRegistry = defineAbilities({
  "42001b.regrowth": alterEgoAction({ limit: oncePerRound }, heal(1, yourIdentity)),

  "42001a.angel-of-life": heroResponse(on.youPlayedCard(AN_AERIAL_EVENT), { limit: oncePerPhase }, draw(1)),

  "42001c.angel-of-death": heroResponse(
    on.youPlayedCard(AN_AERIAL_EVENT),
    { limit: oncePerPhase },
    anEnemy("enemy"),
    dealDamage(printedCostOf(eventTarget), chosen("enemy")),
  ),
});
