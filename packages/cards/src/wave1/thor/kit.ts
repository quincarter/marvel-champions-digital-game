import {
  after,
  alterEgoAction,
  attackAnEnemy,
  cards,
  chooseCards,
  chosen,
  constant,
  dealDamage,
  defineAbilities,
  discardEncounterUntil,
  draw,
  each,
  exhaustCardsCost,
  gainsTrait,
  gets,
  hasTrait,
  heroAction,
  heroResource,
  ifThen,
  moveCards,
  oncePerRound,
  putIntoPlay,
  query,
  ready,
  response,
  shuffleDeck,
  spendX,
  theVillain,
  thwartAScheme,
  TRAIT,
  varOf,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";
import { ASGARD, dealDamageIgnoringTough } from "./local.js";

const MJOLNIR_NAME = cardName("06009");
/** Mjolnir, as an in-play cost pick or a search filter. The engine limits cost candidates to cards the payer controls. */
const MJOLNIR = query("upgrade", { name: MJOLNIR_NAME });

/**
 * Thor / Odinson (06001a/b) and his signature hero kit (06002–06010, printed `aspect: "hero:06001a"`). The rest of
 * the physical Thor pack (06011 onward) is generic-aspect filler, not locked to Thor's own deck — see
 * `pack-cards.ts`. "Chase Them Down" (06013), "The Power of Aggression" (06016) and "Avengers Mansion" (06025) are
 * Core reprints aliased from `../reprints.ts`, not scripted here — see `docs/phase7-wave1-scripting.md`.
 */
export const THOR_KIT = defineAbilities({
  // "Have at thee!" — Response: After you engage a minion, draw 2 cards. (Limit once per phase.)
  // `{ on: "minionEngaged", playerIs: "controller" }` is the landed primitive for "after you engage a minion"
  // (packages/engine/src/trigger-events.ts, named for this exact card; packages/engine/src/triggers-wave1.test.ts).
  "06001a.have-at-thee": response(
    { on: "minionEngaged", playerIs: "controller" },
    { limit: { count: 1, period: "phase" } },
    draw(2),
  ),

  // Worthy — Action: Search your deck and discard pile for the Mjolnir upgrade and add it to your hand. Shuffle
  // your deck. (Limit once per round). Mjolnir is unique (deckLimit 1), so at most one card can ever match.
  "06001b.worthy": alterEgoAction(
    { limit: oncePerRound },
    moveCards(zone(["deck", "discard"], you, { filter: MJOLNIR }), "hand"),
    shuffleDeck(),
  ),

  // Lady Sif — Response: After Lady Sif enters play, ready Thor or Odinson (your identity, whichever form it's in).
  "06002.lady-sif-response": response(after.entersPlay("self"), ready(yourIdentity)),

  // Defender of the Nine Realms — Hero Action (thwart): Discard cards from the top of the encounter deck until you
  // discard a minion. Put that minion into play engaged with you → remove 3 threat from a scheme. Not a true
  // `AbilityCost` (the game gives no way to decline the discard-until-minion once the action is taken); the
  // "(thwart)" label belongs to the final "remove 3 threat" sentence, so only that uses the real `thwart` effect
  // (guard/confused/crisis apply to it, not to the earlier setup).
  "06003.defender-of-the-nine-realms-action": heroAction(
    { label: "thwart" },
    discardEncounterUntil(query("minion"), "minion"),
    putIntoPlay(chosen("minion")),
    thwartAScheme(3),
  ),

  // For Asgard! — Alter-Ego Action: Search your deck and discard pile for a card with the Asgard trait and add it
  // to your hand. Shuffle your deck. Several different cards could match, so this is a choice (unlike Worthy's
  // unique Mjolnir search) — `ally`/`event`/`support`/`upgrade` are every category an Asgard card could print as.
  "06004.for-asgard-action": alterEgoAction(
    chooseCards(
      "found",
      zone(["deck", "discard"], you, { filter: query(["ally", "event", "support", "upgrade"], { trait: ASGARD }) }),
      { min: 1, max: 1 },
    ),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Hammer Throw — Hero Action (attack): Exhaust Mjolnir → deal 8 damage to an enemy and return Mjolnir to your
  // hand. This attack gains overkill. Only a Mjolnir Thor controls can pay (RRG 1.8 "Cost", p. 14), which the
  // engine enforces; the exhausted card is bound to the cost's default `exhausted` slot.
  "06005.hammer-throw-action": heroAction(
    { label: "attack", cost: exhaustCardsCost(MJOLNIR) },
    attackAnEnemy(8, { overkill: true }),
    moveCards(cards(chosen("exhausted")), "hand"),
  ),

  // Lightning Strike — Hero Action: Spend X [energy] resources → deal X damage to the villain and each minion
  // engaged with you. This damage ignores tough status card if you have the Aerial trait. `ignoreTough` is a fixed
  // (non-conditional) field on the effect (packages/engine/src/spec.ts `dealDamage.ignoreTough`, errata RRG 1.8
  // p. 65), so the Aerial check is modeled as two branches dealing the same amount, not a runtime-conditional field.
  "06006.lightning-strike-action": heroAction(
    { cost: spendX("energy", "x") },
    ifThen(
      hasTrait(yourIdentity, TRAIT.AERIAL),
      [
        dealDamageIgnoringTough(varOf("x"), theVillain),
        dealDamageIgnoringTough(varOf("x"), each(query("minion", { engagedWith: "you" }))),
      ],
      [dealDamage(varOf("x"), theVillain), dealDamage(varOf("x"), each(query("minion", { engagedWith: "you" })))],
    ),
  ),

  // Asgard — You get +1 hand size.
  "06007.asgard-constant": constant(gets("handSize", 1, YOUR_IDENTITY)),

  // God of Thunder — Hero Resource: Exhaust God of Thunder → generate a [energy] resource.
  "06008.god-of-thunder-resource": heroResource({ energy: 1 }, { cost: { exhaustSelf: true } }),

  // Mjolnir — Restricted (data). Thor gets +1 ATK and gains the Aerial trait.
  "06009.mjolnir-constant": constant(gets("atk", 1, YOUR_IDENTITY), gainsTrait(TRAIT.AERIAL, YOUR_IDENTITY)),

  // Thor's Helmet — You get +5 hit points.
  "06010.thors-helmet-constant": constant(gets("hp", 5, YOUR_IDENTITY)),
});
