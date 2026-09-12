/**
 * Which phone tabs something happened on.
 *
 * On a phone only one zone is on screen at a time, so a card moving to a hidden
 * zone would happen silently. Each tab carries a count of what changed while
 * the player was looking elsewhere, and looking at the tab clears it (PLAN.md
 * Phase 4, "the button shows a change badge, so off-screen changes still
 * read").
 *
 * The zone an event belongs to is decided by *where the card is*, not by the
 * event's name — a damage event is Enemies news when it lands on the villain
 * and Me news when it lands on your identity. So every instance an event names
 * is located, and the tabs it touches come back.
 *
 * The Log tab is deliberately never badged: every event is log news, so a badge
 * there would be on permanently and would mean nothing.
 */

import { getInstance, getPlayer, type GameEvent, type GameState, type InstanceId, type PlayerId } from "@mc/engine";
import type { PhoneTab } from "./layout.js";

/**
 * Tabs touched by this command's events, with how many events touched each.
 * `state` is the state *after* the events, which is where the cards now are.
 */
export function tabsTouchedBy(
  events: readonly GameEvent[],
  state: GameState,
  perspectiveId: PlayerId,
): ReadonlyMap<PhoneTab, number> {
  const counts = new Map<PhoneTab, number>();
  const bump = (tab: PhoneTab | null): void => {
    if (tab) counts.set(tab, (counts.get(tab) ?? 0) + 1);
  };

  for (const event of events) {
    for (const instanceId of instancesIn(event)) {
      bump(tabFor(state, instanceId, perspectiveId));
    }
    // A few events are about a seat rather than a card.
    if ("playerId" in event && typeof event.playerId === "string") {
      if (event.type === "playerEliminated" || event.type === "turnStarted") {
        bump(event.playerId === perspectiveId ? "me" : "team");
      }
    }
  }
  return counts;
}

/** Every card an event names. Unnamed events (step changes, stack frames) touch nothing. */
function instancesIn(event: GameEvent): readonly InstanceId[] {
  const ids: InstanceId[] = [];
  const record = event as unknown as Record<string, unknown>;
  for (const field of [
    "instanceId",
    "targetInstanceId",
    "schemeInstanceId",
    "enemyInstanceId",
    "defenderInstanceId",
    "fromInstanceId",
    "toInstanceId",
  ]) {
    const value = record[field];
    if (typeof value === "string") ids.push(value as InstanceId);
  }
  return ids;
}

/**
 * The tab a card lives on. Schemes are Threat; your own things are Me; another
 * seat's are Team; everything else on the table is Enemies.
 */
function tabFor(state: GameState, instanceId: InstanceId, perspectiveId: PlayerId): PhoneTab | null {
  if (instanceId === state.mainScheme.instanceId) return "threat";
  const instance = getInstance(state, instanceId);
  if (!instance) return null;

  const card = state.cardPool[instance.cardId];
  if (card?.type === "side_scheme" || card?.type === "main_scheme" || card?.type === "player_side_scheme") return "threat";

  const me = getPlayer(state, perspectiveId);
  if (me) {
    if (instanceId === me.identity.instanceId) return "me";
    if (me.playArea.includes(instanceId) || me.hand.includes(instanceId) || me.discard.includes(instanceId)) return "me";
  }
  // A card another seat controls is that seat's news.
  const owner = instance.controllerId ?? instance.ownerId;
  if (owner && owner !== perspectiveId) return "team";

  return "enemies";
}
