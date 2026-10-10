import { trait } from "@mc/content";
import type { AbilityRegistry, RuleSpec, TargetQuery } from "@mc/engine";
import {
  action,
  addCounters,
  after,
  andThen,
  atEndOfPhase,
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
  dealDamage,
  defineAbilities,
  discardEncounterCards,
  each,
  encounterCards,
  exhaustCardsCost,
  exhaustThis,
  exists,
  giveStatus,
  heroAction,
  ifThen,
  inHand,
  interrupt,
  lookAt,
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
  response,
  revealEncounterCard,
  self,
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
  forcedResponse,
  when,
} from "../../dsl/index.js";

const SHIELD = trait("S.H.I.E.L.D.");

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
 * Wave 9 scripting module `aos/aspect-basic`, first half (docs/phase7-wave9.md section 8.4, 3.6, 3.7, 3.10, 3.35).
 * `card-groups.ts` maps this module to the ids below; keep the two in step. The second half (50047 to 50058) is not
 * started and is listed in `AOS_ASPECT_BASIC_SKIPPED`.
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
 * Skipped (see `AOS_ASPECT_BASIC_SKIPPED`): 50014 Organizational Support, 50028 Front Organization, and the second half.
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
 * - 50028 Front Organization (support) -- skipped
 * - 50047 Agent Coulson (ally) -- second half
 * - 50048 Quake (ally) -- second half
 * - 50049 Global Logistics (event) -- second half
 * - 50050 Informant (upgrade) -- second half
 * - 50051 Intelligence (upgrade) -- second half
 * - 50052 Prism Dust (upgrade) -- second half
 * - 50053 Under Surveillance (upgrade) -- second half
 * - 50054 Nick Fury, Sr. (ally) -- second half
 * - 50055 Jemma Simmons (support) -- second half
 * - 50056 Leo Fitz (support) -- second half
 * - 50057 Sky-Destroyer (support) -- second half
 * - 50058 Practiced Plan (upgrade) -- second half
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
  "50028.front-organization-interrupt":
    'Interrupt: "When an encounter card effect would discard a card you control, discard Front Organization instead." ' +
    "The spec names `discardRedirected`, but that event is only the post-event of Collector's area redirect " +
    "(engine/trigger-events.ts). The usable hook is a `cardLeavesPlay` interrupt with `replaceTriggeringEvent`, but the " +
    'event does not record what caused the discard, so "an encounter card effect" cannot be told from a player card\'s ' +
    "or a defeat (and `EventPattern.eventIs` has only `to`). Needs a cause (source) on `cardLeavesPlay` and a pattern " +
    "field to read it.",
  ...Object.fromEntries(
    [
      "50047.agent-coulson-response",
      "50048.quake-response",
      "50049.global-logistics-action",
      "50050.informant-interrupt",
      "50051.intelligence-response",
      "50052.prism-dust-response",
      "50053.under-surveillance-constant",
      "50054.nick-fury-sr-forced-response",
      "50055.jemma-simmons-constant",
      "50055.jemma-simmons-resource",
      "50056.leo-fitz-constant",
      "50056.leo-fitz-action",
      "50057.sky-destroyer-response",
      "50058.practiced-plan-response",
    ].map((id) => [id, "second half of the module, not started"]),
  ),
};
