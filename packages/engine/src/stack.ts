import type { AbilityId } from "@mc/content";
import type { AbilitySource } from "./abilities.js";
import type { FrameId, InstanceId, PlayerId } from "./ids.js";
import type { EffectSpec } from "./spec.js";
import type { TriggerEvent } from "./trigger-events.js";

/**
 * The resolution stack. `state.stack[0]` is what is resolving right now;
 * everything after it is queued. Frames are plain data with an explicit cursor
 * so resolution can suspend on a `PendingChoice` and resume exactly where it
 * left off — `runFlow` steps the top frame the same way it steps `state.step`.
 */

/** Which half of a timing window a trigger window is filling. */
export type WindowTiming = "interrupt" | "response";

/** One candidate ability waiting to be resolved inside a trigger window. */
export interface TriggerCandidate {
  readonly instanceId: InstanceId;
  readonly abilityId: AbilityId;
  readonly controllerId: PlayerId | null;
  readonly forced: boolean;
  /** An event card played from hand inside this window; it still has to be paid for. */
  readonly fromHand: boolean;
}

export const candidateOf = (source: AbilitySource, forced: boolean): TriggerCandidate => ({
  instanceId: source.instanceId,
  abilityId: source.abilityId,
  controllerId: source.controllerId,
  forced,
  fromHand: false,
});

/** Slot bindings produced by `chooseTarget`, carried through an effect program. */
export type Bindings = Readonly<Record<string, readonly InstanceId[]>>;

/** Named numbers bound while an ability resolves (cost results, "X", paid resources, effect results). */
export type Vars = Readonly<Record<string, number>>;

/** Where an event frame reports its results when it finishes: `<prefix>.<key>` is added to that frame's vars. */
export interface ReportTarget {
  readonly frameId: FrameId;
  readonly prefix: string;
}

/** Effects waiting for a timing point ("at the end of this attack"), with the context that created them. */
export interface DeferredEffects {
  readonly effects: readonly EffectSpec[];
  readonly selfInstanceId: InstanceId | null;
  readonly controllerId: PlayerId | null;
  readonly bindings: Bindings;
  readonly vars: Vars;
}

interface FrameBase {
  readonly frameId: FrameId;
  /** Selections fed back by `resolveChoice`; the frame reads and clears it. */
  readonly answer: readonly string[] | null;
}

export type StackFrame =
  /** An event with its interrupt window, its state change, and its response window. */
  | (FrameBase & {
      readonly kind: "event";
      readonly event: TriggerEvent;
      readonly stage: "interrupts" | "apply" | "responses" | "done";
      readonly cancelled: boolean;
      /** Results accumulated while the event resolves (see `TriggerEvent.results`). */
      readonly vars: Vars;
      /** Cards the event's results name (`damaged`, `target`), reported as slots like `vars`. */
      readonly slots: Bindings;
      readonly reportTo: ReportTarget | null;
      /** "At the end of this attack" effects, run after the response window. */
      readonly endEffects: readonly DeferredEffects[];
    })
  /** Gathers, orders, and runs the triggered abilities for one timing window. */
  | (FrameBase & {
      readonly kind: "window";
      readonly event: TriggerEvent;
      readonly timing: WindowTiming;
      readonly eventFrameId: FrameId | null;
      /** Index into the priority tier list for this timing (RRG "Simultaneous Timing Priority"). */
      readonly tierIndex: number;
      readonly queue: readonly TriggerCandidate[];
      /** Optional tiers ask each controller in player order; this is who is left to ask. */
      readonly askingPlayerIds: readonly PlayerId[];
      readonly pending: readonly TriggerCandidate[];
      readonly awaiting: "order" | "select" | "pay" | null;
      /** The in-hand event whose cost the window is currently collecting. */
      readonly paying: TriggerCandidate | null;
    })
  /** Resolves one ability: checks its limit, records the use, runs its effects. */
  | (FrameBase & {
      readonly kind: "ability";
      readonly instanceId: InstanceId;
      readonly abilityId: AbilityId;
      readonly controllerId: PlayerId | null;
      readonly event: TriggerEvent | null;
      readonly eventFrameId: FrameId | null;
      /** What paying the ability's cost bound (chosen cards, X, paid resources). */
      readonly bindings: Bindings;
      readonly vars: Vars;
    })
  /** Runs an `EffectSpec` program with a cursor and slot bindings. */
  | (FrameBase & {
      readonly kind: "effects";
      readonly effects: readonly EffectSpec[];
      readonly cursor: number;
      readonly bindings: Bindings;
      readonly vars: Vars;
      /** "That player" inside `forEachPlayer`. */
      readonly scopedPlayerId: PlayerId | null;
      readonly selfInstanceId: InstanceId | null;
      readonly controllerId: PlayerId | null;
      readonly event: TriggerEvent | null;
      readonly eventFrameId: FrameId | null;
    })
  /** RRG "Attack (Enemy Activation)" steps 1–5; step 6 is the event frame's response window. */
  | (FrameBase & {
      readonly kind: "enemyAttack";
      readonly enemyInstanceId: InstanceId;
      readonly attackedPlayerId: PlayerId;
      readonly targetPlayerId: PlayerId;
      readonly targetInstanceId: InstanceId;
      readonly defenderInstanceId: InstanceId | null;
      /** A defender declared in the Declare Defender step (DEF reduces damage); false for a "(defense)" ability. */
      readonly basicDefense: boolean;
      readonly boostIcons: number;
      readonly stage: "giveBoost" | "declareDefender" | "flipBoosts" | "dealDamage" | "done";
      /** The `enemyAttack` event frame this procedure belongs to. */
      readonly eventFrameId: FrameId | null;
    })
  /** RRG "Scheme (Enemy Activation)". */
  | (FrameBase & {
      readonly kind: "enemyScheme";
      readonly enemyInstanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly boostIcons: number;
      readonly stage: "giveBoost" | "flipBoosts" | "placeThreat" | "done";
      readonly eventFrameId: FrameId | null;
    })
  /** RRG "Reveal" steps 1–4. */
  | (FrameBase & {
      readonly kind: "reveal";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      /** "Cancel its When Revealed effects" (incite and surge are When Revealed effects too). */
      readonly whenRevealedCancelled: boolean;
      /** "Cancel the effects of that card and discard it": it is still revealed, nothing else happens. */
      readonly effectsCancelled: boolean;
      /** "This card gains surge" resolved while it was being revealed. */
      readonly surgeGained: boolean;
      readonly stage: "faceup" | "enterPlay" | "whenRevealed" | "finish" | "done";
    })
  /** RRG "Initiating Abilities" steps 6–7, after costs are paid. */
  | (FrameBase & {
      readonly kind: "playCard";
      readonly instanceId: InstanceId;
      readonly playerId: PlayerId;
      /** Who controls the card once it's in play ("Play under any player's control"); usually `playerId`. */
      readonly controllerId: PlayerId;
      readonly attachToInstanceId: InstanceId | null;
      readonly stage: "enterPlay" | "effects" | "discardEvent" | "done";
      /** Set when an event was played inside a timing window: only this ability resolves. */
      readonly triggeredAbilityId: AbilityId | null;
      readonly event: TriggerEvent | null;
      readonly eventFrameId: FrameId | null;
      /** Cost results handed to the card's abilities (`paid.<type>`, discarded cards, …). */
      readonly bindings: Bindings;
      readonly vars: Vars;
    });

export type StackFrameKind = StackFrame["kind"];

/**
 * The event frame of the attack or activation currently resolving ("this
 * attack", "this activation"): the topmost `attack` / `enemyAttack` /
 * `enemyScheme` event on the stack.
 */
export function currentActivationFrameId(stack: readonly StackFrame[]): FrameId | null {
  for (const frame of stack) {
    if (frame.kind !== "event") continue;
    const kind = frame.event.kind;
    if (kind === "attack" || kind === "enemyAttack" || kind === "enemyScheme" || kind === "thwart") return frame.frameId;
  }
  return null;
}

/** A client-facing summary of what is resolving and what is queued. */
export interface StackView {
  readonly frameId: FrameId;
  readonly kind: StackFrameKind;
  readonly description: string;
}

export function describeFrame(frame: StackFrame): string {
  switch (frame.kind) {
    case "event":
      return `${frame.event.kind} (${frame.stage})`;
    case "window":
      return `${frame.timing} window for ${frame.event.kind}`;
    case "ability":
      return `ability ${frame.abilityId} on ${frame.instanceId}`;
    case "effects":
      return `effects ${frame.cursor}/${frame.effects.length}`;
    case "enemyAttack":
      return `enemy attack by ${frame.enemyInstanceId} (${frame.stage})`;
    case "enemyScheme":
      return `enemy scheme by ${frame.enemyInstanceId} (${frame.stage})`;
    case "reveal":
      return `reveal ${frame.instanceId} (${frame.stage})`;
    case "playCard":
      return `play ${frame.instanceId} (${frame.stage})`;
  }
}

export const viewStack = (stack: readonly StackFrame[]): readonly StackView[] =>
  stack.map((frame) => ({ frameId: frame.frameId, kind: frame.kind, description: describeFrame(frame) }));
