import { trait } from "@mc/content";
import type { AbilityRegistry, EventPattern } from "@mc/engine";
import {
  bindTargets,
  cards,
  chooseCards,
  chosen,
  defineAbilities,
  each,
  engagedPlayerOf,
  exists,
  find,
  eventTarget,
  forcedInterrupt,
  forcedResponse,
  handCountOf,
  ifThen,
  moveCards,
  named,
  on,
  oncePerPhase,
  placeThreat,
  totalPrintedResources,
  query,
  revealCard,
  selectCards,
  self,
  superlative,
  surge,
  valueAtLeast,
  whenRevealed,
  you,
  zone,
} from "../../../dsl/index.js";
import { obligation } from "../../../core/obligations.js";

const PORTAL = "Portal Through Time";
const TEMPORAL = trait("TEMPORAL");

const PORTAL_IN_PLAY = exists(query("sideScheme", { name: PORTAL }));

/**
 * "If Portal Through Time is in play, place 2 threat on it. Otherwise, find it and reveal it." (Trevor Fitzroy, Bantam;
 * docs/phase7-wave8.md section 3.1). `revealer` is who reveals the found card: the revealing player for Bantam, the
 * player Trevor Fitzroy is engaged with for his Forced Response (an encounter card has no `ownerOf`).
 */
const portalOrFind = (revealer: typeof you) =>
  ifThen(
    PORTAL_IN_PLAY,
    placeThreat(2, named(PORTAL)),
    revealCard(find(query("sideScheme", { name: PORTAL })), revealer),
  );

/** "After Trevor Fitzroy attacks and defeats an ally": the enemy attack's `defeated` result against an ally. */
const FITZROY_DEFEATS_ALLY: EventPattern = {
  ...on.enemyAttacks("self"),
  targetIs: query("ally"),
  requireResults: { defeated: 1 },
};

/**
 * Bishop's obligation and nemesis set (docs/phase7-wave8.md section 7.1, 3.52, 3.1, 3.60).
 *
 * Cards (5):
 * - 45025 Fear the Future (obligation)
 * - 45026 Trevor Fitzroy (minion)
 * - 45027 Portal Through Time (side_scheme)
 * - 45028 Bantam (minion)
 * - 45029 Temporal Trickery (treachery)
 *
 * **Fear the Future (45025)**: Core's shared `obligation()` shape ("Give to the Lucas Bishop player" is engine data). The
 * second option discards each resource card in hand and then the obligation; with none in hand (read before the
 * discard) the card gains surge, the same shape as Burn Notice.
 *
 * **Trevor Fitzroy (45026)**: Quickstrike is data. Forced Response after he attacks and defeats an ally: 2 threat on
 * Portal Through Time if it is in play, otherwise find it and reveal it (the engaged player reveals).
 *
 * **Bantam (45028)**: the same choice as a When Revealed.
 *
 * **Temporal Trickery (45029)**: the player discards one card of their choice among those in hand with the most
 * printed resource icons (the hand is bound as a slot, `superlative` keeps every tied card, `chooseCards` picks one),
 * then each scheme in play (main and side) takes 1 threat per printed icon on it. An empty hand does nothing.
 *
 * **Portal Through Time (45027)**, "Forced Interrupt: When a TEMPORAL card is revealed, it gains surge. (Limit once per
 * phase.)": a forced interrupt of the side scheme in play on the card being revealed, giving that card surge
 * (`surge(eventTarget)`), limited by its own uses. A TEMPORAL card revealed before the Portal entered play that phase
 * (Bantam, which finds it) used nothing, so the next TEMPORAL card revealed that phase gains surge.
 */
export const BISHOP_OBLIGATION_NEMESIS: AbilityRegistry = defineAbilities({
  "45025.obligation": obligation("Lucas Bishop", {
    label: "Discard each resource card from your hand",
    effects: [
      ifThen(
        valueAtLeast(handCountOf(you, query("resource")), 1),
        moveCards(zone("hand", you, { filter: query("resource") }), "discard"),
        surge(),
      ),
    ],
  }),

  "45026.trevor-fitzroy-forced-response": forcedResponse(FITZROY_DEFEATS_ALLY, portalOrFind(engagedPlayerOf(self))),

  "45027.portal-through-time-forced-interrupt": forcedInterrupt(
    on.encounterCardRevealed({ trait: TEMPORAL }),
    { limit: oncePerPhase },
    surge(eventTarget),
  ),

  "45028.when-revealed": whenRevealed(portalOrFind(you)),

  "45029.when-revealed": whenRevealed(
    selectCards("hand", zone("hand", you)),
    bindTargets("most", superlative("highest", chosen("hand"), totalPrintedResources(chosen("candidate")))),
    chooseCards("trickery", cards(chosen("most")), { min: 1, max: 1 }),
    moveCards(cards(chosen("trickery")), "discard"),
    placeThreat(totalPrintedResources(chosen("trickery")), each(query("scheme"))),
  ),
});

/** Refs left unregistered, each with its reason. None is left. */
export const BISHOP_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {};
