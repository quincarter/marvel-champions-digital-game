/**
 * What was made for "the next villain phase" once the villain phase about to place step one's threat had begun (PR #923
 * review P1). The phase has begun once its beginning's interrupt window is open (`phaseBeginning` villain past its
 * `interrupts` stage, `resolve/event.ts`); from then on "the next villain phase" is the one after it. A skip, a
 * replacement by a player phase, or an "until the next villain phase begins" effect made by that beginning (a "When the
 * villain phase begins" ability) is therefore left to the next villain phase, while one made before it (under the
 * player phase's end, beneath which the beginning was pushed) is still this phase's, taken at step one's place
 * (`flow.ts` `skipsVillainPhaseNow`). A skipped phase never begins (docs/phase7-wave11-hero-packs.md H3.7/H3.8; 61020
 * "(unskipped)"; RRG 1.8 "Lasting Effects", p. 26).
 *
 * Kept in `GameState.madeSinceVillainPhaseBegan`, which is absent unless such a thing was made, and removed at step
 * one's place, so a game where nothing is made then keeps exactly the state and events it had before.
 */

import type { Ctx } from "./ctx.js";
import type { GameState } from "./state.js";
import type { TeamId } from "./ids.js";

/** Whether the villain phase's beginning has opened its window and was not cancelled: the phase has begun. */
export const villainPhaseBeginningOpen = (state: GameState): boolean =>
  state.stack.some(
    (frame) =>
      frame.kind === "event" &&
      frame.event.kind === "phaseBeginning" &&
      frame.event.phase === "villain" &&
      frame.stage !== "interrupts" &&
      !frame.cancelled,
  );

/** Whether a request or effect of `team` (null: a game with no teams) is for the phase that is beginning's team. */
const forThisPhase = (state: GameState, team: TeamId | null | undefined): boolean =>
  state.activeTeamId === undefined ? team == null : team === state.activeTeamId;

/** A skip or replacement of `team`'s next villain phase was just counted: noted if this phase had already begun. */
export function noteRequestSinceVillainPhaseBegan(ctx: Ctx, which: "skip" | "replace", team: TeamId | null): void {
  if (!forThisPhase(ctx.state, team) || !villainPhaseBeginningOpen(ctx.state)) return;
  const made = ctx.state.madeSinceVillainPhaseBegan ?? {};
  ctx.state = { ...ctx.state, madeSinceVillainPhaseBegan: { ...made, [which]: (made[which] ?? 0) + 1 } };
}

/** An "until the next villain phase begins" effect (`id`, of `team`) was just made: noted if this phase had begun. */
export function noteLastingSinceVillainPhaseBegan(ctx: Ctx, id: string, team: TeamId | undefined): void {
  if (team !== undefined && team !== ctx.state.activeTeamId) return;
  if (!villainPhaseBeginningOpen(ctx.state)) return;
  const made = ctx.state.madeSinceVillainPhaseBegan ?? {};
  ctx.state = {
    ...ctx.state,
    madeSinceVillainPhaseBegan: { ...made, lastingEffectIds: [...(made.lastingEffectIds ?? []), id] },
  };
}

/** Forgets what was noted: at step one's place, or when the beginning is cancelled (the phase never began). */
export function clearMadeSinceVillainPhaseBegan(ctx: Ctx): void {
  if (ctx.state.madeSinceVillainPhaseBegan === undefined) return;
  const { madeSinceVillainPhaseBegan: _made, ...rest } = ctx.state;
  ctx.state = rest;
}
