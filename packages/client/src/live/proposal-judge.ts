/**
 * The host's first look at a seat holder's proposal (issue #881, docs/live-game-rooms.md section 9), as a pure function:
 * is it built on the table as it is, is the table waiting on that person, is the command theirs to make. It is a gate in
 * front of the engine, never a replacement for it: whatever passes here is still dispatched through the engine's own
 * validation, and a command the engine rejects is refused `illegal`.
 */
import type { Command, GameState, PlayerId } from "@mc/engine";
import type { ProposalRefusal } from "@mc/sync-worker/room-protocol";
import { actingPlayer } from "../engine/acting-player.js";

export type ProposalVerdict = { readonly ok: true } | { readonly ok: false; readonly reason: ProposalRefusal };

export interface ProposalCheck {
  /** The table now: the game's outcome, open choice and step. */
  readonly state: Pick<GameState, "outcome" | "pendingChoice" | "step">;
  /** The host's command count. */
  readonly count: number;
  /** What the proposal was built on. */
  readonly base: number;
  /** The engine players behind the seats the proposer may act for. */
  readonly players: readonly string[];
  /** The proposal, as it came off the wire (anything). */
  readonly command: unknown;
  /** The room's mode: a Manual adjust is never a proposal (it is a request the host performs). */
  readonly strict: boolean;
}

const asCommand = (value: unknown): Command | null => {
  if (typeof value !== "object" || value === null) return null;
  const { type, playerId } = value as { type?: unknown; playerId?: unknown };
  return typeof type === "string" && typeof playerId === "string" ? (value as Command) : null;
};

export function judgeProposal(check: ProposalCheck): ProposalVerdict {
  const { state, count, base, players, strict } = check;
  if (base !== count) return { ok: false, reason: "stale" };
  const command = asCommand(check.command);
  if (!command) return { ok: false, reason: "illegal" };
  // Adjusting the table is the host's own act, after it accepts a request: a seat never proposes one.
  if (command.type === "adjust") return { ok: false, reason: strict ? "strict" : "illegal" };
  const acting = actingPlayer(state);
  if (acting === null || players.length === 0) return { ok: false, reason: "not-your-turn" };
  const mine = (id: string): boolean => players.includes(id);
  if (!mine(command.playerId)) {
    // Acting as a hero the proposer's seats are not: another seat's turn is "not yours", a forged id is not legal.
    return { ok: false, reason: mine(acting) ? "illegal" : "not-your-turn" };
  }
  if (command.playerId === (acting as PlayerId)) return { ok: true };
  // A seat the table is not waiting on: only an off-turn Action in a player turn can be legal, and the engine judges it.
  if (!state.pendingChoice && state.step.phase === "player" && state.step.kind === "turn") return { ok: true };
  return { ok: false, reason: "not-your-turn" };
}
