/**
 * The accusation over an evidence grid (docs/phase7-wave9.md §3.29 (b)), in the two steps the cards print.
 *
 * MC50 p. 19, "The Accusation": "the players must make an accusation by choosing a combination of means, motive, and
 * opportunity that has not been crossed out in the campaign log. Each combination is listed underneath a board member.
 * This board member is the **accused**. Next, the players take the evidence cards from the A.I.M. envelope and find the
 * board member associated with the combination means, motive, and opportunity on those cards in the campaign log. This
 * board member is the **mole**. They compare the mole and its means, motive, and opportunity to their guesses." A
 * combination is crossed out when the players gain one of its cards (p. 18: "cross out all combinations of means,
 * motive, and opportunity in the campaign log that use the icon shown on the new evidence card").
 *
 * - `EffectSpec accuse` is the guess: a choice among the grid rows that are not crossed out, recorded in
 *   `GameState.accusation`. It reads no hidden pile.
 * - `EffectSpec identifyMole` turns the hidden pile faceup (`revealHiddenPile`), finds the row its cards make, and
 *   records the mole and which of the four guesses were wrong.
 *
 * The grid is plain data on the effect (card ids only), so the engine names no card, and what the two effects record
 * is state, because a later ability on another card reads it ("flip the mole").
 */

import type { CardId } from "@mc/content";
import { EVIDENCE_FIELDS, evidenceRowId, openEvidenceRows, wrongGuessesOf } from "../accusation.js";
import { type Ctx, emit, requestChoice, setFrame } from "../ctx.js";
import { EngineInvariantError } from "../errors.js";
import { type EffectContext, resolvePlayers } from "../select.js";
import type { EffectSpec } from "../spec.js";
import type { Accusation } from "../state.js";
import { effectChoiceAuthority } from "../villain/authority.js";
import type { Frame } from "./frames.js";
import { revealedPileCardsOf, revealHiddenPile } from "./hidden-piles.js";

const record = (ctx: Ctx, accusation: Accusation): void => {
  ctx.state = { ...ctx.state, accusation };
};

/**
 * `EffectSpec accuse`. The choice is parked on the frame like every other, and its answer is the recorded command. A
 * grid with one row left is no decision and is accused without asking; with none left, or no such player, nobody is
 * asked and nothing is recorded.
 */
export function executeAccuse(
  ctx: Ctx,
  frame: Frame<"effects">,
  effect: Extract<EffectSpec, { kind: "accuse" }>,
  context: EffectContext,
): void {
  const [playerId] = resolvePlayers(ctx.state, effect.player, context);
  const open = openEvidenceRows(ctx.state, effect.grid);
  const done = (): void => setFrame(ctx, { ...frame, answer: null, cursor: frame.cursor + 1 });
  if (!playerId || open.length === 0) return done();
  if (frame.answer === null && open.length > 1) {
    const name = (id: CardId): string => ctx.state.cardPool[id]?.name ?? id;
    requestChoice(ctx, {
      playerId,
      authority: effectChoiceAuthority(ctx.state, frame.selfInstanceId, effect.player),
      prompt: { kind: "accuse", grid: effect.grid, crossedOut: revealedPileCardsOf(ctx.state) },
      options: open.map((row) => ({
        optionId: evidenceRowId(row),
        label: `${name(row.means)}, ${name(row.motive)}, ${name(row.opportunity)}: ${name(row.boardMember)}`,
        ref: { kind: "cardDefinition", cardId: row.boardMember } as const,
      })),
      minSelections: 1,
      maxSelections: 1,
      frameId: frame.frameId,
    });
    return;
  }
  const answered = frame.answer === null ? evidenceRowId(open[0]!) : frame.answer[0];
  const accused = open.find((row) => evidenceRowId(row) === answered);
  if (!accused) throw new EngineInvariantError(`"${String(answered)}" is not a combination left to accuse`);
  done();
  // A new accusation replaces an earlier one whole: its mole was identified against the earlier guess.
  record(ctx, { accused });
  emit(ctx, { type: "accusationMade", playerId, accused });
}

/**
 * `EffectSpec identifyMole`: the pile `hidden` is turned faceup, and the row of `grid` made by the pile's cards (the
 * ones revealed now and any revealed out of it earlier) is the mole. With no such row (a pile that was never prepared,
 * or cards the grid does not list together) no mole is recorded and no guess is wrong; the log says so.
 */
export function identifyMole(ctx: Ctx, effect: Extract<EffectSpec, { kind: "identifyMole" }>): void {
  revealHiddenPile(ctx, effect.hidden);
  const cards = new Set<CardId>(revealedPileCardsOf(ctx.state, effect.hidden));
  const mole = effect.grid.find((row) => EVIDENCE_FIELDS.every((field) => cards.has(row[field])));
  const accused = ctx.state.accusation?.accused;
  const wrong = accused && mole ? wrongGuessesOf(accused, mole) : [];
  if (mole) record(ctx, { ...(accused ? { accused } : {}), mole, wrong });
  emit(ctx, { type: "moleIdentified", pile: effect.hidden, accused: accused ?? null, mole: mole ?? null, wrong });
}
