import {
  action,
  addCounters,
  alterEgoAction,
  cards,
  choosePlayer,
  chooseCards,
  chooseOptions,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  damageAnEnemy,
  defineAbilities,
  doublesResourcesWhilePayingFor,
  draw,
  exhaustThis,
  gets,
  heal,
  heroAction,
  modifyStat,
  moveCards,
  on,
  option,
  query,
  reduceNextCardCost,
  removeCounter,
  removeThreatFromAScheme,
  resource,
  response,
  topOfDeck,
  traitNumber,
  yourIdentity,
  YOUR_IDENTITY,
} from "../../dsl/index.js";

/**
 * Ironheart's own supports, upgrades and resources (`ironheart` 29009-29013, 29020-29021, 29026-29027;
 * docs/phase7-wave5.md's Ironheart row), read directly from `packages/content/src/data/ironheart/cards.ts` (no
 * errata on RRG 1.8, no `curation/ironheart.ts` correction on any of these). Every "Ironheart"/"Riri Williams" in
 * the printed text is her identity (`yourIdentity`), matching `identity.ts`'s and `events.ts`'s own reading.
 *
 * **Stroke of Genius (resource, 29009)**: "Response: After you spend this card, place 1 progress counter on your
 * identity and draw 1 card." Plain "Response:" (not "Hero Response:" — Pym Particles' own `12006` text is "Hero
 * Response", this one prints no form label), so `response`, not `heroResponse`, on `on.youSpendThis()`
 * (`dsl/abilities.ts`, the Ant-Man Pym Particles precedent `wave2/ant/kit.ts` for the trigger shape itself).
 *
 * **Ronnie Williams (support, 29010)**: "Alter-Ego Action: Exhaust Ronnie Williams → choose: • Heal 2 damage from
 * Riri Williams. • Place 1 progress counter on Riri Williams." `chooseOptions(1, …)` is "choose one of the
 * following" (RRG 1.8 "Choose (Option)", p. 12); the one action ref carries the header and both bullets.
 *
 * **Tony Stark A.I. (support, 29011)**: "Action: Exhaust Tony Stark A.I. → look at the top 2 cards of your deck.
 * Add 1 to your hand and discard the other." Plain "Action:" (usable in either form, not "Hero Action:"), the exact
 * shape of Core Iron Man's own Futurist (`01029b.futurist`, `core/heroes/iron-man.ts`) at N=2 instead of N=3:
 * `chooseCards` over `topOfDeck(2)` (min 1, max 1) into hand, the remaining card (`topOfDeck(1)`, read after the
 * first has left the deck) to the discard pile.
 *
 * **Photon Blasters (upgrade, 29012)** / **Propulsion Jets (upgrade, 29013)**: both print "You get +2 hit points."
 * (`constant(gets("hp", 2, YOUR_IDENTITY))`, Core Mark V Armor's own shape, `core/heroes/iron-man.ts` `01036`) plus
 * a "Hero Action: Exhaust [this] → …" whose amount is "equal to Ironheart's Version number"
 * (`traitNumber(yourIdentity, "Version")`, `events.ts`'s own Sector Scan precedent for reading the trait). Photon
 * Blasters deals that much damage to an enemy (`damageAnEnemy`, Core's own helper); Propulsion Jets removes that
 * much threat from a scheme (`removeThreatFromAScheme`).
 *
 * **R&D Facility (support, 29020)**: "Requirement ([mental][mental]). Uses (3 research counters).\nHero Action:
 * Exhaust R&D Facility and remove 1 research counter from it → choose a friendly character in play. That character
 * gets +1 THW and +1 ATK until the end of the phase." `Requirement`/`Uses` are data (`keywords`, no ability ref —
 * Nova's own No Quarter precedent, `../nova/support-upgrades-allies.ts`); the cost is `[exhaustThis,
 * removeCounter("research")]`, the exact shape Core's Enhanced Awareness already uses (`wave1/cap/pack-cards.ts`
 * `03034.enhanced-awareness-resource`, its own "mental" `Uses` counter). "A friendly character in play" is
 * `query("character", { controller: "you" })` (Kang's/Red Skull's own `chooseTarget("char", …)` precedent,
 * `wave2/toafk/kang-encounter-set.ts`).
 *
 * **The Power of Leadership (resource, 29021)**: reprints Core's own resource verbatim (`01072.the-power-of-
 * leadership-constant`, `core/aspects/leadership.ts`) — same `constant(doublesResourcesWhilePayingFor({ aspect:
 * "leadership" }))`, scripted again under this card's own id rather than aliased, matching how `../nova/support-
 * upgrades-allies.ts`'s own Power of Aggression docblock reasons ("this pack has no reprint-aliasing module of its
 * own yet").
 *
 * **Helicarrier (support, 29026)**: `images.front` (`01092.png`) and text are Core's Helicarrier verbatim
 * (`01092.helicarrier-action`, `core/aspects/basic.ts`) — "Max 1 per player" is data
 * (`playRestrictions.maxPerPlayer`); the ability itself is the identical `choosePlayer()` +
 * `reduceNextCardCost(chosenPlayer(), 1, "phase")` call, scripted again under `29026` for the same no-reprint-
 * module reason as The Power of Leadership above (no `wave5/reprints.ts` exists yet to alias it from Core).
 *
 * **Ingenuity (upgrade, 29027)**: "Play only if your identity has the Genius trait. Max 1 per player.\nResource:
 * Exhaust Ingenuity → generate a [mental] resource." "Play only if …"/"Max 1 per player" are data
 * (`playRestrictions`); the ability is a plain `resource({ mental: 1 }, { cost: exhaustThis })` (no "Hero" label —
 * usable from either form, the same reading Tony Stark A.I. above gets).
 */

export const IRONHEART_SUPPORT_UPGRADES = defineAbilities({
  "29009.stroke-of-genius-response": response(on.youSpendThis(), addCounters("progress", 1, yourIdentity), draw(1)),

  "29010.ronnie-williams-action": alterEgoAction(
    { cost: exhaustThis },
    chooseOptions(1, [
      option("Heal 2 damage from Riri Williams.", heal(2, yourIdentity)),
      option("Place 1 progress counter on Riri Williams.", addCounters("progress", 1, yourIdentity)),
    ]),
  ),

  "29011.tony-stark-ai-action": action(
    { cost: exhaustThis },
    chooseCards("pick", topOfDeck(2), { min: 1, max: 1 }),
    moveCards(cards(chosen("pick")), "hand"),
    moveCards(topOfDeck(1), "discard"),
  ),

  "29012.photon-blasters-constant": constant(gets("hp", 2, YOUR_IDENTITY)),
  "29012.photon-blasters-action": heroAction(
    { cost: exhaustThis },
    damageAnEnemy(traitNumber(yourIdentity, "Version")),
  ),

  "29013.propulsion-jets-constant": constant(gets("hp", 2, YOUR_IDENTITY)),
  "29013.propulsion-jets-action": heroAction(
    { cost: exhaustThis },
    removeThreatFromAScheme(traitNumber(yourIdentity, "Version")),
  ),

  "29020.r-and-d-facility-action": heroAction(
    { cost: [exhaustThis, removeCounter("research")] },
    chooseTarget("char", query("character", { controller: "you" })),
    modifyStat("thw", 1, chosen("char"), "endOfPhase"),
    modifyStat("atk", 1, chosen("char"), "endOfPhase"),
  ),

  "29021.the-power-of-leadership-constant": constant(doublesResourcesWhilePayingFor({ aspect: "leadership" })),

  "29026.helicarrier-action": action(
    { cost: exhaustThis },
    choosePlayer(),
    reduceNextCardCost(chosenPlayer(), 1, "phase"),
  ),

  "29027.ingenuity-resource": resource({ mental: 1 }, { cost: exhaustThis }),
});
