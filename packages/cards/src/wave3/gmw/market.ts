import type { EffectSpec, Predicate, TargetQuery, TargetRef } from "@mc/engine";
import {
  attack,
  cancelRevealedCard,
  cards,
  chooseCards,
  chooseOne,
  chooseOneBy,
  choosePlayer,
  chooseTarget,
  chosen,
  chosenPlayer,
  confuse,
  costIf,
  dealDamage,
  defineAbilities,
  discardFromHand,
  discardFromHandCost,
  discardTopOfDeckCost,
  draw,
  drawUpTo,
  each,
  encounterCards,
  exhaustThis,
  exists,
  FRIENDLY_CHARACTER,
  giveTough,
  handSizeOf,
  heal,
  heroAction,
  heroInterrupt,
  ifElse,
  ifThen,
  moveCards,
  option,
  partOf,
  perHero,
  placeOnTopOrBottom,
  placeThreat,
  preventDamage,
  query,
  ready,
  reduceNextCardCost,
  removeStatus,
  removeThreat,
  removeThreatFromAScheme,
  resourceTypesOf,
  selectCards,
  self,
  stun,
  theMainScheme,
  theVillain,
  topOfDeck,
  varOf,
  when,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";

/**
 * The Market (16150–16177), The Galaxy's Most Wanted's campaign card pool players spend campaign credits to buy
 * into their decks between missions (MC16 p. 5, "The Market"). `Unit Cost X.` on each card is campaign data
 * (`PlayerCard.unitCost`, `packages/content/src/schema/cards/player-cards.ts`), never an ability — none of these
 * refs script it.
 *
 * The five Campaign Challenge side schemes (16178a/b–16182a/b) are a separate module (next agent, per the task
 * brief); this file is The Market only.
 */

/** A predicate that reads a card wherever it is, including a discard pile (mirrors every other pack's own local
 * copy, e.g. `wave3/stld/star-lord-kit.ts`'s `refMatchesAnywhere` — not promoted to `dsl/values.ts` yet). */
const refMatchesAnywhere = (ref: TargetRef, q: TargetQuery): Predicate => ({
  kind: "refMatches",
  ref,
  query: q,
  anywhere: true,
});

/** "If you control the Milano" (Armor Plating, Heavy Cannon, Hyper Thrusters, Cargo Hold, Mounted Laser,
 * Targeting Screen): the Milano (16142, `gmw/ship-command.ts`) is unique, and `16142.milano-constant` makes the
 * first player its controller, so this reads simply as "the Milano is in play and you are its controller". */
const MILANO_CONTROLLED: Predicate = exists(query("support", { name: "Milano", controller: "you" }));

/** "Cancel that card's 'Boost' ability" (Close Call, 16158) / "…and all of its boost icons" — landed engine
 * primitives with no `dsl/effects.ts` wrapper yet (`packages/cards/src/wave1/bkw/local.ts`'s own copies, Target
 * Acquired/Attacrobatics). "…then discard it" needs no extra effect: RRG 1.8 "Boost" (p. 11)/`enemy-activation.ts`'s
 * `stepBoostCard` always discards a boost card once it finishes applying to an activation, cancelled or not. */
const cancelBoostAbility = (): EffectSpec => ({ kind: "cancelBoostAbility" });
const cancelBoostIcons = (): EffectSpec => ({ kind: "cancelBoostIcons" });

/** "Name a card type" (Brainstorm, 16150): the five categories a player deck card can print (mirrors Cosmo's own
 * list, `wave3/stld/star-lord-kit.ts` 17020). */
const NAMEABLE_CARD_TYPES = ["ally", "event", "upgrade", "support", "resource"] as const;

export const MARKET = defineAbilities({
  // Brainstorm (16150) — Hero Action (thwart): Name a card type, then look at the top card of your deck. If that
  // card is of the named type, remove 3 threat from the main scheme. Place that card on the top or bottom of your
  // deck, then draw 1 card. `selectCards` binds the top card without moving it ("look at"), so "place … on the
  // top" is simply leaving it — `moveCards(…, "deckTop")` is written anyway for symmetry with the "bottom" branch.
  "16150.brainstorm-action": heroAction(
    { label: "thwart" },
    selectCards("looked", topOfDeck(1)),
    chooseOne(
      ...NAMEABLE_CARD_TYPES.map((type) =>
        option(type, ifThen(refMatchesAnywhere(chosen("looked"), query(type)), removeThreat(3, theMainScheme))),
      ),
    ),
    chooseOne(
      option("Top of your deck", moveCards(cards(chosen("looked")), "deckTop")),
      option("Bottom of your deck", moveCards(cards(chosen("looked")), "deckBottom")),
    ),
    draw(1),
  ),
  "16150.brainstorm-constant": partOf("16150.brainstorm-action"),

  // By Any Means (16151) — Hero Action (attack): Place 2 threat on the main scheme. Deal 3 damage to the villain.
  // Draw 1 card.
  "16151.by-any-means-action": heroAction(
    { label: "attack" },
    placeThreat(2, theMainScheme),
    attack(3, theVillain),
    draw(1),
  ),
  "16151.by-any-means-constant": partOf("16151.by-any-means-action"),

  // Contingency Plan (16152) — Hero Action (attack): Discard the top 4 cards of your deck. For each different
  // resource type discarded this way, deal 1 damage to an enemy. Draw 1 card.
  "16152.contingency-plan-action": heroAction(
    { label: "attack" },
    moveCards(topOfDeck(4), "discard", "milled"),
    chooseTarget("enemy", query("enemy")),
    attack(resourceTypesOf(chosen("milled")), chosen("enemy")),
    draw(1),
  ),
  "16152.contingency-plan-constant": partOf("16152.contingency-plan-action"),

  // In Defiance (16153) — Hero Interrupt: When an identity would take any amount of damage from an attack, prevent
  // 2 of that damage. Draw 1 card.
  "16153.in-defiance-interrupt": heroInterrupt(
    when.damage(query("identity"), { fromAttack: true }),
    preventDamage(2),
    draw(1),
  ),
  "16153.in-defiance-constant": partOf("16153.in-defiance-interrupt"),

  // Calculate the Odds (16154) — Hero Action: Draw 1 card and choose a player. That player may draw 1 card, then
  // choose and discard 1 card from their hand.
  "16154.calculate-the-odds-action": heroAction(
    draw(1),
    choosePlayer("target"),
    chooseOneBy(
      chosenPlayer("target"),
      option(
        "Draw 1 card, then discard 1 card from your hand",
        draw(1, chosenPlayer("target")),
        discardFromHand(1, chosenPlayer("target")),
      ),
      option("Do not"),
    ),
  ),
  "16154.calculate-the-odds-constant": partOf("16154.calculate-the-odds-action"),

  // Creative Solution (16155) — Hero Action: Draw 1 card and remove a status card from any character. If the
  // status card type removed this way was:
  // - Tough - Deal 3 damage to an enemy.
  // - Stun - Remove 3 threat from a scheme.
  // - Confuse - Heal 3 damage from an identity.
  // Naming the status and removing it are one choice (RRG 1.8 "Choose (Option)", p. 12): each branch is offered
  // only while a character carries that status.
  "16155.creative-solution-action": heroAction(
    draw(1),
    chooseOne(
      option(
        "Remove a tough status card",
        { when: exists(query("character", { hasStatus: "tough" })) },
        chooseTarget("char", query("character", { hasStatus: "tough" })),
        removeStatus(chosen("char"), "tough"),
        chooseTarget("enemy", query("enemy")),
        dealDamage(3, chosen("enemy")),
      ),
      option(
        "Remove a stun status card",
        { when: exists(query("character", { hasStatus: "stunned" })) },
        chooseTarget("char", query("character", { hasStatus: "stunned" })),
        removeStatus(chosen("char"), "stunned"),
        removeThreatFromAScheme(3),
      ),
      option(
        "Remove a confuse status card",
        { when: exists(query("character", { hasStatus: "confused" })) },
        chooseTarget("char", query("character", { hasStatus: "confused" })),
        removeStatus(chosen("char"), "confused"),
        chooseTarget("identity", query("identity")),
        heal(3, chosen("identity")),
      ),
    ),
  ),
  "16155.creative-solution-constant": partOf("16155.creative-solution-action"),
  "16155.creative-solution-constant-2": partOf("16155.creative-solution-action"),
  "16155.creative-solution-constant-3": partOf("16155.creative-solution-action"),
  "16155.creative-solution-constant-4": partOf("16155.creative-solution-action"),

  // Grapple (16156) — Hero Action: Deal 1 damage to an enemy and stun it. Stun your hero. Draw 1 card.
  "16156.grapple-action": heroAction(
    chooseTarget("enemy", query("enemy")),
    dealDamage(1, chosen("enemy")),
    stun(chosen("enemy")),
    stun(yourIdentity),
    draw(1),
  ),
  "16156.grapple-constant": partOf("16156.grapple-action"),

  // Wing It (16157) — Hero Action: Deal 1 damage to an enemy and confuse it. Confuse your hero. Draw 1 card.
  "16157.wing-it-action": heroAction(
    chooseTarget("enemy", query("enemy")),
    dealDamage(1, chosen("enemy")),
    confuse(chosen("enemy")),
    confuse(yourIdentity),
    draw(1),
  ),
  "16157.wing-it-constant": partOf("16157.wing-it-action"),

  // Close Call (16158) — Hero Interrupt: When a boost card is turned faceup, cancel that card's "Boost" ability
  // and all of its boost icons ([boost]), then discard it. Draw 1 card.
  "16158.close-call-interrupt": heroInterrupt(
    { on: "boostCardTurnedFaceup" },
    cancelBoostAbility(),
    cancelBoostIcons(),
    draw(1),
  ),
  "16158.close-call-constant": partOf("16158.close-call-interrupt"),

  // Defy Danger (16159) — Hero Action (attack): Deal 5 damage to an enemy and discard the top card of the
  // encounter deck. Take 1 damage for each boost icon discarded this way.
  "16159.defy-danger-action": heroAction(
    { label: "attack" },
    chooseTarget("enemy", query("enemy")),
    attack(5, chosen("enemy")),
    moveCards(topOfDeck(1, you), "discard", "milled"),
    dealDamage(varOf("milled.boostIcons"), yourIdentity),
  ),
  "16159.defy-danger-constant": partOf("16159.defy-danger-action"),

  // In Harm's Way (16160) — Hero Action (thwart): Take 2 damage. Remove 5 threat from a scheme.
  "16160.in-harms-way-action": heroAction({ label: "thwart" }, dealDamage(2, yourIdentity), removeThreatFromAScheme(5)),
  "16160.in-harms-way-constant": partOf("16160.in-harms-way-action"),

  // Take the Fight to Them (16161) — Hero Action: Look at the top 2[per_hero] cards of the encounter deck. Discard
  // any number of those, then place the rest on the top and/or bottom of the encounter deck in any order. Draw 1
  // card. `selectCards` binds the looked-at cards without moving them (RRG 1.8 "Look, Looked-At", p. 27: they stay
  // part of the deck). "Any number" includes none, so `min: 0`; `max` is the most 2[per_hero] can ever be (4
  // players), and the engine caps it at the cards actually looked at. `placeOnTopOrBottom` is docs/phase7-wave3.md
  // §3.48: each kept card goes on the top or the bottom, then each pile is ordered.
  "16161.take-the-fight-to-them-action": heroAction(
    selectCards("looked", encounterCards(["deck"], undefined, perHero(2))),
    chooseCards("discarded", cards(chosen("looked")), { min: 0, max: 8 }),
    moveCards(cards(chosen("discarded")), "discard"),
    placeOnTopOrBottom(cards(chosen("looked"), { excludeSlots: ["discarded"] })),
    draw(1),
  ),
  "16161.take-the-fight-to-them-constant": partOf("16161.take-the-fight-to-them-action"),

  // Armor Plating (16162, upgrade, ARMOR/MILANO MOD) — Hero Interrupt: When an identity would take any amount of
  // damage, exhaust Armor Plating → prevent 1 of that damage (2 of that damage instead if you control the Milano).
  "16162.armor-plating-interrupt": heroInterrupt(
    when.damage(query("identity")),
    { cost: exhaustThis },
    preventDamage(ifElse(MILANO_CONTROLLED, 2, 1)),
  ),
  "16162.armor-plating-constant": partOf("16162.armor-plating-interrupt"),

  // Heavy Cannon (16163, upgrade, MILANO MOD/WEAPON) — Hero Action: Exhaust Heavy Cannon → deal 1 damage to each
  // enemy. If you control the Milano, deal 1 additional damage to the villain.
  "16163.heavy-cannon-action": heroAction(
    { cost: exhaustThis },
    dealDamage(1, each(query("enemy"))),
    ifThen(MILANO_CONTROLLED, dealDamage(1, theVillain)),
  ),
  "16163.heavy-cannon-constant": partOf("16163.heavy-cannon-action"),

  // Hyper Thrusters (16164, upgrade, MILANO MOD/TECH) — Hero Action: Exhaust Hyper Thrusters → remove 1 threat
  // from each scheme. If you control the Milano, remove 1 additional threat from the main scheme.
  "16164.hyper-thrusters-action": heroAction(
    { cost: exhaustThis },
    removeThreat(1, each(query("scheme"))),
    ifThen(MILANO_CONTROLLED, removeThreat(1, theMainScheme)),
  ),
  "16164.hyper-thrusters-constant": partOf("16164.hyper-thrusters-action"),

  // Reactor Core (16165, upgrade, MILANO MOD/TECH) — Hero Action: Exhaust Reactor Core and discard the top 2 cards
  // of your deck (the top card instead if you control the Milano) → reduce the resource cost of the next event you
  // play this turn by 1.
  //
  // `costIf` (docs/phase7-wave3.md §3.49): the board, not the player, picks how many cards the cost discards, read
  // when the cost is determined. "Instead" replaces the printed 2 cards, so a Milano controller whose deck and
  // discard pile together hold no card cannot use it at all, and one without the Milano needs 2.
  "16165.reactor-core-action": heroAction(
    { cost: [exhaustThis, costIf(MILANO_CONTROLLED, discardTopOfDeckCost(1), discardTopOfDeckCost(2))] },
    reduceNextCardCost(you, 1, "turn", query("event")),
  ),
  "16165.reactor-core-constant": partOf("16165.reactor-core-action"),

  // Ardent Resolve (16166) — Hero Action: Ready a friendly character. Draw 1 card.
  "16166.ardent-resolve-action": heroAction(chooseTarget("char", FRIENDLY_CHARACTER), ready(chosen("char")), draw(1)),
  "16166.ardent-resolve-constant": partOf("16166.ardent-resolve-action"),

  // Onrush (16167) — Hero Interrupt: When a card is revealed from the encounter deck, cancel the effects of that
  // card and discard it. Same shape as Core's own Black Widow (01075, `core/aspects/protection.ts`).
  "16167.onrush-interrupt": heroInterrupt(when.encounterCardRevealed(), cancelRevealedCard()),
  "16167.onrush-constant": partOf("16167.onrush-interrupt"),

  // Safeguard (16168) — Hero Action: Give up to 2 friendly characters each a tough status card. Draw 1 card.
  "16168.safeguard-action": heroAction(
    chooseTarget("chars", FRIENDLY_CHARACTER, { upTo: true, count: 2 }),
    giveTough(chosen("chars")),
    draw(1),
  ),
  "16168.safeguard-constant": partOf("16168.safeguard-action"),

  // Sure Gamble (16169) — Hero Action: Reduce the resource cost of the next card played this phase by 3.
  "16169.sure-gamble-action": heroAction(reduceNextCardCost(you, 3, "phase")),
  "16169.sure-gamble-constant": partOf("16169.sure-gamble-action"),

  // Cargo Hold (16170, upgrade, LOCATION/MILANO MOD) — Hero Action: Exhaust Cargo Hold → heal 1 damage from a
  // friendly character. If you control the Milano, heal 1 damage from your identity.
  "16170.cargo-hold-action": heroAction(
    { cost: exhaustThis },
    chooseTarget("char", FRIENDLY_CHARACTER),
    heal(1, chosen("char")),
    ifThen(MILANO_CONTROLLED, heal(1, yourIdentity)),
  ),
  "16170.cargo-hold-constant": partOf("16170.cargo-hold-action"),

  // Mounted Laser (16171, upgrade, MILANO MOD/WEAPON) — Hero Action: Exhaust Mounted Laser → deal 2 damage to an
  // enemy (3 damage instead if you control the Milano).
  "16171.mounted-laser-action": heroAction(
    { cost: exhaustThis },
    chooseTarget("enemy", query("enemy")),
    dealDamage(ifElse(MILANO_CONTROLLED, 3, 2), chosen("enemy")),
  ),
  "16171.mounted-laser-constant": partOf("16171.mounted-laser-action"),

  // Navigation Column (16172, upgrade, MILANO MOD/TECH) — Hero Action: Exhaust Navigation Column, choose and
  // discard 1 card from your hand (discard the top card of your deck instead if you control the Milano) → draw 1
  // card.
  //
  // `costIf` (docs/phase7-wave3.md §3.49), as Reactor Core's, one level up: the board picks the zone. With the
  // Milano the hand is never asked for a card and cannot pay instead; without it, the deck cannot.
  "16172.navigation-column-action": heroAction(
    { cost: [exhaustThis, costIf(MILANO_CONTROLLED, discardTopOfDeckCost(1), discardFromHandCost(1, 1))] },
    draw(1),
  ),
  "16172.navigation-column-constant": partOf("16172.navigation-column-action"),

  // Targeting Screen (16173, upgrade, MILANO MOD/TECH) — Hero Action: Exhaust Targeting Screen → remove 2 threat
  // from a scheme (3 threat instead if you control the Milano).
  "16173.targeting-screen-action": heroAction(
    { cost: exhaustThis },
    chooseTarget("scheme", query("scheme")),
    removeThreat(ifElse(MILANO_CONTROLLED, 3, 2), chosen("scheme")),
  ),
  "16173.targeting-screen-constant": partOf("16173.targeting-screen-action"),

  // Grand Strategy (16174) — Hero Action: Draw up to your maximum hand size. Remove this card from the game.
  "16174.grand-strategy-action": heroAction(drawUpTo(handSizeOf(you)), moveCards(cards(self), "removedFromGame")),
  "16174.grand-strategy-constant": partOf("16174.grand-strategy-action"),

  // Power Unleashed (16175) — Hero Action: Deal 5 damage to the villain and remove 5 threat from the main scheme.
  // Remove this card from the game.
  "16175.power-unleashed-action": heroAction(
    dealDamage(5, theVillain),
    removeThreat(5, theMainScheme),
    moveCards(cards(self), "removedFromGame"),
  ),
  "16175.power-unleashed-constant": partOf("16175.power-unleashed-action"),

  // Tried and True (16176) — Hero Action: Choose a player. That player may add up to 3 cards from their discard
  // pile to their hand. Remove this card from the game.
  "16176.tried-and-true-action": heroAction(
    choosePlayer("target"),
    chooseCards("returned", zone("discard", chosenPlayer("target")), {
      min: 0,
      max: 3,
      chooser: chosenPlayer("target"),
    }),
    moveCards(cards(chosen("returned")), "hand"),
    moveCards(cards(self), "removedFromGame"),
  ),
  "16176.tried-and-true-constant": partOf("16176.tried-and-true-action"),

  // Triple Threat (16177) — Hero Action: Ready up to 3 characters. Remove this card from the game.
  "16177.triple-threat-action": heroAction(
    chooseTarget("chars", query("character"), { upTo: true, count: 3 }),
    ready(chosen("chars")),
    moveCards(cards(self), "removedFromGame"),
  ),
  "16177.triple-threat-constant": partOf("16177.triple-threat-action"),
});
