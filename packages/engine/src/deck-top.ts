/**
 * The log of "play with the top card of your deck faceup" (`RuleSpec topOfDeckFaceup`, docs/phase7-wave8.md §3.48).
 *
 * Which card is showing is derived (`shownDeckTop`, `select.ts`) and never stored on a card. What is kept is the last
 * value the log announced (`GameState.deckTopsAnnounced`), so each change is logged once: `deckTopShown` for the card
 * now showing, `deckTopHidden` when a showing card is facedown again. `announceDeckTops` is called after every move of
 * a card (`settlePlayerDecks`, `placeAt`), after every shuffle and reset of a player deck, and between frames
 * (`checkStateTriggers`) for the rule itself turning on or off with nothing moved (a form change, a blank text box).
 * RRG 1.8 FAQ "Magik (#30A)" (p. 64): "As soon as she does this, she turns the new top card of her deck faceup", so a
 * draw of 2 shows the second card before it is drawn.
 *
 * A game with no such rule pays one cached registry check per call and writes nothing to its state or its log.
 */

import type { AbilityRegistry } from "./abilities.js";
import { type Ctx, emit } from "./ctx.js";
import type { InstanceId } from "./ids.js";
import { deckTopFaceupPlayers } from "./select.js";

const REGISTRIES_WITH_RULE = new WeakMap<AbilityRegistry, boolean>();

/** Whether anything in this game could put the rule in force: a printed constant, the scenario, a lasting grant. */
function ruleCanHold(ctx: Ctx): boolean {
  let printed = REGISTRIES_WITH_RULE.get(ctx.deps.abilities);
  if (printed === undefined) {
    printed = Object.values(ctx.deps.abilities).some(
      (definition) =>
        definition.trigger.kind === "constant" &&
        (definition.trigger.rules ?? []).some((rule) => rule.kind === "topOfDeckFaceup"),
    );
    REGISTRIES_WITH_RULE.set(ctx.deps.abilities, printed);
  }
  return (
    printed ||
    (ctx.state.scenarioRules.rules ?? []).some((rule) => rule.kind === "topOfDeckFaceup") ||
    ctx.state.lastingEffects.some((e) => e.kind === "ruleGrant" && e.rule.kind === "topOfDeckFaceup")
  );
}

/**
 * Logs every change in what is showing on top of a player deck since the last call, in player order, and records it.
 * Idempotent: a second call with nothing changed logs nothing. Does nothing while a hold is open (`holdDeckTops`).
 */
export function announceDeckTops(ctx: Ctx): void {
  if ((ctx.deckTopsHeld ?? 0) > 0) return;
  const known = ctx.state.deckTopsAnnounced;
  if (!known && !ruleCanHold(ctx)) return;
  const faceup = deckTopFaceupPlayers(ctx.state, ctx.deps);
  const next: Record<string, InstanceId> = {};
  let changed = false;
  for (const player of ctx.state.players) {
    const was = known?.[player.playerId];
    const top = faceup.includes(player.playerId) ? player.deck[0] : undefined;
    if (top !== undefined) {
      next[player.playerId] = top;
      if (top === was) continue;
      changed = true;
      emit(ctx, {
        type: "deckTopShown",
        playerId: player.playerId,
        instanceId: top,
        cardId: ctx.state.instances[top]!.cardId,
      });
      continue;
    }
    if (was === undefined) continue;
    changed = true;
    // The rule stopped holding over a card that was showing: it is facedown again. With the rule still on, the deck
    // is empty: the shown card's own move is in the log already and there is nothing left to hide.
    if (!faceup.includes(player.playerId)) emit(ctx, { type: "deckTopHidden", playerId: player.playerId });
  }
  if (!changed) return;
  const { deckTopsAnnounced: _was, ...rest } = ctx.state;
  ctx.state = Object.keys(next).length > 0 ? { ...rest, deckTopsAnnounced: next } : rest;
}

/**
 * Runs `run` as one change to the decks: nothing is announced until it is done, then the result is. For an exchange
 * that passes through a state no player sees: a swap lifts the top card before the other card takes its place (RRG 1.8
 * "'Swap'", p. 42), and a find takes its card out of a deck that is shuffled before anyone reads its top (RRG 1.8
 * "Search", p. 39). Nested holds announce once, when the outermost ends.
 */
export function holdDeckTops<T>(ctx: Ctx, run: () => T): T {
  ctx.deckTopsHeld = (ctx.deckTopsHeld ?? 0) + 1;
  try {
    return run();
  } finally {
    ctx.deckTopsHeld = (ctx.deckTopsHeld ?? 1) - 1;
    announceDeckTops(ctx);
  }
}
