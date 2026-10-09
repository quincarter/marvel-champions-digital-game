/**
 * Whether this table may see a card's face.
 *
 * The rule itself now lives in the engine (`@mc/engine`'s `visibility.ts`), because two things need the same answer
 * and must not fork: this module, and the engine's own `preview()`, whose truncation rule is what stops an outcome
 * preview from quietly peeking at a deck. What that rule says is unchanged — a hand and a discard pile are open, a
 * deck is closed except for the cards an open decision is offering out of it, and everything else is open exactly
 * when it is faceup — and the reasoning is written out there.
 *
 * Phase 4 is multi-handed solo — one human plays every seat (PLAN.md Phase 4, "hero seats") — so every hand at the
 * table is that human's own and no hand needs hiding from them. When Phase 5 puts real opponents on the far side of a
 * network, hidden information stops being the client's business at all: the server must not send a card the player
 * may not see, and this function becomes a rendering detail rather than the thing keeping the secret.
 */

import {
  faceVisible as engineFaceVisible,
  locateCard,
  offeredByOpenChoice,
  type GameState,
  type InstanceId,
  type TableContext,
  type ViewerContext,
} from "@mc/engine";
import { POOL_DEPS } from "../content/pool.js";

/**
 * The engine's `faceVisible`, answering for the table when the caller names no viewer: a rule that shows a card to
 * every player (Magik's faceup top card, `topOfDeckFaceup`) is read through the pool's deps, so a name, a log line or a
 * prompt about that card never says "a facedown card" for a card the whole table is looking at.
 */
export const faceVisible = (state: GameState, id: InstanceId, view?: ViewerContext | TableContext): boolean =>
  engineFaceVisible(state, id, view ?? { deps: POOL_DEPS }) || beingPlayed(state, id) || offeredFromSetAside(state, id);

/**
 * An event being played is in its owner's `resolving` zone (RRG "Event": out of play while it resolves): the card was
 * just chosen from a hand and is on the table for all to read. The engine leaves its `faceup` flag false, which named
 * it "a facedown card" in the wild-icon sheet and the log.
 */
const beingPlayed = (state: GameState, id: InstanceId): boolean => locateCard(state, id)?.kind === "resolving";

/**
 * A set-aside card an open choice is offering (Find Lost Mutants' "add one set-aside campaign ally to your hand",
 * `chooseCards` over `encounterSetAside`): the chooser picks among them, so they read the faces. The engine's
 * `faceVisible` opens that for deck zones only; it falls to the card's `faceup` flag here. Scoped to the set-aside
 * zones so a facedown card offered in play (a Drone as an attack target) stays facedown.
 */
const offeredFromSetAside = (state: GameState, id: InstanceId): boolean => {
  const zone = locateCard(state, id);
  return (zone?.kind === "encounterSetAside" || zone?.kind === "setAside") && offeredByOpenChoice(state, id);
};
