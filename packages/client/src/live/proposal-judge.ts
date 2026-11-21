/**
 * The host's first look at a seat holder's proposal (issue #881, docs/live-game-rooms.md section 9), as a pure function:
 * is it built on the table as it is, is the table waiting on that person, is the command theirs to make. It is a gate in
 * front of the engine, never a replacement for it: whatever passes here is still dispatched through the engine's own
 * validation, and a command the engine rejects is refused `illegal`.
 */
import type { Command, GameState, PlayerId } from "@mc/engine";
import type { ProposalRefusal } from "@mc/sync-worker/room-protocol";
import { actingPlayer } from "../engine/acting-player.js";

export type ProposalVerdict =
  | {
      readonly ok: true;
      /** The command rebuilt as plain data: what is dispatched, never the object the wire handed over. */
      readonly command: Command;
    }
  | { readonly ok: false; readonly reason: ProposalRefusal };

/** Every command type the engine has; a proposal of any other type is refused, and a new type must be listed here. */
const COMMAND_TYPES: Readonly<Record<Command["type"], true>> = {
  changeForm: true,
  playCard: true,
  useAbility: true,
  basicAttack: true,
  basicThwart: true,
  basicRecover: true,
  endTurn: true,
  concede: true,
  adjust: true,
  resolveChoice: true,
  // Never from a seat (judged below): the table host's own engine feeds the pod's words in (Epic Multiplayer).
  externalEvent: true,
  remotePower: true,
  podRelease: true,
};

export interface ProposalCheck {
  /** The table now: the game's outcome, open choice and step. */
  readonly state: Pick<GameState, "outcome" | "pendingChoice" | "step">;
  /** The host's command count. */
  readonly count: number;
  /** What the proposal was built on. */
  readonly base: number;
  /**
   * The state it was built on (`replayChecksum` after `base` commands, from the proposer's engine). A rewind followed by
   * a new move reaches the same count with a different table, so the count alone cannot say the proposer saw this one.
   */
  readonly stamp: string | undefined;
  /** `replayChecksum` of the host's state now; only called once `base` matches the count. */
  readonly stampNow: () => string;
  /** The engine players behind the seats the proposer may act for. */
  readonly players: readonly string[];
  /** The proposal, as it came off the wire (anything). */
  readonly command: unknown;
  /**
   * Competitive rooms (issue #883): the team of an engine player, from the lobby. Absent in every other room. With it, a
   * seat of the team that is not on turn may not take an off-turn Action (the cooperative rule that any hero may act in
   * the hero phase would otherwise let the other team move): only the active player's own team acts, and a choice
   * addressed to a seat's player is still its answer to give (a card's "enemy team" choice, a triggered ability).
   */
  readonly teamOf?: (playerId: string) => string | undefined;
  /** The room's mode: a Manual adjust is never a proposal (it is a request the host performs). */
  readonly strict: boolean;
}

/** A plain-data copy of a command of a known type made by a player, or null (anything else is not a command). */
const asCommand = (value: unknown): Command | null => {
  if (typeof value !== "object" || value === null) return null;
  const { type, playerId } = value as { type?: unknown; playerId?: unknown };
  if (typeof type !== "string" || typeof playerId !== "string" || !Object.hasOwn(COMMAND_TYPES, type)) return null;
  try {
    return JSON.parse(JSON.stringify(value)) as Command;
  } catch {
    return null;
  }
};

export function judgeProposal(check: ProposalCheck): ProposalVerdict {
  const { state, count, base, players, strict } = check;
  const command = asCommand(check.command);
  // A concession needs no fresh table: giving up holds whatever moved since the proposal was built (#883, N12 A).
  const concession = command?.type === "concede" && check.teamOf !== undefined && players.includes(command.playerId);
  if (!concession) {
    if (base !== count) return { ok: false, reason: "stale" };
    if (check.stamp === undefined || check.stamp !== check.stampNow()) return { ok: false, reason: "stale" };
  }
  if (!command) return { ok: false, reason: "illegal" };
  // Adjusting the table is the host's own act, after it accepts a request: a seat never proposes one.
  if (command.type === "adjust") return { ok: false, reason: strict ? "strict" : "illegal" };
  // Giving the game up ends it for the whole table: a seat asks the host for it (a `concede` request), never proposes it.
  // In a Competitive room (#883, plan N12 A) a seat may propose it for itself: the team's forfeit, or `alone` to leave a
  // 2v2 alone. It is the proposer's own seat's concession only, never another seat's, and the engine decides what it means.
  if (command.type === "concede") {
    return check.teamOf !== undefined && players.includes(command.playerId)
      ? { ok: true, command }
      : { ok: false, reason: "illegal" };
  }
  // Authority-only commands (`isAuthorityCommand`): an inbound pod event and a release of a pod wait never come from a seat.
  if (command.type === "externalEvent" || command.type === "podRelease") return { ok: false, reason: "illegal" };
  const acting = actingPlayer(state);
  if (acting === null || players.length === 0) return { ok: false, reason: "not-your-turn" };
  const mine = (id: string): boolean => players.includes(id);
  if (!mine(command.playerId)) {
    // Acting as a hero the proposer's seats are not: another seat's turn is "not yours", a forged id is not legal.
    return { ok: false, reason: mine(acting) ? "illegal" : "not-your-turn" };
  }
  if (command.playerId === (acting as PlayerId)) return { ok: true, command };
  // A seat the table is not waiting on: only an off-turn Action in a player turn can be legal, and the engine judges it.
  // In a Competitive room only the active player's own team may: the other team has no actions this phase (Q11 A).
  const mineTeam = check.teamOf?.(command.playerId);
  const sameSide = check.teamOf === undefined || (mineTeam !== undefined && mineTeam === check.teamOf(acting));
  if (!state.pendingChoice && state.step.phase === "player" && state.step.kind === "turn" && sameSide) {
    return { ok: true, command };
  }
  return { ok: false, reason: "not-your-turn" };
}
