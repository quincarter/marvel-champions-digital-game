import { trait } from "@mc/content";
import type { AbilityRegistry, RuleSpec, TargetQuery } from "@mc/engine";
import {
  action,
  addCounters,
  anyOfCards,
  after,
  alterEgoAction,
  andThen,
  atEndOfPhase,
  atEndOfRound,
  cancelRevealedCard,
  cards,
  choosePlayer,
  chooseCards,
  chooseOne,
  chooseTarget,
  chosen,
  chosenPlayer,
  constant,
  countOf,
  confuse,
  costModifier,
  dealDamage,
  defineAbilities,
  discard,
  discardEncounterCards,
  discardThis,
  draw,
  each,
  dealtEncounterCards,
  encounterCards,
  exhaustCardsCost,
  exhaustThis,
  eventTarget,
  exists,
  giveStatus,
  heroAction,
  heroResponse,
  ifThen,
  inHand,
  instead,
  interrupt,
  lookAt,
  lookAtAndRearrange,
  made,
  modifyBasicPower,
  moveCards,
  not,
  on,
  option,
  placeThreat,
  printedForm,
  putIntoPlay,
  query,
  ready,
  removeCounter,
  removeStatus,
  removeThreat,
  removeThreatFromAScheme,
  resource,
  response,
  revealEncounterCard,
  self,
  shuffleDeck,
  spend,
  spendResources,
  statOf,
  takeDamage,
  theVillain,
  valueAtLeast,
  valueEquals,
  varOf,
  zone,
  you,
  youHaveTrait,
  forcedResponse,
  modifyAttack,
  when,
} from "../../dsl/index.js";
import { BKW_PACK_CARDS } from "../../wave1/bkw/pack-cards.js";
import { THOR_PACK_CARDS } from "../../wave1/thor/pack-cards.js";
import { SPIDER_MAN_MORALES_EVENTS } from "../../wave5/sm/spider-man-morales/events.js";
import { SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS } from "../../wave5/sm/spider-man-morales/precon-player-cards.js";

const SHIELD = trait("S.H.I.E.L.D.");
const TECH = trait("TECH");
const PREPARATION = trait("PREPARATION");
/** A Preparation card you control, as it leaves play (Practiced Plan). */
const YOUR_PREPARATION_CARD: TargetQuery = { trait: PREPARATION, controller: "you" };
/** "A Tech card" in a player's deck (any player card type). */
const TECH_CARD: TargetQuery = { trait: TECH };
/** The cost of Jemma Simmons and Leo Fitz: 2 less while your identity has the S.H.I.E.L.D. trait. */
const SHIELD_COST_BREAK = constant(
  costModifier({
    delta: -2,
    appliesTo: query("support", { self: true }),
    while: youHaveTrait(SHIELD),
    activeIn: "hand",
  }),
);

/** "A S.H.I.E.L.D. support", whoever controls it. */
const SHIELD_SUPPORTS = query("support", { trait: SHIELD });
/** "S.H.I.E.L.D. cards you control" (Dum Dum Dugan, `sm` 27047's own query): any card type, identity included. */
const YOUR_SHIELD_CARDS: TargetQuery = { trait: SHIELD, controller: "you" };
/** A suit form upgrade (Assault / Stealth, 50035a/b), whoever controls it. */
const SUIT_FORMS = query("upgrade", printedForm("suit"));
/** True while no character you control lacks the S.H.I.E.L.D. trait: "if each of your characters has it". */
const EACH_OF_YOUR_CHARACTERS_IS_SHIELD = valueEquals(
  countOf(query("character", { controller: "you", withoutTrait: SHIELD })),
  0,
);

/** One unit of Super Spies: an all-purpose counter or a threat token, on a S.H.I.E.L.D. support or a suit form upgrade. */
const superSpiesPlacement = (n: number) => {
  const support = `support${n}`;
  const suit = `suit${n}`;
  return chooseOne(
    option(
      "Place an all-purpose counter on a S.H.I.E.L.D. support",
      chooseTarget(support, SHIELD_SUPPORTS),
      addCounters("allPurpose", 1, chosen(support)),
      { when: exists(SHIELD_SUPPORTS) },
    ),
    option(
      "Place a threat token on a S.H.I.E.L.D. support",
      chooseTarget(support, SHIELD_SUPPORTS),
      placeThreat(1, chosen(support)),
      { when: exists(SHIELD_SUPPORTS) },
    ),
    option(
      "Place an all-purpose counter on a suit form upgrade",
      chooseTarget(suit, SUIT_FORMS),
      addCounters("allPurpose", 1, chosen(suit)),
      { when: exists(SUIT_FORMS) },
    ),
    option(
      "Place a threat token on a suit form upgrade",
      chooseTarget(suit, SUIT_FORMS),
      placeThreat(1, chosen(suit)),
      {
        when: exists(SUIT_FORMS),
      },
    ),
  );
};

/** One "give a status card of your choice" on the card in `slot`. */
const giveStatusOfChoice = (slot: string) =>
  chooseOne(
    option("Stunned", giveStatus(chosen(slot), "stunned")),
    option("Confused", giveStatus(chosen(slot), "confused")),
    option("Tough", giveStatus(chosen(slot), "tough")),
  );

/**
 * Wave 9 scripting module `aos/aspect-basic` (docs/phase7-wave9.md section 8.4, 3.1, 3.6, 3.7, 3.10, 3.12, 3.35).
 * `card-groups.ts` maps this module to the ids below; keep the two in step.
 *
 * **50012.victoria-hand-response**: "ready a S.H.I.E.L.D. support" (any player's, the text does not say "you control").
 *
 * **50013.slingshot-action**: a printed Action that works from the hand (`inHand`): spend an [energy] resource, choose a
 * player, put her into play under that player's control; at the end of the phase, if she is still in play, return her
 * to her owner's hand.
 *
 * **50015.agents-of-shield-constant**: "If each of your characters has the S.H.I.E.L.D. trait, this card gains:
 * 'Interrupt: ...'" is the interrupt itself with a `while` on that condition ("this card gains" is an ability of the
 * card, spec section 3.3). "When you reveal" is the revealing player (`playerIs: "controller"`).
 *
 * **50016 / 50017 / 50018 / 50019 / 50020**: Uses supports; the Uses counters are data, the cost of each action is
 * exhausting and removing one counter. Removing the last one discards the card (RRG 1.8 "Uses", p. 46). The three
 * vehicles' "choose a player" choices are made by the card's controller; The Circe's ally is put into play by the
 * chosen player. The Pericles gives its two status cards to different kinds of card, so the ally-or-minion half is
 * guarded by a `while` (an action with two required targets is only checked for its first at initiation).
 *
 * **50021.dum-dum-dugan-interrupt**: the same card as `sm` 27047 (a reprint under a new code): "exhaust up to 3" is a
 * cost of 1 to 3 (RRG 1.8 "Cost", p. 14), so declining the interrupt is how to exhaust none.
 *
 * **50022**: "cannot defend" is a constant rule; the Forced Response asks whether to spend a [mental] resource and, if
 * the player does not (or cannot), deals her ATK to the player's hero and removes her from the game.
 *
 * **50023.melinda-may-response**: looks at the top card of the encounter deck and may discard it.
 *
 * **50024.super-spies-action**: three placements, each an all-purpose counter or a threat token, each on a S.H.I.E.L.D.
 * support or a suit form upgrade, any player's. Team-Up and "Max 1 per deck" are data.
 *
 * **50028.front-organization-interrupt**: "When an encounter card effect would discard a card you control, discard
 * Front Organization instead of discarding that card." A replacement (RRG 1.8 "Replacement Effect", p. 37) on the
 * leaving of a card you control for a discard pile, heard only when an encounter card's effect is what discards it
 * (`on.playerCardDiscardedFromPlay({ by: "encounterCard" })`, `cardLeavesPlay.by`): a treachery's When Revealed, a
 * Boost, a minion's or scheme's ability. Not offered for a player card's effect, a cost (RRG 1.8 "Cost", p. 13), a
 * defeat by damage from any source ("Defeat", p. 15: the game discards the defeated ally, not the card that dealt the
 * damage), an attachment going with its discarded host ("Leaves Play", p. 27) or a uses card emptied. There is no
 * arrow, so discarding Front Organization is the replacement's effect, not a cost; it is optional (a plain Interrupt),
 * and "you" is whoever controls it ("Play under any player's control" is data). Its own discard is not offered to it.
 * **In play only**: RRG 1.8 "Ownership and Control" (p. 31) has a player control the cards in their hand and deck too,
 * and an encounter card effect that discards those is not heard here (no "would be discarded" event exists for a hand
 * or a deck); an open question for the owner, reported with this piece.
 *
 * **Second half (50047 to 50058).** Reprints under a new code alias the source card's script (checked against the
 * source's data in the tests): Agent Coulson 50047 (`bkw` 08011), Quake 50048 (08012), Global Logistics 50049 (`sm`
 * 27043), Under Surveillance 50053 (Core 06031's "Increase the target threat value" constant; the attach half is data),
 * Sky-Destroyer 50057 (`sm` 27055).
 *
 * **50050.informant-interrupt**: "When a minion schemes" (the villain's scheme is not a minion's) with the activation
 * removing threat instead of placing it (`modifyAttack({ removesThreat })`). No label: unlike Psychic Manipulation's
 * "(thwart)", this is not a thwart.
 *
 * **50052.prism-dust-response**: "Hero Response (attack): After a minion enters play" (any minion, engaged with anyone,
 * revealed or put into play): confuse it and deal 2 damage to it. A Vulnerable minion is discarded by the status
 * before the damage lands (spec 3.1, engine rule), so it is not defeated.
 *
 * **50054.nick-fury-sr-forced-response**: the three modes are an option each; the end-of-round discard is part of the
 * same Forced Response (queued whichever mode was chosen) and only discards him if he is still in play.
 *
 * **50055 / 50056**: the cost reduction is a hand-active cost modifier read while the playing player's identity has
 * the S.H.I.E.L.D. trait. Jemma's resource ability generates [mental] for a Tech card only (`generatesFor`). Fitz's
 * Alter-Ego Action searches the deck (only), may find nothing, and shuffles.
 *
 * **50051.intelligence-response**: "After a player is dealt an encounter card, discard Intelligence → look at each
 * encounter card dealt to each player and the top card of the encounter deck. You may swap any number of those cards."
 * "A player" is any player (`on.aPlayerIsDealtAnEncounterCard()`, `encounterCardDealt`), in either form (a plain
 * Response). Each dealt card is a triggering condition, but the cards one step deals share one response window (RRG
 * 1.8 "Triggering Condition", p. 45), so in step three it is offered once, after every player's card and the hazard
 * cards are dealt and before any is revealed; a card ability's deal and a deck that ran out offer it too. Discarding
 * it is the cost, so each copy answers one deal; the card prints no limit ("Max 1 per player" is data). The look and
 * the swap are §3.12's `lookAtAndRearrange`: its controller alone sees the cards, every position keeps a card, and
 * the arrangement that swaps nothing is allowed. The surge keyword's card is not heard as a deal (reported with this
 * piece: RRG 1.8 "Surge", p. 42, words a surge as a deal).
 *
 * **50058.practiced-plan-response**: "After you discard a Preparation card you control": a card you control leaving
 * play to the discard pile (`cardLeavesPlay`, `to: discard`). Returns that card from the discard pile to your hand.
 *
 * Skipped (see `AOS_ASPECT_BASIC_SKIPPED`): 50014 Organizational Support.
 * 50025 Energy, 50026 Genius and 50027 Strength print no ability (Max 1 per deck is data).
 *
 * Cards (29):
 * - 50012 Victoria Hand (ally)
 * - 50013 Slingshot (ally)
 * - 50014 Organizational Support (resource) -- skipped
 * - 50015 Agents of S.H.I.E.L.D. (support)
 * - 50016 Command Team (support)
 * - 50017 The Circe (support)
 * - 50018 The Bellerophon (support)
 * - 50019 The Douglass (support)
 * - 50020 The Pericles (support)
 * - 50021 Dum Dum Dugan (ally)
 * - 50022 Grant Ward (ally)
 * - 50023 Melinda May (ally)
 * - 50024 Super Spies (event)
 * - 50025 Energy (resource)
 * - 50026 Genius (resource)
 * - 50027 Strength (resource)
 * - 50028 Front Organization (support)
 * - 50047 Agent Coulson (ally)
 * - 50048 Quake (ally)
 * - 50049 Global Logistics (event)
 * - 50050 Informant (upgrade)
 * - 50051 Intelligence (upgrade)
 * - 50052 Prism Dust (upgrade)
 * - 50053 Under Surveillance (upgrade)
 * - 50054 Nick Fury, Sr. (ally)
 * - 50055 Jemma Simmons (support)
 * - 50056 Leo Fitz (support)
 * - 50057 Sky-Destroyer (support)
 * - 50058 Practiced Plan (upgrade)
 */
export const AOS_ASPECT_BASIC: AbilityRegistry = defineAbilities({
  "50012.victoria-hand-response": response(
    on.entersPlay("self"),
    chooseTarget("support", SHIELD_SUPPORTS),
    ready(chosen("support")),
  ),

  "50013.slingshot-action": inHand(
    action(
      { cost: spend({ energy: 1 }) },
      choosePlayer("controller"),
      putIntoPlay(self, chosenPlayer("controller")),
      atEndOfPhase(ifThen(exists({ self: true }), moveCards(cards(self), "hand"))),
    ),
  ),

  "50015.agents-of-shield-constant": interrupt(
    { ...when.encounterCardRevealed(), playerIs: "controller" },
    { cost: exhaustThis, while: EACH_OF_YOUR_CHARACTERS_IS_SHIELD },
    cancelRevealedCard(),
    andThen(revealEncounterCard(you)),
  ),

  "50016.command-team-action": action(
    { cost: [exhaustThis, removeCounter("command")] },
    chooseTarget("ally", query("ally")),
    ready(chosen("ally")),
  ),

  "50017.the-circe-action": action(
    { cost: [exhaustThis, removeCounter("deploy")] },
    choosePlayer("player"),
    chooseCards("ally", zone("hand", chosenPlayer("player"), { filter: query("ally") }), {
      min: 1,
      max: 1,
      chooser: chosenPlayer("player"),
    }),
    putIntoPlay(chosen("ally"), chosenPlayer("player")),
  ),

  "50018.the-bellerophon-action": action(
    { cost: [exhaustThis, removeCounter("missile")] },
    choosePlayer("player"),
    removeStatus(theVillain, "tough"),
    removeStatus(each(query("minion", { engagedWithPlayer: chosenPlayer("player") })), "tough"),
    dealDamage(3, theVillain),
    dealDamage(3, each(query("minion", { engagedWithPlayer: chosenPlayer("player") }))),
  ),

  "50019.the-douglass-action": action(
    { cost: [exhaustThis, removeCounter("operation")] },
    removeThreat(2, each(query("scheme")), { ignoreCrisis: true }),
  ),

  "50020.the-pericles-action": action(
    {
      cost: [exhaustThis, removeCounter("supply")],
      while: valueAtLeast(countOf(query(["ally", "minion"])), 1),
    },
    chooseTarget("first", query(["hero", "villain"])),
    giveStatusOfChoice("first"),
    chooseTarget("second", query(["ally", "minion"])),
    giveStatusOfChoice("second"),
  ),

  "50021.dum-dum-dugan-interrupt": interrupt(
    on.basicPowerUsing("self"),
    { cost: exhaustCardsCost(YOUR_SHIELD_CARDS, { min: 1, max: 3, bind: "n" }) },
    modifyBasicPower(varOf("n")),
  ),

  "50022.grant-ward-constant": constant({
    rules: [{ kind: "cannotDefend", target: { self: true } }] satisfies readonly RuleSpec[],
  }),
  "50022.grant-ward-forced-response": forcedResponse(
    on.youRevealEncounterCard(query("treachery")),
    chooseOne(
      option("Spend a [mental] resource", spendResources({ mental: 1 }, "paid")),
      option("Do not spend a resource"),
    ),
    ifThen(not(made("paid")), [takeDamage(statOf(self, "atk")), moveCards(cards(self), "removedFromGame")]),
  ),

  "50023.melinda-may-response": response(
    after.basicPowerUsed("self"),
    lookAt(encounterCards(["deck"], undefined, 1), { bind: "top" }),
    ifThen(
      valueAtLeast(varOf("top.count"), 1),
      chooseOne(option("Discard that card", discardEncounterCards(1)), option("Leave it on top")),
    ),
  ),

  "50024.super-spies-action": heroAction(superSpiesPlacement(1), superSpiesPlacement(2), superSpiesPlacement(3)),

  // Reprints under a new code (the printed text and stats are the same as the source card's; checked in the tests):
  // Agent Coulson (`bkw` 08011), Quake (08012), Global Logistics (`sm` 27043), Sky-Destroyer (27055), Under
  // Surveillance (Core `thor` pack 06031; its "Attach to the main scheme. Max 1 per scheme" half is data).
  "50047.agent-coulson-response": BKW_PACK_CARDS["08011.agent-coulson-response"]!,
  "50048.quake-response": BKW_PACK_CARDS["08012.quake-response"]!,
  "50049.global-logistics-action": SPIDER_MAN_MORALES_EVENTS["27043.global-logistics-action"]!,
  "50053.under-surveillance-constant": THOR_PACK_CARDS["06031.under-surveillance-constant-2"]!,
  "50057.sky-destroyer-response": SPIDER_MAN_MORALES_PRECON_PLAYER_CARDS["27055.sky-destroyer-response"]!,

  "50050.informant-interrupt": interrupt(
    on.enemySchemes(query("minion")),
    { cost: discardThis },
    modifyAttack({ removesThreat: true }),
  ),

  "50052.prism-dust-response": heroResponse(
    on.entersPlay(query("minion")),
    { label: "attack", cost: discardThis },
    confuse(eventTarget),
    dealDamage(2, eventTarget),
  ),

  "50054.nick-fury-sr-forced-response": forcedResponse(
    on.entersPlay("self"),
    chooseOne(
      option("Remove 3 threat from a scheme", removeThreatFromAScheme(3)),
      option("Draw 2 cards", draw(2)),
      option(
        "Give a S.H.I.E.L.D. character a tough status card",
        chooseTarget("character", query("character", { trait: SHIELD })),
        giveStatus(chosen("character"), "tough"),
        { when: exists(query("character", { trait: SHIELD })) },
      ),
    ),
    atEndOfRound(ifThen(exists({ self: true }), discard(self))),
  ),

  "50055.jemma-simmons-constant": SHIELD_COST_BREAK,
  "50055.jemma-simmons-resource": resource(
    { mental: 1 },
    { cost: exhaustThis, generatesFor: query(["ally", "event", "support", "upgrade"], { trait: TECH }) },
  ),

  "50056.leo-fitz-constant": SHIELD_COST_BREAK,
  "50056.leo-fitz-action": alterEgoAction(
    { cost: exhaustThis },
    chooseCards("found", zone("deck", you, { filter: TECH_CARD }), { min: 0, max: 1 }),
    moveCards(cards(chosen("found")), "hand"),
    shuffleDeck(),
  ),

  "50028.front-organization-interrupt": interrupt(
    on.playerCardDiscardedFromPlay({ who: { controller: "you", self: false }, by: "encounterCard" }),
    { would: true },
    instead(discard(self)),
  ),

  "50051.intelligence-response": response(
    on.aPlayerIsDealtAnEncounterCard(),
    { cost: discardThis },
    lookAtAndRearrange(anyOfCards(dealtEncounterCards(), encounterCards(["deck"], undefined, 1))),
  ),

  "50058.practiced-plan-response": response(
    { on: "cardLeavesPlay", targetIs: YOUR_PREPARATION_CARD, eventIs: { to: "discard" } },
    { cost: discardThis },
    moveCards(cards(eventTarget), "hand"),
  ),
});

/** Refs of this module's cards deliberately left unscripted, each with its written reason. */
export const AOS_ASPECT_BASIC_SKIPPED: Readonly<Record<string, string>> = {
  "50014.organizational-support-interrupt":
    'Interrupt: "When you spend this card, exhaust up to 3 allies and/or supports you control that share a Trait with your ' +
    'identity -> generate the printed resources on each card exhausted this way." The engine has no effect that adds ' +
    "generated resources to a payment in progress (spec.ts has no generate-resources EffectSpec; the only resource " +
    "generation is a `resource(...)` ability used as a cost payment, and `resourcesSpent` interrupts cannot add to the " +
    "amount being paid), and `resource(printedResourcesOf(...))` would change the timing (a Resource: ability usable by " +
    "any payment) rather than express this one. Needs an engine primitive (a `generateResources` effect or a bonus to " +
    "the payment in progress) from game-rules-architect.",
};
