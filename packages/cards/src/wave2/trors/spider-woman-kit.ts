import {
  action,
  after,
  anyOf,
  attack,
  chooseTarget,
  choosePlayer,
  chosen,
  chosenPlayer,
  confuse,
  coveredByEngineRule,
  defineAbilities,
  divide,
  draw,
  gainTraitUntil,
  hasStatus,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  giveTough,
  perHero,
  query,
  ready,
  removeThreat,
  response,
  selectCards,
  stun,
  thwart,
  valueAtMost,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { trait } from "@mc/content";

const AERIAL = trait("AERIAL");

/**
 * Spider-Woman / Jessica Drew (04031a/b) and her hero kit (04032–04039). Reprints in this pack (Combat Training,
 * Tac Team, Heroic Intuition, Interrogation Room) are aliased from Core by `../reprints.ts`.
 *
 * **Skipped (missing engine primitive — see docs/phase7-wave2-scripting.md):**
 * - `04031a.superhuman-agility` — "limit once per round for each aspect" needs a limit keyed by the played card's
 *   aspect (docs/phase7-wave2.md §3.11, "Not done": Superhuman Agility's own limit).
 * - `04033.finesse-resource` and `04034.jessica-drews-apartment-action` — "for an aspect card" / "for an aspect
 *   card" need a `TargetQuery` matching *any* of the four core aspects (aggression/justice/leadership/protection),
 *   not one fixed value. `TargetQuery.aspect` (`select.ts` `matchesQuery`) is an exact single-string match against
 *   `card.aspect`/`card.printedAspect`; there is no `anyAspect`/`isAspectCard` OR, unlike `anyTrait`/
 *   `anyPrintedResource`. Closest existing primitive: `anyTrait: readonly Trait[]`.
 * - `04044.piercing-strike-action` (a plain Aggression aspect card in this pack, not part of her own signature
 *   set) — "This attack gains piercing" on a played event's own one-shot attack: the same gap as Vibranium Arrow
 *   (`hawkeye-kit.ts`'s module docblock) and Crossfire's boost (`hawkeye-obligation-nemesis.ts`); no attachment or
 *   character persists to grant the keyword "from". Closest existing primitive: `attack()`'s own `overkill`
 *   option, which is the same per-effect-override shape a `piercing`/`ranged` option would need.
 */
export const SPIDER_WOMAN_KIT = defineAbilities({
  // Double Agent — Choose two aspects instead of one during deck-building (data, `deckbuilding`).
  "04031b.jessica-drew-constant": coveredByEngineRule(),
  // Jessica Drew — Action: Look at the top card of any deck. (Limit once per round.)
  "04031b.jessica-drew-action": action(
    { limit: { count: 1, period: "round" } },
    choosePlayer("player"),
    selectCards("looked", zone("deck", chosenPlayer("player"), { top: 1 })),
  ),

  // Captain Marvel — Response: After Captain Marvel uses a basic power, draw 1 card.
  "04032.captain-marvel-response": response(after.basicPowerUsed("self"), draw(1)),

  // Venom Blast (04035, printed Aggression, her own aspect-coloured signature set — §1.2) — Hero Action (attack):
  // Deal 5 damage to an enemy.
  "04035.venom-blast-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy", { attackableBy: yourIdentity })),
    attack(5, chosen("enemy")),
  ),

  // Pheromones (04036, printed Leadership) — Hero Action: Stun and confuse an enemy.
  "04036.pheromones-action": heroAction(
    chooseTarget("enemy", query("enemy")),
    stun(chosen("enemy")),
    confuse(chosen("enemy")),
  ),

  // Contaminant Immunity — Hero Action: Heal 3 damage from Spider-Woman and give her a tough status card.
  "04037.contaminant-immunity-action": heroAction(heal(3, yourIdentity), giveTough(yourIdentity)),

  // Inconspicuous — Hero Action (thwart): Remove a total of 3 threat from among schemes in play.
  "04038.inconspicuous-action": heroAction({ label: "thwart" }, divide("threat", 3, query("scheme"))),

  // Self-Propelled Glide — Hero Action: Ready Spider-Woman. She gains aerial until the end of the round.
  "04039.self-propelled-glide-action": heroAction(ready(yourIdentity), gainTraitUntil(AERIAL, yourIdentity, "endOfRound")),

  // Spider-Girl — Response: After you play Spider-Girl from your hand, stun and confuse a minion.
  "04040.spider-girl-response": response(
    after.youPlayThis(),
    chooseTarget("minion", query("minion")),
    stun(chosen("minion")),
    confuse(chosen("minion")),
  ),

  // Press the Advantage — Hero Action (attack): Deal 2 damage to an enemy. If that enemy is stunned or confused, draw 1 card.
  "04043.press-the-advantage-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy", { attackableBy: yourIdentity })),
    attack(2, chosen("enemy")),
    ifThen(anyOf(hasStatus(chosen("enemy"), "stunned"), hasStatus(chosen("enemy"), "confused")), draw(1)),
  ),

  // Spider-Man — Response: After you play Spider-Man from your hand, remove 3 [per_hero] threat from a side scheme.
  "04045.spider-man-response": response(after.youPlayThis(), chooseTarget("scheme", query("sideScheme")), removeThreat(perHero(3), chosen("scheme"))),

  // Skilled Investigator — Play under any player's control (data). Hero Response: After a side scheme is
  // defeated, exhaust Skilled Investigator → draw 1 card.
  "04047.skilled-investigator-response": heroResponse(after.schemeDefeated(query("sideScheme")), { cost: { exhaustSelf: true } }, draw(1)),

  // Clear the Area — Hero Action (thwart): Remove 2 threat from a scheme. If this removes the last threat on that
  // scheme, draw 1 card. Checked before the removal (so "the last threat" reads pre-removal threat <= 2, not the
  // scheme's possibly-already-left-play state after).
  "04049.clear-the-area-action": heroAction(
    { label: "thwart" },
    chooseTarget("scheme", query("scheme")),
    ifThen(valueAtMost({ kind: "threat", of: chosen("scheme") }, 2), draw(1)),
    thwart(2, chosen("scheme")),
  ),
});
