import { trait } from "@mc/content";
import {
  action,
  after,
  alterEgoAction,
  anEnemy,
  anyOf,
  aScheme,
  attackAnEnemy,
  boostIconsOn,
  cards,
  cancelRevealedCard,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  coveredByEngineRule,
  confuse,
  constant,
  dealDamage,
  defineAbilities,
  discard,
  draw,
  encounterCards,
  exhaustThis,
  exists,
  forcedResponse,
  gainsTrait,
  gets,
  giveStatus,
  giveTough,
  hasStatus,
  heal,
  heroAction,
  heroInterrupt,
  heroResource,
  ifThen,
  moveCards,
  option,
  partOf,
  payPrintedCostOf,
  query,
  ready,
  removeStatus,
  removeThreat,
  scaled,
  self,
  selectCards,
  shuffleDeck,
  stun,
  theVillain,
  thwart,
  topOfDeck,
  TRAIT,
  varAtLeast,
  when,
  you,
  yourIdentity,
  zone,
} from "../../dsl/index.js";
import { invocationTop, invocationTopCost, resolveSpecialsOf } from "./local.js";

const SPELL = trait("Spell");

/**
 * The number of times "energy"/"physical"/"mental" appear among the printed resource icons of the cards
 * `moveCards(..., bind)` discarded this way (`<bind>.<type>`, engine `apply-effect.ts`'s `moveCards` case), plus
 * `<bind>.wild` (a wild icon counts as every type) — the same shape Core's Hulk (01050) uses for its identically
 * worded "discard the top card of your deck. If that card's printed resource has: …" branches
 * (`packages/cards/src/core/aspects/aggression.ts`).
 */
const milled = (bind: string, type: "physical" | "energy" | "mental") => anyOf(varAtLeast(`${bind}.${type}`), varAtLeast(`${bind}.wild`));

/**
 * Doctor Strange / Stephen Strange (09001a/b) and his signature hero kit (09002–09011, printed
 * `aspect: "hero:09001a"`), plus his five Invocation cards (09032–09036, `separateDeck: "Invocation"`,
 * docs/phase7-wave1.md §1.9/§3.5). No Core reprints in this range — `../reprints.ts` supplies none for `drs`'s
 * signature set (docs/phase7-wave1.md §1.12 confirms Iron Man (09039, an ally here) stays distinct from Core's
 * identity of the same name; that card lives in `pack-cards.ts`).
 *
 * Vapors of Valtorr (09035): "Special: Choose a status card in play. Replace that status card with a different
 * status card. Place this card in the Invocation deck discard pile." Was a skip pending an OR over status types;
 * landed with the wave B primitives batch as `TargetQuery.hasAnyStatus` (docs/phase7-wave1-scripting.md §6) —
 * "a status card in play" is read as "a character with any status" (RRG 1.8 "Status Cards", p. 42), since a status
 * is an attachment to a character rather than an independently targetable card. Which status it currently has,
 * and therefore which two are genuinely "different", is read with `hasStatus` per option: the outer choice picks
 * the character's current status (exactly one condition is ever true in the normal case of a single status, so it
 * resolves without asking), removes it, and a nested choice offers the other two as the replacement — the
 * printed text names no specific replacement, so RRG "Choose" defaults to the ability's controller deciding.
 */
export const DRS_KIT = defineAbilities({
  // Spell Mastery — Action: Exhaust Doctor Strange and pay the cost of the top card of the Invocation deck →
  // resolve the "Special" ability on that card. Printed "Action:" (not "Hero Action:"), matching the synthetic
  // "Sorcerer" fixture `packages/engine/src/separate-deck.test.ts` uses to prove this exact shape — being printed
  // on the hero face already restricts it to hero form, the same way `09001b.natural-talent` needs no `form` either.
  "09001a.spell-mastery": action(
    { cost: [exhaustThis, payPrintedCostOf("invocation", invocationTopCost())] },
    resolveSpecialsOf(chosen("invocation")),
  ),

  // Stephen Strange begins the game with an Invocation deck. (See insert.) Reminder text: the deck is built by
  // setup itself from `HeroIdentityCard.separateDecks` (docs/phase7-wave1.md §1.9/§3.5, engine Appendix II step 6),
  // not by any card ability — this ref carries no effects of its own.
  "09001b.stephen-strange-constant": coveredByEngineRule(),

  // Natural Talent — Action: Discard the top card of the Invocation deck. (Limit once per phase.)
  "09001b.natural-talent": action({ limit: { count: 1, period: "phase" } }, moveCards(invocationTop(1), "separateDiscard")),

  // Wong — Action: Exhaust Wong → choose to either heal 1 damage from your identity or discard the top card of the
  // Invocation deck.
  "09002.wong-action": action(
    { cost: exhaustThis },
    chooseOne(
      option("Heal 1 damage from your identity", heal(1, yourIdentity)),
      option("Discard the top card of the Invocation deck", moveCards(invocationTop(1), "separateDiscard")),
    ),
  ),

  // Astral Projection — Hero Action (thwart): Choose a scheme → remove 3 threat from that scheme and look at the
  // top card of the encounter deck. For each boost icon on that card, remove 1 additional threat from the chosen
  // scheme. One `thwart` for the combined total (RRG "(Thwart)" is the whole ability, not two separate thwarts):
  // `boostIconsOn` reads the looked-at card's printed boost icons wherever it is (`packages/engine/src/select.ts`
  // `case "boostIcons"`), so it doesn't need `moveCards`/`countAmong` the way Falcon's "for each treachery" did.
  "09003.astral-projection-action": heroAction(
    { label: "thwart" },
    aScheme("scheme"),
    selectCards("looked", encounterCards(["deck"], undefined, 1)),
    thwart(scaled(boostIconsOn(chosen("looked")), { plus: 3 }), chosen("scheme")),
  ),

  // Magic Blast — Hero Action (attack): Deal 5 damage to an enemy and discard the top card of your deck. If that
  // card's printed resource has: [physical] Stun that enemy. [energy] Deal 2 damage to that enemy. [mental]
  // Confuse that enemy. [wild] All of the above. The four bracketed lines are ingested as separate refs (Core's
  // Hulk, 01050, same shape); their behavior lives entirely in the action below.
  "09004.magic-blast-action": heroAction(
    { label: "attack" },
    attackAnEnemy(5),
    moveCards(topOfDeck(1), "discard", "blast"),
    ifThen(milled("blast", "physical"), stun(chosen("enemy"))),
    ifThen(milled("blast", "energy"), dealDamage(2, chosen("enemy"))),
    ifThen(milled("blast", "mental"), confuse(chosen("enemy"))),
  ),
  "09004.magic-blast-constant": partOf("09004.magic-blast-action"),
  "09004.magic-blast-constant-2": partOf("09004.magic-blast-action"),
  "09004.magic-blast-constant-3": partOf("09004.magic-blast-action"),
  "09004.magic-blast-constant-4": partOf("09004.magic-blast-action"),

  // Master of the Mystic Arts — Hero Action: Pay the printed cost of the top card of the Invocation deck → resolve
  // its "Special" ability. Then, place it back on top of the Invocation deck faceup.
  "09005.master-of-the-mystic-arts-action": heroAction(
    { cost: payPrintedCostOf("invocation", invocationTopCost()) },
    resolveSpecialsOf(chosen("invocation")),
    moveCards(cards(chosen("invocation")), "separateDeckTop"),
  ),

  // Mystical Studies — Alter-Ego Action: Search your deck and discard pile for a Doctor Strange card and add it to
  // your hand. Shuffle your deck. `identitySetOf` matches any card of the set (RRG 1.8 "Identity-Specific Card",
  // p. 23); several could match, so this is a choice (Black Panther's Foresight/Shuri, `core/heroes/black-panther.ts`,
  // is the model for "search … and add … to hand" generally).
  "09006.mystical-studies-action": alterEgoAction(
    chooseCards("found", zone(["deck", "discard"], you, { filter: { identitySetOf: you } }), { min: 1, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  // Protective Ward — Hero Interrupt: When a treachery is revealed from the encounter deck, cancel all of its
  // effects and discard it.
  "09007.protective-ward-interrupt": heroInterrupt(when.encounterCardRevealed(query("treachery")), cancelRevealedCard()),

  // Sanctum Sanctorum — Alter-Ego Action: Exhaust Sanctum Sanctorum → shuffle a Spell card from your discard pile
  // into your deck and draw 1 card.
  "09008.sanctum-sanctorum-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("spell", zone("discard", you, { filter: { trait: SPELL } }), { min: 1, max: 1 }),
    moveCards(cards(chosen("spell")), "deckShuffle"),
    draw(1),
  ),

  // Cloak of Levitation — You gain the Aerial trait. Hero Action: Exhaust Cloak of Levitation → ready Doctor
  // Strange. No printed `attachesTo` (data), so it auto-attaches to the identity; `hostOfSelf` reads that host
  // generically (Honorary Avenger, `cap` pack, is the model).
  "09009.cloak-of-levitation-constant": constant(gainsTrait(TRAIT.AERIAL, { hostOfSelf: true })),
  "09009.cloak-of-levitation-action": action({ cost: exhaustThis }, ready(yourIdentity)),

  // Magical Enhancements — Play under any player's control (data). Your hero gets +1 THW, +1 ATK, and +1 DEF.
  // Forced Interrupt: When the round ends, discard Magical Enhancements. There is no standalone "the round ends"
  // trigger event (only `atEndOfRound`, a *delayed effect* scheduled from within an already-resolving ability —
  // docs/phase7-wave1.md §3.16 lists `atEndOfRound` as the confirmed primitive for this exact card). Since the
  // card can only ever reach one "round ends" before it discards itself, scheduling `atEndOfRound` the moment it
  // enters play is behaviorally exact, not an approximation: entering play and "the round ends" are the only two
  // events this card's whole lifetime spans.
  "09010.magical-enhancements-constant": constant(
    gets("thw", 1, { hostOfSelf: true }),
    gets("atk", 1, { hostOfSelf: true }),
    gets("def", 1, { hostOfSelf: true }),
  ),
  "09010.magical-enhancements-forced-interrupt": forcedResponse(
    after.entersPlay("self"),
    { kind: "atEndOfRound", effects: [ifThen(exists({ self: true }), discard(self))] },
  ),

  // The Eye of Agamotto — Hero Resource: Exhaust The Eye of Agamotto → generate a [wild] resource.
  "09011.the-eye-of-agamotto-resource": heroResource({ wild: 1 }, { cost: exhaustThis }),

  // Crimson Bands of Cyttorak (Invocation) — Special: Stun an enemy and deal 7 damage to it. Place this card in
  // the Invocation deck discard pile.
  "09032.crimson-bands-of-cyttorak-special": {
    trigger: { kind: "special" },
    effects: [anEnemy("enemy"), stun(chosen("enemy")), dealDamage(7, chosen("enemy")), moveCards(cards(self), "separateDiscard")],
  },

  // Images of Ikonn (Invocation) — Special: Confuse the villain and remove 4 threat from a scheme. Place this card
  // in the Invocation deck discard pile.
  "09033.images-of-ikonn-special": {
    trigger: { kind: "special" },
    effects: [confuse(theVillain), aScheme("scheme"), removeThreat(4, chosen("scheme")), moveCards(cards(self), "separateDiscard")],
  },

  // Seven Rings of Raggadorr (Invocation) — Special: Give up to 3 characters each a tough status card. Place this
  // card in the Invocation deck discard pile. "Up to 3" is `chooseTarget`'s `optional` + `count` (docs/
  // phase7-wave1.md §3.12); `giveTough` applies to every character bound to the slot (the same "a slot can resolve
  // to several cards" reading `ready(each(...))`/`dealDamage(1, each(...))` already rely on).
  "09034.seven-rings-of-raggadorr-special": {
    trigger: { kind: "special" },
    effects: [chooseTarget("characters", query("character"), { optional: true, count: 3 }), giveTough(chosen("characters")), moveCards(cards(self), "separateDiscard")],
  },

  // Vapors of Valtorr (Invocation) — Special: Choose a status card in play. Replace that status card with a
  // different status card. Place this card in the Invocation deck discard pile. See the module doc comment above
  // for the reading: choose a character with any status, remove whichever one it has (the outer `chooseOne`
  // resolves without asking once only one `hasStatus` condition is true), then choose one of the other two to give.
  "09035.vapors-of-valtorr-special": {
    trigger: { kind: "special" },
    effects: [
      chooseTarget("target", query("character", { hasAnyStatus: true })),
      chooseOne(
        option(
          "It has the stunned status",
          { when: hasStatus(chosen("target"), "stunned") },
          removeStatus(chosen("target"), "stunned"),
          chooseOne(option("Give it the confused status", giveStatus(chosen("target"), "confused")), option("Give it the tough status", giveStatus(chosen("target"), "tough"))),
        ),
        option(
          "It has the confused status",
          { when: hasStatus(chosen("target"), "confused") },
          removeStatus(chosen("target"), "confused"),
          chooseOne(option("Give it the stunned status", giveStatus(chosen("target"), "stunned")), option("Give it the tough status", giveStatus(chosen("target"), "tough"))),
        ),
        option(
          "It has the tough status",
          { when: hasStatus(chosen("target"), "tough") },
          removeStatus(chosen("target"), "tough"),
          chooseOne(option("Give it the stunned status", giveStatus(chosen("target"), "stunned")), option("Give it the confused status", giveStatus(chosen("target"), "confused"))),
        ),
      ),
      moveCards(cards(self), "separateDiscard"),
    ],
  },

  // Winds of Watoomb (Invocation) — Special: Draw 3 cards. Place this card in the Invocation deck discard pile.
  "09036.winds-of-watoomb-special": {
    trigger: { kind: "special" },
    effects: [draw(3), moveCards(cards(self), "separateDiscard")],
  },
});
