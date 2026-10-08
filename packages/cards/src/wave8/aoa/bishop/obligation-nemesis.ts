import { trait } from "@mc/content";
import type { AbilityDefinition, AbilityRegistry, EventPattern } from "@mc/engine";
import {
  bindTargets,
  cards,
  chooseCards,
  chosen,
  constant,
  defineAbilities,
  each,
  engagedPlayerOf,
  exists,
  find,
  firstRevealGainsSurge,
  forcedResponse,
  handCountOf,
  ifThen,
  moveCards,
  named,
  on,
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
 * **Portal Through Time (45027)**: not registered, see `BISHOP_OBLIGATION_NEMESIS_SKIPPED`.
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

  "45028.when-revealed": whenRevealed(portalOrFind(you)),

  "45029.when-revealed": whenRevealed(
    selectCards("hand", zone("hand", you)),
    bindTargets("most", superlative("highest", chosen("hand"), totalPrintedResources(chosen("candidate")))),
    chooseCards("trickery", cards(chosen("most")), { min: 1, max: 1 }),
    moveCards(cards(chosen("trickery")), "discard"),
    placeThreat(totalPrintedResources(chosen("trickery")), each(query("scheme"))),
  ),
});

/**
 * Portal Through Time, "Forced Interrupt: When a TEMPORAL card is revealed, it gains surge. (Limit once per phase.)",
 * as far as today's engine can say it: `firstRevealGainsSurge` reads "the first TEMPORAL card revealed this phase" from
 * the round's whole reveal history, not "the first one revealed while this scheme is in play". The two differ when a
 * TEMPORAL card was revealed earlier in the phase than the Portal (Bantam, which finds the Portal: the next TEMPORAL
 * card that phase, say Trevor Fitzroy, should gain surge and would not). Left unregistered (a subtly wrong card is worse
 * than a missing one); the engine would need a surge grant to another card from a limited interrupt. Exported for the
 * `it.fails` proof.
 */
export const PORTAL_THROUGH_TIME_DRAFT: AbilityDefinition = constant(
  firstRevealGainsSurge(
    query(["minion", "treachery", "sideScheme", "attachment", "environment"], { trait: TEMPORAL }),
    "phase",
  ),
);

/** Refs left unregistered, each with its reason (the coverage test reads this through its own `skipped` list). */
export const BISHOP_OBLIGATION_NEMESIS_SKIPPED: Readonly<Record<string, string>> = {
  "45027.portal-through-time-forced-interrupt":
    "needs a surge grant to the revealed card from a Forced Interrupt limited once per phase by its own uses; firstRevealGainsSurge counts TEMPORAL reveals made before the Portal entered play (Bantam), so it under-grants",
};
