/**
 * What Concede offers in a Civil War Competitive game (issue #883, plan N12 A; MC56 p. 16, 20): the whole team forfeits at
 * once, or, in a 2v2 where the player's team still has another seat in the game, that player alone leaves. The engine's
 * `concede` command does both (`alone`); this only says which choices the player has and which command each sends.
 */
import type { Command, GameState } from "@mc/engine";
import type { MessageKey } from "../i18n/translate.js";

export interface ConcedeChoice {
  readonly id: "team" | "alone";
  readonly labelKey: MessageKey;
  readonly detailKey: MessageKey;
  readonly command: Extract<Command, { type: "concede" }>;
}

/** The concede choices for `playerId`; empty in a game with no teams (the ordinary single confirm applies). */
export function concedeChoicesOf(
  state: Pick<GameState, "teams" | "players">,
  playerId: string,
): readonly ConcedeChoice[] {
  const team = state.teams?.find((candidate) => (candidate.playerIds as readonly string[]).includes(playerId));
  if (!team) return [];
  const choices: ConcedeChoice[] = [
    {
      id: "team",
      labelKey: "comp.concede.team",
      detailKey: "comp.concede.teamDetail",
      command: { type: "concede", playerId: playerId as never },
    },
  ];
  const mates = state.players.filter(
    (player) =>
      player.playerId !== playerId &&
      (team.playerIds as readonly string[]).includes(player.playerId) &&
      !player.eliminated,
  );
  if (mates.length > 0) {
    choices.push({
      id: "alone",
      labelKey: "comp.concede.alone",
      detailKey: "comp.concede.aloneDetail",
      command: { type: "concede", playerId: playerId as never, alone: true },
    });
  }
  return choices;
}
