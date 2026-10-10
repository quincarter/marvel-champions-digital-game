import { trait } from "@mc/content";
import type { AbilityRegistry } from "@mc/engine";
import {
  after,
  boostIconsOn,
  chooseCards,
  chooseTarget,
  chosen,
  choosePlayer,
  chosenPlayer,
  defineAbilities,
  encounterCards,
  exhaustThis,
  heroAction,
  modifyStatOf,
  putIntoPlay,
  query,
  ready,
  repeatTimes,
  response,
  sum,
  you,
} from "../../dsl/index.js";
import { STAR_LORD_KIT } from "../../wave3/stld/star-lord-kit.js";
import { IRONHEART_ALLIES } from "../../wave5/ironheart/allies.js";

const AERIAL = trait("AERIAL");

/**
 * Wave 9 scripting module `falcon/aspect-basic` (docs/phase7-wave9.md section 8.4), first half: 53014 to 53021. The
 * second half (53022 to 53028, 53034 to 53037) is not started and sits in the skipped map. `card-groups.ts` maps this
 * module to the ids below; keep the two in step.
 *
 * **53014.adam-warlock-response / 53016.cloud-9-action**: reprints of Adam Warlock 17011 (`stld`) and Cloud 9 29014
 * (`ironheart`), same cost, stats, traits and text; aliased. 17011's other four refs are an ingestion artifact of the
 * bulleted lines (`partOf` the response); 53014's data lists only the response.
 *
 * **53015.aero-action**: Cloud 9's text with ATK. Exhausting Aero is the cost (before the arrow); the player is chosen
 * on resolution, and every Aerial character that player controls (allies, and an identity with the trait) gets +1 ATK
 * until the end of the phase.
 *
 * **53017.hugin-and-munin-response**: the search of the top 10 cards of the encounter deck is compulsory when a minion
 * is there (owner ruling: a search with no "may"); the minion enters play engaged with you, then one character you
 * control is readied for each icon (star and boost) printed in its boost area (section 3.43: `boostIcons + starIcons`;
 * amplify adds nothing). The search and the entry are "before the arrow", so they are costs by the rules, but the cost
 * vocabulary has no search of the encounter deck (`chooseCard` reads the payer's hand, discard and decks only), so they
 * are the first effects: with no minion in the top 10 the response is still offered and does nothing, instead of not
 * being offered. Each readied character is its own choice (RRG "'For Each'", p. 20), so one may be named twice.
 *
 * **Skipped** (see the map): 53018 (task 31), 53019 (task 34), 53020 (its gained response has no ref in the data),
 * 53021 (task 32), and the second half.
 *
 * Cards (19):
 * - 53014 Adam Warlock (ally)
 * - 53015 Aero (ally)
 * - 53016 Cloud 9 (ally)
 * - 53017 Hugin & Munin (ally)
 * - 53018 Spectrum (ally)
 * - 53019 Strength in Diversity (event)
 * - 53020 Flight Squadron (support)
 * - 53021 Resource Reserve (support)
 * - 53022 The Triskelion (support)
 * - 53023 Captain America (upgrade)
 * - 53024 Wingman (upgrade)
 * - 53025 Energy (resource)
 * - 53026 Genius (resource)
 * - 53027 Strength (resource)
 * - 53028 The Power of Flight (resource)
 * - 53034 Captain America's Shield (upgrade)
 * - 53035 Winter Soldier (ally)
 * - 53036 Misty Knight (ally)
 * - 53037 Ops Room (support)
 */
export const FALCON_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "53014.adam-warlock-response": STAR_LORD_KIT["17011.adam-warlock-response"]!,

  "53015.aero-action": heroAction(
    { cost: exhaustThis },
    choosePlayer(),
    modifyStatOf("atk", 1, query("character", { trait: AERIAL, controlledBy: chosenPlayer() }), "endOfPhase"),
  ),

  "53016.cloud-9-action": IRONHEART_ALLIES["29014.cloud-9-action"]!,

  "53017.hugin-and-munin-response": response(
    after.entersPlay("self"),
    chooseCards("found", encounterCards(["deck"], query("minion"), 10), { min: 1, max: 1 }),
    putIntoPlay(chosen("found")),
    repeatTimes(
      sum(boostIconsOn(chosen("found")), { kind: "starIcons", cards: chosen("found") }),
      chooseTarget("character", query("character", { controlledBy: you })),
      ready(chosen("character")),
    ),
  ),
});

const SECOND_HALF = "second half of the module, not started";

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const FALCON_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "53018.spectrum-response":
    "needs engine task 31 (section 3.46 (b)): a slot `paid.cards` on a play's announcement, the cards that paid for the play; nothing existing names the cards that paid (only `paid.*` counts and `paidWithCard` for a named card)",
  "53019.strength-in-diversity-action":
    "needs engine task 34 (section 3.48): `ValueSpec distinctTraits { of }`, the number of different traits among friendly characters in play (only `distinctAspects` and `distinctCardTypes` exist); the rest is `repeatTimes(times, chooseOne(...))`",
  "53020.flight-squadron-constant":
    "the data lists one ref (the constant) for a card with two abilities: the ally limit +1 (`allyLimit` with `while`) and the gained response 'After you play an Aerial card, exhaust this card -> ready an ally you control' (a response with `while`); the response needs a second ref, e.g. `53020.flight-squadron-response`, that packages/content/src/data/falcon/cards.ts does not list, and scripting only the constant would silently drop it",
  "53021.resource-reserve-constant":
    "needs engine task 32 (section 3.46 (c)): `RuleSpec spendableFromTucked`, a tucked resource card as a payment source for every player (nothing in payable.ts names a tucked card)",
  "53021.resource-reserve-action":
    "needs engine task 32 (section 3.46 (c)); the tuck is only meaningful with the constant that makes the tucked card spendable, so both refs of the card wait together",
  "53022.the-triskelion-constant": SECOND_HALF,
  "53023.captain-america-constant": SECOND_HALF,
  "53023.captain-america-action": SECOND_HALF,
  "53024.wingman-interrupt": SECOND_HALF,
  "53028.the-power-of-flight-constant": SECOND_HALF,
  "53034.captain-americas-shield-constant": SECOND_HALF,
  "53035.winter-soldier-response": SECOND_HALF,
  "53036.misty-knight-interrupt": SECOND_HALF,
  "53037.ops-room-interrupt": SECOND_HALF,
};
