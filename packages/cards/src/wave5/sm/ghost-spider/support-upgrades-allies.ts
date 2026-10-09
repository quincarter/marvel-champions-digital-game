import { trait } from "@mc/content";
import type { TargetQuery } from "@mc/engine";
import {
  action,
  anEnemy,
  attachCard,
  cards,
  choosePlayer,
  chooseCards,
  chosen,
  chosenPlayer,
  confuse,
  constant,
  costModifier,
  countBoostIcons,
  countOf,
  dealDamage,
  defineAbilities,
  each,
  discardEncounterCards,
  discardFromHand,
  discardRandomFromHandCost,
  draw,
  drawUpTo,
  encounterCards,
  eventSource,
  exhaustThis,
  exists,
  handCountOf,
  handSizeOf,
  heroAction,
  heroResponse,
  ifThen,
  interrupt,
  moveCards,
  on,
  playOnlyIf,
  playableAttachments,
  printedCostOf,
  query,
  ready,
  response,
  scaled,
  self,
  shuffleEncounterDeck,
  stun,
  theVillain,
  valueAtLeast,
  valueAtMost,
  varOf,
  you,
  youHaveTrait,
  zone,
} from "../../../dsl/index.js";
import { onInterruptOrResponseResolvedOnEvent } from "./identity.js";

const WEB_WARRIOR = trait("WEB-WARRIOR");

/**
 * "A Web-Warrior card you control": every type a printed Web-Warrior trait shows up on in this box — the identity
 * itself while in hero form (27001a), an ally (Silk, Spider-Man (Miles Morales), Spider-UK, Spider-Man (Hobie
 * Brown)) or a support (Web of Life and Destiny, itself). Categories cast wide (`upgrade` included) since nothing
 * here restricts which card type future Web-Warrior cards might use.
 */
const A_WEB_WARRIOR_CARD: TargetQuery = {
  categories: ["identity", "ally", "upgrade", "support"],
  trait: WEB_WARRIOR,
  controller: "you",
};
const ANOTHER_WEB_WARRIOR_CARD: TargetQuery = { ...A_WEB_WARRIOR_CARD, self: false };

/**
 * Ghost-Spider (`sm` 27001a–27029) supports, upgrades and allies scripted directly (docs/phase7-wave5.md §3.13,
 * §3.14, §3.15, §3.32): George Stacy (27007), Ticket to the Multiverse (27008), Web-Bracelet (27009), Silk
 * (27010), Spider-Man / Miles Morales (27011), Spider-UK (27012), Spider-Man / Hobie Brown (27017), Web of Life
 * and Destiny (27023), Plan B (27024). 27020–27022 are basic resources with no abilities (data only). Her events
 * (27002–27006, 27013–27019) and obligation/nemesis set (27025–27029) are separate modules.
 *
 * **George Stacy (27007) — §3.15's own worked example**: a constant `playableAttachments(query("event"))` for
 * "Events attached to George Stacy may be played as if they were in your hand", and an Action that attaches a
 * chosen hand event facedown, gated `to a maximum of 3` by `valueAtMost(countOf({ host: self, facedown: true }),
 * 2)` before adding a fourth (ruling Mar 30, 2026 (1): the maximum is local to this card).
 *
 * **Ticket to the Multiverse (27008)**: "Remove … from the game" prints before the "→", but no `AbilityCost`
 * shape exists for removing the card itself from play as a cost (`discardThis`/`exhaustThis` cover exhaust/discard
 * only) — resolved as the first plain effect instead, the same "remove this card from the game" shape Grand
 * Strategy (`gmw` 16174) and Loss of Control (`mts` 21026) already use for a same-sentence removal with no
 * intervening decision point, so the ordering is unobservable. "Ready each Ghost-Spider card you control" reads as
 * literally titled "Ghost-Spider" (only the identity's own hero face, 27001a, prints that title in this box) —
 * `query(["identity"], { name: "Ghost-Spider", controller: "you" })`, not her signature card pool (there is no
 * `identitySetOf`-style keyword name on any card here, and the card is dated errata-free).
 *
 * **Web-Bracelet (27009)** reuses Ghost-Spider's own `onInterruptOrResponseResolvedOnEvent` (§3.32's
 * `abilityResolved`/`abilityTiming` citation for this exact card) with `maxOnePerTriggeringInstance` (§3.14): the
 * documented "known limit" (the instance is the `abilityResolved` event itself, not the played event card) is
 * accepted as built — no wave 5 card needs two Interrupt/Response abilities to resolve on the same played event.
 *
 * **Silk (27010)** searches the encounter deck (not the discard pile — only "the encounter deck" is printed) for
 * a treachery and discards it, gated on controlling *another* Web-Warrior card (`self: false`); `min: 1, max: 1`
 * follows the "search for a [category] and discard/reveal it" precedent (`trors` Zola set, `04111.when-revealed`)
 * over the "may find none" `min: 0` shape, since a treachery is assumed to exist in a Core-sized encounter deck.
 *
 * **Spider-Man / Miles Morales (27011)** stuns and confuses an enemy if 3+ Web-Warrior cards (himself included,
 * unlike Silk's "another") are controlled — one chosen enemy, not two separate choices, since "stun and confuse
 * an enemy" names one target for both statuses (RRG 1.8 "Status Cards", p. 42: idempotent, so applying both to
 * the same chosen enemy is the literal reading).
 *
 * **Spider-UK (27012)**: `on.defends` names Spider-UK himself (`self: true`, the `rocket-kit.ts` "Groot" precedent
 * for an ally defending), and the attacking enemy is `eventSource` (the "defended" event's own source, per
 * `mts/spectrum-kit.ts` Pulsar Shield / `vision-kit.ts` Mass Increase) — resolved immediately in the interrupt
 * window rather than deferred with `atEndOfAttack`, since dealing damage here isn't a stat modifier riding the
 * attack's own event frame.
 *
 * **Spider-Man / Hobie Brown (27017)** is §3.13's own worked example verbatim, with the printed damage-to-villain
 * sentence added: `countBoostIcons(chosen("discarded"), …)` sums boost icons across every card `discardEncounterCards`
 * bound (`qsv/kit.ts`'s "Ghost Kick" precedent for the same shape). "Play only if you control a Web-Warrior card"
 * is a `playOnlyIf` constant (data does not carry a schema-level `playRestrictions` entry for this card, unlike
 * Plan B's `anyPlayerControl`, so it needs its own ability ref — matching this card's own `abilities` array).
 *
 * **Web of Life and Destiny (27023)**: "Ignore this card's resource cost if your identity has the Web-Warrior
 * trait" is a `costModifier` whose `delta` negates the card's own printed cost (`scaled(printedCostOf(self), {
 * times: -1 })`, since the flat `-1`/`-N` shape `mts/adam-warlock-pack-cards.ts`'s Martinex uses only works when
 * the reduction happens to equal the printed cost) while in hand (`activeIn: "hand"`), gated on `youHaveTrait`
 * (the "Martinex" precedent for "if your identity has the [trait] trait"). The response is §3.13's own worked
 * example, with "choose a player → that player draws 1 card" added (`choosePlayer`/`chosenPlayer`, the
 * `mts/spectrum-pack-cards.ts` Avengers Mansion precedent).
 *
 * **Plan B (27024)**: "Play under any player's control. Max 1 per player." is schema-level `playRestrictions`
 * (`anyPlayerControl`/`maxPerPlayer`, already on the card record) — no ability ref needed for it. Only the Hero
 * Action itself is scripted.
 */
export const GHOST_SPIDER_SUPPORT_UPGRADES_ALLIES = defineAbilities({
  "27007.george-stacy-constant": constant(playableAttachments(query("event"))),
  "27007.george-stacy-action": action(
    { cost: exhaustThis },
    ifThen(valueAtMost(countOf({ host: self, facedown: true }), 2), [
      chooseCards("event", zone("hand", you, { filter: query("event") }), { min: 1, max: 1 }),
      attachCard(chosen("event"), self, { facedown: true }),
    ]),
  ),

  "27008.ticket-to-the-multiverse-action": action(
    moveCards(cards(self), "removedFromGame"),
    discardFromHand(handCountOf()),
    moveCards(zone("discard", you), "deckShuffle"),
    drawUpTo(handSizeOf(you)),
    ready(each(query(["identity"], { name: "Ghost-Spider", controller: "you" }))),
  ),

  "27009.web-bracelet-response": heroResponse(
    onInterruptOrResponseResolvedOnEvent,
    { cost: exhaustThis, limit: { count: 1, period: "phase", per: "triggeringEvent" } },
    draw(1),
  ),

  "27010.silk-response": response(
    on.youPlayThis(),
    ifThen(exists(ANOTHER_WEB_WARRIOR_CARD), [
      chooseCards("found", encounterCards(["deck"], query("treachery")), { min: 1, max: 1 }),
      moveCards(cards(chosen("found")), "discard"),
      shuffleEncounterDeck(),
    ]),
  ),

  "27011.spider-man-response": response(
    on.youPlayThis(),
    ifThen(valueAtLeast(countOf(A_WEB_WARRIOR_CARD), 3), [anEnemy(), stun(chosen("enemy")), confuse(chosen("enemy"))]),
  ),

  "27012.spider-uk-interrupt": interrupt(
    on.defends(query("ally", { self: true })),
    dealDamage(countOf(A_WEB_WARRIOR_CARD), eventSource),
  ),

  "27017.spider-man-constant": constant(playOnlyIf(exists(A_WEB_WARRIOR_CARD))),
  "27017.spider-man-interrupt": interrupt(
    on.leavesPlay("self"),
    discardEncounterCards(3, { bind: "discarded" }),
    countBoostIcons(chosen("discarded"), "discarded"),
    dealDamage(varOf("discarded.boostIcons"), theVillain),
  ),

  "27023.web-of-life-and-destiny-constant": constant(
    costModifier({
      delta: scaled(printedCostOf(self), { times: -1 }),
      appliesTo: { self: true },
      while: youHaveTrait(WEB_WARRIOR),
      activeIn: "hand",
    }),
  ),
  "27023.web-of-life-and-destiny-response": response(
    on.leavesPlay(query("ally", { trait: WEB_WARRIOR })),
    choosePlayer(),
    draw(1, chosenPlayer()),
  ),

  "27024.plan-b-action": heroAction(
    { cost: [exhaustThis, discardRandomFromHandCost(1)] },
    anEnemy(),
    dealDamage(2, chosen("enemy")),
  ),
});
