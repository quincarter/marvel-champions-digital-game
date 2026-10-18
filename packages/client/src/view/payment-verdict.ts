/**
 * The engine's verdict on a payment selection: the command it accepts, or why it refuses, and whether the cost is
 * covered without the overpay-only picks.
 *
 * Apart from `payment-model.ts` because this is the costly half of the pay step: `tryPayment` plays the whole card out
 * (`applyCommand`) to answer "is this enough?". The engine worker runs it against its full game state
 * (`EngineSessionCore#judgePayment`, issue #258), so a tap while paying never blocks the main thread; the pips, labels
 * and discard order stay in `paymentView`, which is cheap. An in-thread host (`LocalEngineHost`, tests) calls it
 * directly.
 */

import type { AbilityId } from "@mc/content";
import {
  tryPayment,
  type Command,
  type CostChoices,
  type CostSelection,
  type EngineDeps,
  type GameState,
  type InstanceId,
  type PlayerId,
} from "@mc/engine";
import { tryReducedPlay } from "./cost-reduction-model.js";
import type { PaymentState } from "./payment-model.js";

export interface PaymentVerdict {
  /** The command to send, when the engine accepts this exact selection. */
  readonly command: Command | null;
  /** The engine's reason while it does not. */
  readonly blockedBy: string | null;
  /** The picks that count toward the cost are accepted without the overpay-only ones (Mr. Hollywood). */
  readonly covered: boolean;
}

/** A verdict and the game version (command count) it was judged at: one for an older version is never used. */
export interface JudgedPayment {
  readonly version: number;
  readonly verdict: PaymentVerdict;
}

export const paymentContext = (
  target: InstanceId | null,
  controllerId: PlayerId | null | undefined,
  costSelection?: CostSelection,
  costChoices?: CostChoices,
  abilityId?: AbilityId,
  into?: string,
  x?: number,
) => ({
  target,
  ...(x !== undefined ? { x } : {}),
  ...(controllerId ? { controllerId } : {}),
  ...(costSelection ? { costSelection } : {}),
  ...(costChoices ? { costChoices } : {}),
  ...(abilityId ? { abilityId } : {}),
  ...(into !== undefined ? { into } : {}),
});

export function judgePayment(
  state: GameState,
  playerId: PlayerId,
  payment: PaymentState,
  deps: EngineDeps,
): PaymentVerdict {
  const { action, query, picked } = payment;
  const attemptWith = (ids: readonly string[]) =>
    action.kind === "playCard" && payment.reductions.length > 0
      ? tryReducedPlay(
          state,
          playerId,
          action.instanceId,
          ids,
          query.sources,
          payment.reductions,
          deps,
          payment.target,
          payment.controllerId ?? null,
          payment.costSelection,
          payment.costChoices,
          payment.abilityId,
          payment.x,
        )
      : tryPayment(
          state,
          playerId,
          action,
          ids,
          paymentContext(
            payment.target,
            payment.controllerId,
            payment.costSelection,
            payment.costChoices,
            payment.abilityId,
            payment.into,
            payment.x,
          ),
          deps,
        );
  const attempt = attemptWith(picked);
  // The cost is covered when the picks that count toward it are accepted without the overpay-only ones. With none of
  // those picked, that is the same selection, so the engine is asked once.
  const overpayOnly = new Set(query.sources.filter((source) => source.overpayOnly).map((source) => source.optionId));
  const counted = picked.filter((id) => !overpayOnly.has(id));
  const covered = counted.length === picked.length ? attempt.ok : attemptWith(counted).ok;
  return {
    command: attempt.ok ? attempt.command : null,
    blockedBy: attempt.ok ? null : attempt.message,
    covered,
  };
}
