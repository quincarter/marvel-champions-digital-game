/**
 * What an interrupt on offer would prevent of the damage about to be dealt (#394): Backflip's "prevent all of that
 * damage" against Rhino's 3 is stamped "PREVENTS 3 DAMAGE" on the window. Read off the ability's own `preventDamage`
 * effect and the window's `dealDamage` event with the engine's own `resolveValue`, never guessed: an amount the player
 * only fixes by playing it (an X paid, counters removed as its cost) or a prevention behind a choice shows nothing.
 */
import type { AbilityId } from "@mc/content";
import { activeAbilityRefs, applyCommand, remainingHitPoints, resolveValue } from "@mc/engine";
import type { EngineDeps, EffectContext, GameState, InstanceId, StackFrame, ValueSpec } from "@mc/engine";
import { cardName, shortSeatName } from "./names.js";

/** A value read from what playing the ability binds (`var`: an X paid, an amount removed as its cost) is not known yet. */
function readsPlayTimeVars(value: ValueSpec): boolean {
  const walk = (node: unknown): boolean =>
    typeof node === "object" &&
    node !== null &&
    ((node as { kind?: unknown }).kind === "var" || Object.values(node).some(walk));
  return walk(value);
}

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

/** The open damage window: its choice, and the live event it is about (an earlier interrupt may have changed it). */
interface DamageWindow {
  readonly choice: NonNullable<GameState["pendingChoice"]>;
  readonly event: Extract<NonNullable<StackFrame & { kind: "event" }>["event"], { kind: "dealDamage" }>;
  /** The event's frame on the stack, which the window's answer resolves; null when it can't be found. */
  readonly frameIndex: number | null;
}

function damageWindowOf(state: GameState): DamageWindow | null {
  const choice = state.pendingChoice;
  if (choice?.prompt.kind !== "chooseTriggers" || choice.prompt.event.kind !== "dealDamage") return null;
  // The prompt keeps the event as the window opened; the engine reads the pending amount off the event's own frame
  // once an earlier interrupt in the window has changed it (window.ts `answered`), so this does too.
  const window = state.stack.find((f) => f.frameId === choice.frameId);
  const eventFrameId = window?.kind === "window" ? window.eventFrameId : null;
  const index = eventFrameId ? state.stack.findIndex((f) => f.frameId === eventFrameId) : -1;
  const frame = index >= 0 ? state.stack[index] : undefined;
  if (frame?.kind === "event" && frame.event.kind === "dealDamage")
    return { choice, event: frame.event, frameIndex: index };
  return { choice, event: choice.prompt.event, frameIndex: null };
}

/**
 * The damage the window's event would have its target take if the window closed with `amount` left to deal: the engine
 * itself answers, by declining the window on a copy of the game, so tough, constant reductions, caps, doubling and an
 * attack's own prevention (Brazen Defense) all count as they will. Only that event's own resolution is read, up to its
 * frame being popped, never what the rest of the command goes on to do (a card not yet revealed). Null when its frame
 * can't be found or the command stops before it resolves (another window opens first).
 */
function takenIf(state: GameState, deps: EngineDeps, window: DamageWindow, amount: number): number | null {
  // Damage of 0 is never taken (RRG 1.8 "Prevent", p. 35): nothing to simulate.
  if (amount <= 0) return 0;
  if (window.frameIndex === null) return null;
  const frame = state.stack[window.frameIndex]!;
  if (frame.kind !== "event" || frame.event.kind !== "dealDamage") return null;
  const eventFrameId = frame.frameId;
  const damage = frame.event;
  // What the interrupt leaves of it, as `preventDamage` writes it.
  const copy =
    amount === damage.amount
      ? state
      : {
          ...state,
          stack: state.stack.map((f, i) =>
            i === window.frameIndex
              ? { ...frame, event: { ...damage, amount, dealt: damage.dealt ?? damage.amount } }
              : f,
          ),
        };
  const { choice } = window;
  const result = applyCommand(
    copy,
    { type: "resolveChoice", playerId: choice.playerId, choiceId: choice.choiceId, selectedOptionIds: [] },
    deps,
  );
  if (!result.ok) return null;
  for (const e of result.events) {
    if (e.type === "damageDealt" && e.targetInstanceId === damage.targetInstanceId) return e.amount;
    if (e.type === "framePopped" && e.frameId === eventFrameId) return 0;
  }
  return null;
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

/** Per game state and option: the preview runs the engine twice, and the panel redraws on every pick and resize. */
const previews = new WeakMap<GameState, Map<string, PreventionPreview | null>>();

export function preventionPreviewOf(
  state: GameState,
  deps: EngineDeps,
  option: { readonly instanceId: InstanceId; readonly abilityId: AbilityId | null },
): PreventionPreview | null {
  const key = `${option.instanceId}/${option.abilityId ?? ""}`;
  let cached = previews.get(state);
  if (cached?.has(key)) return cached.get(key)!;
  const preview = computePreview(state, deps, option);
  if (!cached) previews.set(state, (cached = new Map()));
  cached.set(key, preview);
  return preview;
}

function computePreview(
  state: GameState,
  deps: EngineDeps,
  option: { readonly instanceId: InstanceId; readonly abilityId: AbilityId | null },
): PreventionPreview | null {
  const window = damageWindowOf(state);
  if (!window) return null;
  const { event } = window;
  // Unpreventable damage (§H3.3) takes no prevention, though an interrupt with another effect is still offered on it.
  if (event.unpreventable === true) return null;
  const incoming = event.amount;
  if (incoming <= 0) return null;
  // "Self" reads the card on offer where it is now: in hand for an event, in play for a support or upgrade.
  const context: EffectContext = {
    selfInstanceId: option.instanceId,
    controllerId: window.choice.playerId,
    event,
    bindings: {},
    deps,
  };
  const amount = preventAmountOf(state, deps, option.instanceId, option.abilityId, context);
  if (amount === null) return null;
  const prevented = amount === "all" ? incoming : Math.min(incoming, Math.max(0, amount));
  if (prevented <= 0) return null;
  return { incoming, prevented, hp: hpPreviewOf(state, deps, window, incoming - prevented) };
}

function hpPreviewOf(state: GameState, deps: EngineDeps, window: DamageWindow, left: number): HpPreview | null {
  const target = window.event.targetInstanceId;
  const now = remainingHitPoints(state, target, deps);
  if (now === undefined) return null;
  const without = takenIf(state, deps, window, window.event.amount);
  const withIt = takenIf(state, deps, window, left);
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
