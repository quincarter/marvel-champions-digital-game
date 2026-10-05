/**
 * "For every minute you were away from the game" / "if you have not talked this phase" (docs/phase7-wave7.md §3.83):
 * the one effect that asks a player for a fact from outside the game.
 */

import type { ChoiceOption } from "../choices.js";
import { type Ctx, emit, requestChoice, setFrame } from "../ctx.js";
import { EngineInvariantError } from "../errors.js";
import { REPORT_NO, REPORT_YES, REPORTED_FACT_ANSWER, reportedNumberOf } from "../outside-facts.js";
import { type EffectContext, resolvePlayers } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { Frame } from "./frames.js";

const YES_NO: readonly ChoiceOption[] = [
  { optionId: REPORT_YES, label: "Yes", ref: { kind: "none" } },
  { optionId: REPORT_NO, label: "No", ref: { kind: "none" } },
];

/**
 * `EffectSpec reportFact`. The choice is parked on the frame like every other and waits as long as the client leaves
 * it open; its answer is the recorded command, so the fact is read from the log on a replay and never measured again.
 *
 * The authority is always `player`: the fact is the addressed player's own to report, whichever side's card asks.
 * A whole-number report has no option list (it has no upper bound); `resolveChoice` checks the answer's form instead.
 */
export function executeReportFact(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "reportFact" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const bind = (amount: number, made: boolean): void =>
    setFrame(ctx, {
      ...frame,
      answer: null,
      cursor: frame.cursor + 1,
      vars: { ...frame.vars, [`${effect.bind}.amount`]: amount, [`${effect.bind}.made`]: made ? 1 : 0 },
    });
  if (!playerId) return bind(0, false);
  const answer = REPORTED_FACT_ANSWER[effect.fact];
  if (frame.answer === null) {
    requestChoice(ctx, {
      playerId,
      authority: "player",
      prompt: { kind: "reportFact", fact: effect.fact, answer },
      options: answer === "yesNo" ? YES_NO : [],
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const [answered] = frame.answer;
  const amount =
    answer === "yesNo"
      ? answered === REPORT_YES
        ? 1
        : answered === REPORT_NO
          ? 0
          : null
      : reportedNumberOf(answered ?? "");
  if (amount === null) throw new EngineInvariantError(`"${answered}" is not a report of ${effect.fact}`);
  bind(amount, true);
  emit(ctx, { type: "factReported", playerId, fact: effect.fact, bind: effect.bind, amount });
}
