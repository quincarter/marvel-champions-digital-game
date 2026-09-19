import {
  action,
  after,
  alterEgoAction,
  ANY_ASPECT_CARD,
  anyOf,
  attack,
  cards,
  chooseCards,
  chooseTarget,
  choosePlayer,
  chosen,
  chosenPlayer,
  confuse,
  coveredByEngineRule,
  defineAbilities,
  divide,
  draw,
  exhaustThis,
  gainTraitUntil,
  hasStatus,
  heal,
  heroAction,
  heroResponse,
  ifThen,
  giveTough,
  interrupt,
  modifyStat,
  moveCards,
  perHero,
  query,
  ready,
  removeThreat,
  resource,
  response,
  selectCards,
  shuffleDeck,
  stun,
  thwart,
  valueAtMost,
  when,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { trait } from "@mc/content";

const AERIAL = trait("AERIAL");

/**
 * Spider-Woman / Jessica Drew (04031a/b) and her hero kit (04032–04039). Reprints in this pack (Combat Training,
 * Tac Team, Heroic Intuition, Interrogation Room) are aliased from Core by `../reprints.ts`.
 *
 * `04031a.superhuman-agility`, `04033.finesse-resource`, `04034.jessica-drews-apartment-action` and
 * `04044.piercing-strike-action` were all pinned pending engine primitives that have since landed
 * (docs/phase7-wave2.md §3): `TargetQuery.anyAspect` (`ANY_ASPECT_CARD`, `dsl/effects.ts`) for "an aspect card",
 * `AbilityLimit.per: "aspectOfEventCard"` for Superhuman Agility's own per-aspect limit, and `AttackKeyword`/
 * `attack(...).keywords` for Piercing Strike (the same one-shot-attack grant as Vibranium Arrow, `hawkeye-kit.ts`).
 */
export const SPIDER_WOMAN_KIT = defineAbilities({
  // Superhuman Agility — Interrupt: When you play an aspect card, Spider-Woman gets +1 THW, +1 ATK, and +1 DEF
  // until the end of the round. (limit once per round for each aspect.) A printed hero-face ability: plain
  // `interrupt`, not `heroInterrupt` — face membership (this ref only lives on the hero face) already gates it,
  // the same convention Hawkeye's "Quick Draw" (04001a.quick-draw, `hawkeye-kit.ts`) uses.
  "04031a.superhuman-agility": interrupt(
    when.youPlay(ANY_ASPECT_CARD),
    { limit: { count: 1, period: "round", per: "aspectOfEventCard" } },
    modifyStat("thw", 1, yourIdentity, "endOfRound"),
    modifyStat("atk", 1, yourIdentity, "endOfRound"),
    modifyStat("def", 1, yourIdentity, "endOfRound"),
  ),

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

  // Finesse — Hero Resource: Exhaust Finesse → generate a [wild] resource for an aspect card.
  "04033.finesse-resource": resource({ wild: 1 }, { cost: exhaustThis, generatesFor: ANY_ASPECT_CARD }),

  // Jessica Drew's Apartment — Alter-Ego Action: Exhaust Jessica Drew's Apartment → search the top 5 cards of your
  // deck for an aspect card and add it to your hand. Shuffle your deck.
  "04034.jessica-drews-apartment-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("found", zone("deck", you, { top: 5, filter: ANY_ASPECT_CARD }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

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

  // Piercing Strike — Hero Action (attack): Deal 3 damage to an enemy. This attack gains piercing. A played event's
  // own one-shot attack: `attack(...).keywords` (not a persistent constant rule — no card stays in play to grant it).
  "04044.piercing-strike-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy", { attackableBy: yourIdentity })),
    attack(3, chosen("enemy"), { keywords: ["piercing"] }),
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
