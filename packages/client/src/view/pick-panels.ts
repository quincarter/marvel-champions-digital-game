/**
 * Whose play area a "play under any player's control" card goes to (Uncanny X-Men 36018, "Max 1 TEAM card per player"),
 * asked on the table with `view/targeting-panel.ts`'s tiles so the question looks and works the same on the desktop and
 * the phone. It only words the seats the engine already listed (`LegalAction.controllers`); it decides nothing.
 */

import { cardOf, type GameState, type InstanceId, type LegalAction, type PlayerId } from "@mc/engine";
import { cardName } from "./names.js";
import { artOf, type TargetingPanel, type TargetOption } from "./targeting-panel.js";

/** One seat a card could be played under: its identity card is the tile. */
export interface SeatOption {
  readonly playerId: PlayerId;
  readonly identityId: InstanceId;
  /** The hero's name. */
  readonly name: string;
  /** The other face, so a seat is known by either name. */
  readonly alterEgo: string | null;
  /** The seat asking, whose own area is the default answer. */
  readonly you: boolean;
}

/** Every seat the engine listed (`LegalAction.controllers`), the asking seat first. */
export function seatOptionsOf(
  state: GameState,
  controllers: readonly PlayerId[],
  perspectiveId: PlayerId | null,
): readonly SeatOption[] {
  const seats = controllers.flatMap((playerId): SeatOption[] => {
    const player = state.players.find((seat) => seat.playerId === playerId);
    if (!player) return [];
    const card = cardOf(state, player.identity.instanceId);
    const hero = card?.type === "hero_identity" ? card : null;
    return [
      {
        playerId,
        identityId: player.identity.instanceId,
        name: hero?.hero.faceName ?? cardName(state, player.identity.instanceId),
        alterEgo: hero?.alterEgo.faceName ?? null,
        you: playerId === perspectiveId,
      },
    ];
  });
  return [...seats.filter((seat) => seat.you), ...seats.filter((seat) => !seat.you)];
}

/** "Whose play area?": one tile per seat the card may go to, the asking seat first and highlighted. */
export function seatPanelOf(state: GameState, entry: LegalAction, seats: readonly SeatOption[]): TargetingPanel {
  const played = entry.action.kind === "playCard" ? entry.action.instanceId : null;
  const subject = played ? cardName(state, played) : "This card";
  const options = seats.map((seat): TargetOption => ({
    instanceId: seat.identityId,
    name: seat.name,
    lines: [seat.you ? "You" : (seat.alterEgo ?? "")].filter((line) => line !== ""),
    confirmLine: `Play it in ${seat.name}'s area`,
    art: artOf(state, seat.identityId),
  }));
  const first = seats[0];
  return {
    title: "Whose play area?",
    heading: `${options.length} SEATS`,
    source: {
      label: subject,
      name: subject,
      instanceId: played ?? seats[0]!.identityId,
      art: played ? artOf(state, played) : null,
    },
    options,
    excluded: [],
    hideExcluded: true,
    ...(first ? { defaultId: first.identityId } : {}),
  };
}
