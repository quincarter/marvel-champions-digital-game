/**
 * RRG 1.8 Appendix II step 11 (p. 51) for a card found in an encounter deck or in the encounter set-aside area: "Search each deck and the set aside area
 * for any cards with the setup keyword and put them into play", and "Setup (Keyword)" (p. 40): "A card with the setup
 * keyword begins the game in play."
 *
 * In a game whose villains all start set aside (`GameState.villainsEnteringAtSetup`) no villain is in play at step 11:
 * step 12a's text brings the starting ones in. An attachment that reads "Attach to the villain" then has no card to
 * attach to yet. The RRG does not say what becomes of it. "Attach To" (p. 8) discards a card that cannot attach, which
 * would leave a setup-keyword card out of play at the start of the game, against the keyword's own definition; so it
 * is read as still owing its entry: taken out of the deck at step 11 as every setup card is, held in the set-aside
 * area (one found there stays where it is), and put into play as soon as a card it can attach to is in play (the
 * moment a villain enters, `addVillains`).
 * One still waiting when step 12c begins (`resolveVillainSetupAbilities`) is tried a last time and then follows
 * "Attach To" like any other.
 *
 * A game with a villain in play from the start never holds a card: its step 11 is unchanged.
 */

import { attachmentHostCandidates } from "../attachment-hosts.js";
import { type Ctx, moveCard, updateInstance } from "../ctx.js";
import type { InstanceId, PlayerId } from "../ids.js";
import { mustCardOf } from "../query.js";
import type { EffectContext } from "../select.js";
import { enterPlayOnReveal } from "./reveal.js";

/** Whether the attachment has a card to attach to right now, read as `enterPlayOnReveal` reads it. */
function hasHost(ctx: Ctx, id: InstanceId, playerId: PlayerId): boolean {
  const card = mustCardOf(ctx.state, id);
  if (card.type !== "attachment" || !card.attachesTo) return true;
  const context: EffectContext = {
    selfInstanceId: id,
    controllerId: playerId,
    event: null,
    bindings: {},
    deps: ctx.deps,
  };
  return attachmentHostCandidates(ctx.state, card.attachesTo, context).length > 0;
}

const setWaiting = (ctx: Ctx, waiting: readonly InstanceId[]): void => {
  const { setupCardsAwaitingHost: _previous, ...rest } = ctx.state;
  ctx.state = waiting.length > 0 ? { ...rest, setupCardsAwaitingHost: waiting } : rest;
};

/**
 * Step 11 for one setup-keyword card of an encounter deck or of the encounter set-aside area: it enters play, or waits
 * for the villain to.
 */
export function encounterSetupCardEntersPlay(ctx: Ctx, id: InstanceId, playerId: PlayerId): void {
  updateInstance(ctx, id, (i) => ({ ...i, faceup: true }));
  if (ctx.state.villainsEnteringAtSetup !== undefined && !hasHost(ctx, id, playerId)) {
    if (!ctx.state.encounterSetAside.includes(id)) moveCard(ctx, id, { kind: "encounterSetAside" });
    setWaiting(ctx, [...(ctx.state.setupCardsAwaitingHost ?? []), id]);
    return;
  }
  enterPlayOnReveal(ctx, id, playerId);
}

/**
 * Puts into play each waiting setup card that now has a card to attach to, in the order step 11 found them. With
 * `last`, the window is closing: every card still waiting enters as `enterPlayOnReveal` has it, which discards one that
 * cannot attach (RRG 1.8 "Attach To", p. 8).
 */
export function waitingSetupCardsEnterPlay(ctx: Ctx, last = false): void {
  const waiting = ctx.state.setupCardsAwaitingHost;
  if (!waiting) return;
  const playerId = ctx.state.firstPlayerId;
  for (const id of waiting) {
    // A card that text has since moved out of the set-aside area is no longer step 11's to put into play.
    const held = ctx.state.encounterSetAside.includes(id);
    if (held && !last && !hasHost(ctx, id, playerId)) continue;
    setWaiting(
      ctx,
      (ctx.state.setupCardsAwaitingHost ?? []).filter((other) => other !== id),
    );
    if (held) enterPlayOnReveal(ctx, id, playerId);
  }
}
