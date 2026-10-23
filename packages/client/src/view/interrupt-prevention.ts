/**
 * What an interrupt on offer would prevent of the damage about to be dealt (#394): Backflip's "prevent all of that
 * damage" against Rhino's 3 is stamped "PREVENTS 3 DAMAGE" on the window. Read off the ability's own `preventDamage`
 * effect and the window's `dealDamage` event with the engine's own `resolveValue`, never guessed: an amount the player
 * only fixes by playing it (an X paid, counters removed as its cost) or a prevention behind a choice shows nothing.
 */
import type { AbilityId } from "@mc/content";
import { activeAbilityRefs, applyCommand, remainingHitPoints, resolveValue } from "@mc/engine";
import type { EngineDeps, EffectContext, GameEvent, GameState, InstanceId, ValueSpec } from "@mc/engine";
import { cardName, shortSeatName } from "./names.js";

/** A value read from what playing the ability binds (`var`: an X paid, an amount removed as its cost) is not known yet. */
const readsPlayTimeVars = (value: ValueSpec): boolean => JSON.stringify(value).includes('"kind":"var"');

export interface PreventionPreview {
  /** The damage about to be dealt. */
  readonly incoming: number;
  /** How much of it the interrupt prevents. */
  readonly prevented: number;
  /** The hit points it lands on, now, if the window resolves, and with the interrupt; null where the engine can't say. */
  readonly hp: HpPreview | null;
}

export interface HpPreview {
  /** The character the damage is dealt to: a hero by its short name, "Spider-Man". */
  readonly targetName: string;
  readonly now: number;
  readonly ifResolves: number;
  readonly withInterrupt: number;
}

/** The events `applyDamage` emits about a target on the way to the damage it takes, before or instead of `damageDealt`. */
const ON_THE_WAY = new Set<GameEvent["type"]>(["damagePrevented", "damageCapped", "damageDoubled"]);

/**
 * The damage the window's event would have its target take if the window closed with `amount` left to deal: the engine
 * itself answers, by declining the window on a copy of the game, so tough, constant reductions, caps, doubling and an
 * attack's own prevention (Brazen Defense) all count as they will. Null when the damage does not land in that command
 * (another window opens first).
 */
function takenIf(state: GameState, deps: EngineDeps, amount: number): number | null {
  const choice = state.pendingChoice!;
  if (choice.prompt.kind !== "chooseTriggers" || choice.prompt.event.kind !== "dealDamage") return null;
  const event = choice.prompt.event;
  let copy = state;
  if (amount !== event.amount) {
    // The window's own damage event, on top of the stack, with what the interrupt leaves of it (as `preventDamage` does).
    let index = -1;
    state.stack.forEach((f, i) => {
      if (
        f.kind === "event" &&
        f.event.kind === "dealDamage" &&
        f.event.targetInstanceId === event.targetInstanceId &&
        f.event.amount === event.amount
      )
        index = i;
    });
    const frame = state.stack[index];
    if (frame?.kind !== "event" || frame.event.kind !== "dealDamage") return null;
    const patched = { ...frame, event: { ...frame.event, amount, dealt: frame.event.dealt ?? event.amount } };
    copy = { ...state, stack: state.stack.map((f, i) => (i === index ? patched : f)) };
  }
  const result = applyCommand(
    copy,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: [] },
    deps,
  );
  if (!result.ok) return null;
  let started = false;
  for (const e of result.events) {
    const aboutTarget = "targetInstanceId" in e && e.targetInstanceId === event.targetInstanceId;
    if (aboutTarget && e.type === "damageDealt") return e.amount;
    if (aboutTarget && ON_THE_WAY.has(e.type)) started = true;
    else if (started) return 0;
  }
  return started ? 0 : amount <= 0 ? 0 : null;
}

/**
 * How much the ability on offer prevents (or the card's own preventing ability when the option is the card), read now:
 * "all", a number from the live state ("equal to your DEF", "the counters on this card"), or null when unknown.
 */
function preventAmountOf(
  state: GameState,
  deps: EngineDeps,
  instanceId: InstanceId,
  abilityId: AbilityId | null,
  context: EffectContext,
): number | "all" | null {
  const ids = abilityId ? [abilityId] : activeAbilityRefs(state, instanceId, deps).map((ref) => ref.id);
  for (const id of ids) {
    const effect = deps.abilities[id]?.effects.find((e) => e.kind === "preventDamage");
    if (effect?.kind !== "preventDamage") continue;
    if (effect.amount === undefined) return "all";
    if (readsPlayTimeVars(effect.amount)) return null;
    try {
      return resolveValue(state, effect.amount, context, deps);
    } catch {
      return null;
    }
  }
  return null;
}

export function preventionPreviewOf(
  state: GameState,
  deps: EngineDeps,
  option: { readonly instanceId: InstanceId; readonly abilityId: AbilityId | null },
): PreventionPreview | null {
  const prompt = state.pendingChoice?.prompt;
  if (prompt?.kind !== "chooseTriggers" || prompt.event.kind !== "dealDamage") return null;
  // Unpreventable damage (§H3.3) takes no prevention, though an interrupt with another effect is still offered on it.
  if (prompt.event.unpreventable === true) return null;
  const incoming = prompt.event.amount;
  if (incoming <= 0) return null;
  const context: EffectContext = {
    selfInstanceId: option.instanceId,
    controllerId: state.pendingChoice!.playerId,
    event: prompt.event,
    bindings: {},
    deps,
  };
  const amount = preventAmountOf(state, deps, option.instanceId, option.abilityId, context);
  if (amount === null) return null;
  const prevented = amount === "all" ? incoming : Math.min(incoming, Math.max(0, amount));
  if (prevented <= 0) return null;
  return { incoming, prevented, hp: hpPreviewOf(state, deps, incoming - prevented) };
}

function hpPreviewOf(state: GameState, deps: EngineDeps, left: number): HpPreview | null {
  const prompt = state.pendingChoice?.prompt;
  if (prompt?.kind !== "chooseTriggers" || prompt.event.kind !== "dealDamage") return null;
  const target = prompt.event.targetInstanceId;
  const now = remainingHitPoints(state, target, deps);
  if (now === undefined) return null;
  const without = takenIf(state, deps, prompt.event.amount);
  const withIt = takenIf(state, deps, left);
  if (without === null || withIt === null) return null;
  const seat = state.players.find((player) => player.identity.instanceId === target);
  return {
    targetName: seat ? shortSeatName(state, seat.playerId, null) : cardName(state, target),
    now,
    ifResolves: Math.max(0, now - without),
    withInterrupt: Math.max(0, now - withIt),
  };
}

/** The stamp's big line: "2 damage", or "1 of 3 damage" when the interrupt prevents only part of it. */
export function preventedAmountLine(preview: Pick<PreventionPreview, "incoming" | "prevented">): string {
  return preview.prevented >= preview.incoming
    ? `${preview.prevented} damage`
    : `${preview.prevented} of ${preview.incoming} damage`;
}
