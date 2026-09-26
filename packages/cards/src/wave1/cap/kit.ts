import { trait } from "@mc/content";
import {
  andThen,
  action,
  addCounters,
  after,
  alterEgoAction,
  attack,
  attackAnEnemy,
  basicPowerCost,
  chooseCards,
  chooseTarget,
  chosen,
  constant,
  costModifier,
  countAmong,
  countersOn,
  dealDamage,
  defineAbilities,
  discard,
  discardFromHandCost,
  draw,
  each,
  encounterCards,
  exhaustThis,
  exhaustCardsCost,
  exists,
  firstThisRound,
  gainsKeyword,
  gainsTrait,
  gets,
  heal,
  heroAction,
  host,
  ifThen,
  instead,
  interrupt,
  modifyStat,
  modifyStatOf,
  moveCards,
  not,
  oncePerRound,
  paidWith,
  preventDamage,
  putIntoPlay,
  query,
  ready,
  reduceNextCardCost,
  removeThreatFromAScheme,
  resource,
  response,
  returnToHandCost,
  rule,
  self,
  selectCards,
  setRemainingHitPoints,
  setup,
  shuffleDeck,
  stun,
  varOf,
  when,
  you,
  yourIdentity,
  YOUR_IDENTITY,
  zone,
} from "../../dsl/index.js";
import { cardName } from "../names.js";

const AVENGER = trait("Avenger");
const SHIELD_NAME = cardName("03009");
/** Captain America's Shield, as an in-play cost pick. The engine limits candidates to cards the payer controls. */
const SHIELD = query("upgrade", { name: SHIELD_NAME });

/**
 * Captain America / Steve Rogers (03001a/b) and his hero kit (03002–03025). Reprints in this pack (Hawkeye
 * 03012, Make the Call 03016, The Power of Leadership 03018, Mockingbird 03020) are aliased from Core by
 * `../reprints.ts`, not scripted here — see `docs/phase7-wave1-scripting.md`.
 */
export const CAP_KIT = defineAbilities({
  // "I Can Do This All Day!" — Action: Discard 1 card from your hand → ready Captain America. (Limit once per round.)
  "03001a.i-can-do-this-all-day": action({ cost: discardFromHandCost(1, 1), limit: oncePerRound }, ready(yourIdentity)),

  // Living Legend — Reduce the cost of the first ally played each round by 1.
  // FAQ "Steve Rogers (#1B)" (RRG 1.8 p. 59): applies to the very first ally played each round, whatever form it's played in.
  "03001b.steve-rogers-constant": constant(
    costModifier({ delta: -1, appliesTo: query("ally"), while: firstThisRound("ally") }),
  ),

  // Setup: Search your deck and discard pile for the Captain America's Shield upgrade and add it to your hand.
  // Shuffle your deck. FAQ "Steve Rogers (#1B)" (RRG 1.8 p. 59): only the deck and discard are searched, and this
  // resolves after the opening draw and mulligan (Appendix II step 16; docs/phase7-wave1.md §3.15/§2.1), which is
  // what makes searching the discard meaningful. The multi-zone `zone()` this needs is the reviewed DSL follow-up.
  "03001b.setup": setup(
    moveCards(zone(["deck", "discard"], you, { filter: query("upgrade", { name: SHIELD_NAME }) }), "hand"),
    shuffleDeck(),
  ),

  // Agent 13 — Response: After Agent 13 enters play, remove 2 threat from a scheme.
  "03002.agent-13-response": response(after.entersPlay("self"), removeThreatFromAScheme(2)),

  // Fearless Determination — Hero Action: Captain America gets +1 THW until the end of the phase. Draw 1 card.
  "03003.fearless-determination-action": heroAction(modifyStat("thw", 1, yourIdentity, "endOfPhase"), draw(1)),

  // Heroic Strike — Hero Action (attack): Deal 6 damage to an enemy. If you paid for this card using a [physical]
  // resource, stun that enemy.
  "03004.heroic-strike-action": heroAction(
    { label: "attack" },
    attackAnEnemy(6),
    ifThen(paidWith("physical"), stun(chosen("enemy"))),
  ),

  // Shield Block — Interrupt (defense): When you would take any amount of damage, exhaust Captain America's Shield
  // → prevent all of that damage.
  // Only a Shield Steve controls can pay (RRG 1.8 "Cost", p. 14; ruling June 25, 2026 #1), which the engine enforces.
  "03005.shield-block-interrupt": interrupt(
    when.damage(YOUR_IDENTITY),
    { label: "defense", cost: exhaustCardsCost(SHIELD) },
    preventDamage(),
  ),

  // Shield Toss — Hero Action (attack): Discard X cards from your hand, then return Captain America's Shield from
  // play to your hand → deal 4 damage to X enemies. §3.12: "X enemies" is `chooseTarget.count` as a `ValueSpec`;
  // FAQ "Melee (#30)" (p. 59): different stages of one villain still count as one enemy. Only a Shield Steve
  // controls can be returned (ruling June 25, 2026 #1).
  // OPEN QUESTION: X = 0 is allowed (min 0). RRG p. 14's "at least one" rule covers "any number"/"up to", not X.
  "03006.shield-toss-action": heroAction(
    { label: "attack", cost: [discardFromHandCost(0, undefined, "x"), returnToHandCost(SHIELD)] },
    chooseTarget("enemy", query("enemy", { attackableBy: yourIdentity }), { count: varOf("x") }),
    attack(4, chosen("enemy")),
  ),

  // Steve's Apartment — Alter-Ego Action: Exhaust Steve's Apartment → draw 1 card and heal 1 damage from Steve Rogers.
  "03007.steves-apartment-action": alterEgoAction({ cost: exhaustThis }, draw(1), heal(1, yourIdentity)),

  // Captain America's Helmet — Interrupt: When Captain America would be defeated, set his hit point dial to 1
  // instead. Then, discard this card. Not a heal (the card doesn't say "heal"; docs/phase7-wave1.md §3.13).
  // `setRemainingHitPoints` always fully resolves (RRG 1.8 "'Then'", p. 44), so `andThen` here is the faithful
  // reading without changing observable behavior today.
  "03008.captain-americas-helmet-interrupt": interrupt(
    when.defeated("host"),
    instead(setRemainingHitPoints(1, host), andThen(discard(self))),
  ),

  // Captain America's Shield — Restricted (data). Captain America gets +1 DEF and gains retaliate 1.
  "03009.captain-americas-shield-constant": constant(
    gets("def", 1, YOUR_IDENTITY),
    gainsKeyword({ name: "retaliate", value: 1 }, YOUR_IDENTITY),
  ),

  // Super-Soldier Serum — Resource: Exhaust Super-Soldier Serum → generate a [physical] resource.
  "03010.super-soldier-serum-resource": resource({ physical: 1 }, { cost: exhaustThis }),

  // Falcon — Response: After Falcon enters play, look at the top 3 cards of the encounter deck. For each treachery
  // looked at this way, remove 1 threat from a scheme. `selectCards` only binds the cards (a non-destructive
  // "look"); `countAmong` counts matches among a bound slot wherever the cards are, not just in play (new: see
  // `ValueSpec countInRef` in `@mc/engine`).
  "03011.falcon-response": response(
    after.entersPlay("self"),
    selectCards("looked", encounterCards(["deck"], undefined, 3)),
    removeThreatFromAScheme(countAmong(chosen("looked"), query("treachery"))),
  ),

  // Squirrel Girl — Response: After Squirrel Girl enters play, deal 1 damage to each enemy.
  "03013.squirrel-girl-response": response(after.entersPlay("self"), dealDamage(1, each(query("enemy")))),

  // Wonder Man — [star] As an additional cost for Wonder Man to attack, you must discard 1 card from your hand.
  "03014.wonder-man-constant": constant(basicPowerCost("attack", discardFromHandCost(1, 1))),

  // Avengers Assemble! — Hero Action: Ready each Avenger character you control. Until the end of the phase, each
  // Avenger character in play gets +1 THW and +1 ATK. (Max 1 per round is card data, `playRestrictions.maxPerRound`.)
  "03015.avengers-assemble-action": heroAction(
    ready(each(query("character", { controller: "you", trait: AVENGER }))),
    modifyStatOf("thw", 1, { categories: ["character"], trait: AVENGER }, "endOfPhase"),
    modifyStatOf("atk", 1, { categories: ["character"], trait: AVENGER }, "endOfPhase"),
  ),

  // Strength in Numbers — Action: Exhaust any number of allies you control → draw 1 card for each ally exhausted
  // this way. "Any number" still needs at least one ally (RRG 1.8 "Cost", p. 14), so this can't be played with none.
  "03017.strength-in-numbers-action": action(
    { cost: exhaustCardsCost(query("ally"), { max: "any", bind: "n" }) },
    draw(varOf("n")),
  ),

  // Quinjet — Response: After your turn begins, place 1 time counter on Quinjet.
  "03019.quinjet-response": response(after.yourTurnBegins(), addCounters("time", 1)),
  // Quinjet — Action: Put an Avenger ally from your hand into play with printed cost equal to or less than the
  // number of time counters on Quinjet. Then, discard Quinjet. `maxPrintedCost` reads a live counter (new).
  // With no such ally in hand the action cannot be used, and "Then, discard Quinjet" never runs without the ally
  // (RRG 1.8 "Choose (Game Element)", p. 12; "'Then'", p. 44).
  "03019.quinjet-action": action(
    chooseCards(
      "ally",
      zone("hand", you, { filter: query("ally", { trait: AVENGER, maxPrintedCost: countersOn(self, "time") }) }),
      { min: 1, max: 1 },
    ),
    putIntoPlay(chosen("ally")),
    andThen(discard(self)),
  ),

  // Avengers Tower — If each of your allies has the Avenger trait, increase your ally limit by 1. Vacuously true
  // with no allies, per the literal reading of "each of your X" (no counterexample exists).
  "03024.avengers-tower-constant": constant(
    rule({
      kind: "allyLimit",
      amount: 1,
      while: not(exists(query("ally", { controller: "you", withoutTrait: AVENGER }))),
    }),
  ),
  // Avengers Tower — Action: Exhaust Avengers Tower → reduce the cost of the next Avenger ally played this phase by 1.
  "03024.avengers-tower-action": action(
    { cost: exhaustThis },
    reduceNextCardCost(you, 1, "phase", { categories: ["ally"], trait: AVENGER }),
  ),

  // Honorary Avenger — Attach to a friendly character (data). Attached character gets +1 hit point and gains the
  // Avenger trait. Play restriction ("Play only if your identity has the Avenger trait", "Max 1 per character")
  // is card data (`playRestrictions`).
  "03025.honorary-avenger-constant": constant(
    gets("hp", 1, { hostOfSelf: true }),
    gainsTrait(AVENGER, { hostOfSelf: true }),
  ),
});
