/**
 * The "would gain a status card" interrupt window in front of an effect's give (`TriggerEvent statusBeingGiven`,
 * docs/phase7-wave9.md §3.33): "Forced Interrupt: When attached enemy would gain a confused or stunned status card,
 * discard this card instead" (Solid Sound Constructs, `aos` 50144). RRG 1.8 "'Would'" (p. 48), "Replacement Effect"
 * (p. 37), "Status Cards" (p. 41).
 */

import type { EngineDeps } from "../abilities.js";
import type { Ctx } from "../ctx.js";
import { giveStatus, type StatusGiver } from "../effects.js";
import type { FrameId, InstanceId } from "../ids.js";
import { canTakeStatus } from "../keywords.js";
import type { StatusName } from "../spec.js";
import type { TriggerEvent } from "../trigger-events.js";
import { addFrameVars, pushEvents } from "./frames.js";
import { heard } from "./triggers.js";

type BeingGiven = Extract<TriggerEvent, { kind: "statusBeingGiven" }>;

const LISTENS_FOR_STATUS_BEING_GIVEN = new WeakMap<EngineDeps, boolean>();

/**
 * Whether any ability in the registry triggers on `statusBeingGiven`; cached per registry. Status cards are given in
 * every game, so nothing is read or announced for a registry with no such ability.
 */
function listensForStatusBeingGiven(deps: EngineDeps): boolean {
  const cached = LISTENS_FOR_STATUS_BEING_GIVEN.get(deps);
  if (cached !== undefined) return cached;
  const listens = Object.values(deps.abilities).some((definition) => {
    const trigger = definition.trigger;
    if (!("on" in trigger) || !trigger.on) return false;
    const kinds = typeof trigger.on.on === "string" ? [trigger.on.on] : trigger.on.on;
    return kinds.includes("statusBeingGiven");
  });
  LISTENS_FOR_STATUS_BEING_GIVEN.set(deps, listens);
  return listens;
}

/** One status card an effect gives: `count` of them to `id` (a steady character can be given two at once). */
export interface StatusGive {
  readonly instanceId: InstanceId;
  readonly count: number;
}

/**
 * Gives the status cards of one effect, in order, each through a `statusBeingGiven` event when an ability hears it,
 * else at once as before (`giveStatus`). Like every other optional announcement the event goes on the stack only when
 * an ability could react (`heard`), and only for a card the character has room for (`canTakeStatus`): a give that
 * would place nothing is not about to happen. Once one card of the effect waits for its window, the cards after it
 * wait behind it, so they land in the order the effect named them (as `tuckOrAnnounce`).
 *
 * Returns how many cards were given at once. `countOn` is the giving frame's "given this way" variable
 * (`<bind>.amount`): the caller adds the returned number to it, and each waiting card raises it by one if it lands
 * (`applyStatusBeingGiven`), before the giving ability's next effect reads it.
 */
export function giveStatusOrAnnounce(
  ctx: Ctx,
  gives: readonly StatusGive[],
  status: StatusName,
  by: StatusGiver,
  countOn?: { readonly frameId: FrameId; readonly name: string },
): number {
  const listens = listensForStatusBeingGiven(ctx.deps);
  const waiting: TriggerEvent[] = [];
  let given = 0;
  for (const { instanceId, count } of gives) {
    for (let i = 0; i < count; i++) {
      const event: BeingGiven = {
        kind: "statusBeingGiven",
        instanceId,
        status,
        sourceInstanceId: by.sourceInstanceId,
        playerId: by.playerId,
        ...(countOn ? { countOn } : {}),
      };
      const waits =
        waiting.length > 0 ||
        (listens && canTakeStatus(ctx.state, instanceId, status, ctx.deps) && heard(ctx.state, ctx.deps, event));
      if (waits) waiting.push(event);
      else if (giveStatus(ctx, instanceId, status, by)) given += 1;
    }
  }
  if (waiting.length > 0) pushEvents(ctx, waiting);
  return given;
}

/** Whether a waiting give still has a card to place: its character is in play with room for it (RRG 1.8 p. 41). */
export const statusStillToGive = (ctx: Ctx, event: BeingGiven): boolean =>
  canTakeStatus(ctx.state, event.instanceId, event.status, ctx.deps);

/**
 * A `statusBeingGiven` whose interrupts have resolved: the card is given now. Returns whether one was placed; an
 * interrupt that filled the character's room, or took it out of play, leaves nothing to give.
 */
export function applyStatusBeingGiven(ctx: Ctx, event: BeingGiven): boolean {
  const by = { sourceInstanceId: event.sourceInstanceId, playerId: event.playerId };
  if (!giveStatus(ctx, event.instanceId, event.status, by)) return false;
  if (event.countOn) addFrameVars(ctx, event.countOn.frameId, { [event.countOn.name]: 1 });
  return true;
}
