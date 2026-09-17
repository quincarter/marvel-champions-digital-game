/**
 * The readable beats of a command: what just happened, and to what.
 *
 * The design's brief for motion is "enough to make state changes readable, not
 * spectacle for its own sake" (PLAN.md Phase 4). The thing a player actually
 * loses track of in a card game is not *that* the board changed but *where* —
 * four damage landing on a minion and four landing on your identity look
 * identical in a log line and completely different at the table.
 *
 * So a beat is a number and a place: "−4" over Rhino, "+2 THREAT" over the main
 * scheme, "STUNNED" over the minion that just got stunned. The Board tweens
 * them off their anchor and lets them go.
 *
 * This module is plain data — no Phaser, no positions. It says what to say and
 * which card to say it over; the scene knows where that card currently is.
 */

import type { GameEvent, InstanceId } from "@mc/engine";

/** Which of the design's signal colours a beat speaks in. */
export type BeatTone = "damage" | "heal" | "threat" | "status" | "defeat";

export interface Beat {
  /** Stable within one command, so a list can key on it. */
  readonly id: string;
  /** The card the beat floats over. */
  readonly anchor: InstanceId;
  /** "−4", "+2 THREAT", "STUNNED". Short enough to read in one glance. */
  readonly text: string;
  readonly tone: BeatTone;
}

/**
 * Beats for one command's events, in the order they happened.
 *
 * Only events that change a number or a state a player tracks produce one.
 * Bookkeeping (stack frames, timing windows, trigger announcements) produces
 * nothing, for the same reason the game log drops it: it is the engine talking
 * to itself.
 */
export function beatsFrom(events: readonly GameEvent[]): readonly Beat[] {
  const beats: Beat[] = [];
  const push = (anchor: InstanceId, text: string, tone: BeatTone): void => {
    beats.push({ id: `${beats.length}`, anchor, text, tone });
  };

  for (const event of events) {
    switch (event.type) {
      case "damageDealt":
      case "damagePlaced":
        if (event.amount > 0) push(event.targetInstanceId, `−${event.amount}`, "damage");
        break;
      case "damageHealed":
        if (event.amount > 0) push(event.targetInstanceId, `+${event.amount}`, "heal");
        break;
      case "damagePrevented":
        // "0" is the whole point of Toughness: the attack happened and did nothing.
        push(event.targetInstanceId, event.reason === "tough" ? "TOUGH" : "PREVENTED", "status");
        break;
      case "threatPlaced":
        if (event.amount > 0) push(event.schemeInstanceId, `+${event.amount} THREAT`, "threat");
        break;
      case "threatRemoved":
        if (event.amount > 0) push(event.schemeInstanceId, `−${event.amount} THREAT`, "heal");
        break;
      case "threatPrevented":
        push(event.schemeInstanceId, "PREVENTED", "status");
        break;
      case "threatRemovalBlocked":
        // Crisis is the commonest reason a thwart silently does nothing.
        push(event.schemeInstanceId, event.reason === "crisis" ? "CRISIS" : "BLOCKED", "status");
        break;
      case "statusGiven":
        push(event.instanceId, event.status.toUpperCase(), "status");
        break;
      case "characterDefeated":
      case "schemeDefeated":
        push(event.instanceId, "DEFEATED", "defeat");
        break;
      case "overkillSpilled":
        push(event.toInstanceId, `−${event.amount} OVERKILL`, "damage");
        break;
      case "counterAdded":
        if (event.amount > 0) push(event.instanceId, `+${event.amount} ${event.counterType}`, "heal");
        break;
      case "counterRemoved":
        if (event.amount > 0) push(event.instanceId, `−${event.amount} ${event.counterType}`, "damage");
        break;
      /**
       * A resolved ability's own effects usually produce their own beats
       * (damage, threat, a status), but not always — Winds of Watoomb's
       * Special just draws 3 cards, an event this module has no case for, so
       * without this a Special that only draws or moves cards fired with no
       * visible change at all. The anchor is the resolving card itself: an
       * Invocation card's own instance id, which still resolves to a rect
       * once it's sitting atop its deck (returned) or its own discard
       * (`scenes/board/zones.ts`'s `drawSeparateDecks`), so "resolve →
       * discard / return-to-top" reads as one card's own beat rather than
       * requiring a special "which pile" case here.
       */
      case "abilityResolved":
        push(event.instanceId, "RESOLVED", "status");
        break;
      default:
        break;
    }
  }
  return beats;
}
