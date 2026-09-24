import type { AbilityId } from "@mc/content";
import type { AbilitySource } from "./abilities.js";
import type { CostChoices } from "./commands.js";
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

/**
 * The boost card an activation is resolving (RRG 1.8 "Boost", p. 11): `window` while its `boostCardTurnedFaceup` event
 * resolves, `ability` while its "Boost" ability resolves. Its icons are added and it is discarded after that.
 */
export interface BoostInProgress {
  readonly instanceId: InstanceId;
  /** `count`: its icons are about to be counted (`boostIconsCounting`; docs/phase7-wave2.md §3.6). */
  readonly step: "window" | "ability" | "count";
  readonly iconsCancelled: boolean;
  readonly abilityCancelled: boolean;
  /** "Increase or decrease the number of boost icons on that card by 1 for this count" (`adjustBoostCount`). */
  readonly countAdjust?: number;
  /** "Count the number of boost icons on that card instead" (`replaceBoostCount`): the card whose icons are counted. */
  readonly countFrom?: InstanceId;
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
      /**
       * Events whose *response* window was deferred to the end of this activation: RRG 1.8 "Defend, Defense" (p. 16),
       * "Abilities that trigger after a character defends an attack resolve after that attack ends." Only an
       * activation event frame (`enemyAttack`) carries these; `resolve/event.ts` opens them in its `done` stage.
       */
      readonly deferredResponses?: readonly TriggerEvent[];
      /**
       * A member of a simultaneous `damageGroup`: this frame runs only the interrupt window, then hands its (possibly
       * prevented or cancelled) event back to the group at `index`, which applies it with the others.
       */
      readonly group?: { readonly frameId: FrameId; readonly index: number };
    })
  /**
   * Damage events resolved simultaneously (RRG 1.8 "Indirect Damage", p. 24: "All indirect damage from a single source
   * is first assigned and then resolved simultaneously"): every member's interrupt window in order, then every
   * member's damage followed by one defeat sweep, then every member's response window.
   */
  | (FrameBase & {
      readonly kind: "damageGroup";
      readonly members: readonly {
        readonly event: Extract<TriggerEvent, { kind: "dealDamage" }>;
        readonly cancelled: boolean;
        /** What applying it did (`amount` taken, `excessDealt`), for its response window's results. */
        readonly vars: Vars;
      }[];
      readonly stage: "interrupts" | "apply" | "responses" | "done";
      readonly cursor: number;
      readonly reportTo: ReportTarget | null;
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
      readonly awaiting: "order" | "select" | "pay" | "costPick" | null;
      /** The in-hand event whose cost the window is currently collecting. */
      readonly paying: TriggerCandidate | null;
      /**
       * The cards in play the player picked so far for the queued candidate's cost ("exhaust an [Avenger] character
       * and a [Guardian] character", docs/phase7-wave4.md §3.17), keyed by `<instanceId>:<abilityId>` so picks never
       * outlive their candidate. Absent until a window asks for one.
       */
      readonly costPicks?: { readonly key: string; readonly choices: CostChoices; readonly asking?: string };
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
      /** No boost card for this attack (`TriggerEvent.noBoost`). */
      readonly noBoost?: boolean;
      readonly boost?: BoostInProgress | null;
    })
  /** RRG "Scheme (Enemy Activation)". */
  | (FrameBase & {
      readonly kind: "enemyScheme";
      readonly enemyInstanceId: InstanceId;
      readonly playerId: PlayerId;
      readonly boostIcons: number;
      readonly stage: "giveBoost" | "flipBoosts" | "placeThreat" | "done";
      readonly eventFrameId: FrameId | null;
      readonly noBoost?: boolean;
      readonly boost?: BoostInProgress | null;
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
      readonly stage: "enterPlay" | "effects" | "abilities" | "discardEvent" | "done";
      /**
       * RRG 1.8 "Cancel" (p. 13): a Forced Interrupt on `cardBeingPlayed` cancelled this card's effects
       * ("When you play an event, cancel its effects and discard it", Counterspell, `drs` pack). The card is still
       * considered played and is still discarded — only its own abilities are prevented from initiating.
       */
      readonly effectsCancelled: boolean;
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
    // `enemyAttacksEnemy` is an attack, so "this attack" names it, though not an activation (docs/phase7-wave3.md §3.23).
    if (
      kind === "attack" ||
      kind === "enemyAttack" ||
      kind === "enemyScheme" ||
      kind === "thwart" ||
      kind === "enemyAttacksEnemy"
    )
      return frame.frameId;
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
    case "damageGroup":
      return `simultaneous damage to ${frame.members.length} character(s) (${frame.stage})`;
  }
}

export const viewStack = (stack: readonly StackFrame[]): readonly StackView[] =>
  stack.map((frame) => ({ frameId: frame.frameId, kind: frame.kind, description: describeFrame(frame) }));
