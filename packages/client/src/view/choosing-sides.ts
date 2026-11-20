/**
 * The Choosing Sides reward in words (issue #883, plan M9; MC56 p. 16, plan Q12 A). Defeating the Choosing Sides side
 * scheme earns a team the four basic player cards of its own leader, which start set aside. The scheme flips to Now It's
 * Personal, whose Action has each hero on the team take two of them into their hand. This reads what the engine holds
 * (`TeamState.leaderCardIds`, Now It's Personal in a team player's play area) and decides nothing: taking the cards is
 * the card's own Action, answered through the ordinary choice.
 */
import { cardOf, getInstance, yourLeaderOf, type GameState, type InstanceId } from "@mc/engine";

/** Now It's Personal, both printings (56128b registration, 56206b resistance; Q15: identical in play). */
const NOW_ITS_PERSONAL = new Set(["56128b", "56206b"]);

export interface EarnedCard {
  readonly instanceId: InstanceId;
  readonly cardId: string;
  readonly name: string;
}

export interface ChoosingSidesView {
  /** The leader the team teamed up with, whose cards these are. */
  readonly leaderName: string;
  /** The leader's basic player cards still set aside, in the order set aside. */
  readonly remaining: readonly EarnedCard[];
  /** Now It's Personal is in a hero's play area: the team earned them and can use its Action. */
  readonly earned: boolean;
  /** Heroes on the team that may take two each (not eliminated). */
  readonly heroes: number;
}

/**
 * What to show `viewer` about the Choosing Sides reward, or null in a game without teams, for a team with no leader
 * cards set aside, and before the reward is earned (`earned: false` then lists nothing to show, so null).
 */
export function choosingSidesOf(state: GameState, viewer: string): ChoosingSidesView | null {
  const full = state;
  if (!state.teams) return null;
  const team = state.teams.find((candidate) => (candidate.playerIds as readonly string[]).includes(viewer));
  if (!team) return null;
  const mine = state.players.filter((player) => (team.playerIds as readonly string[]).includes(player.playerId));
  const inPlay = mine.some((player) =>
    player.playArea.some((id) => NOW_ITS_PERSONAL.has(getInstance(full, id)?.cardId as string)),
  );
  if (!inPlay) return null;
  const remaining = (team.leaderCardIds ?? []).flatMap((instanceId) => {
    const instance = getInstance(full, instanceId);
    const card = cardOf(full, instanceId);
    return instance && card ? [{ instanceId, cardId: instance.cardId as string, name: card.name }] : [];
  });
  const leaderId = yourLeaderOf(full, team.teamId);
  const leaderName = leaderId ? (cardOf(full, leaderId)?.name ?? "") : "";
  return {
    leaderName,
    remaining,
    earned: true,
    heroes: mine.filter((player) => !player.eliminated).length,
  };
}
