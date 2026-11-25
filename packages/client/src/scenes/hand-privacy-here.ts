/**
 * Whether a hand is drawn face up on this device right now (#887): `view/hand-privacy.ts`'s rule read from where the
 * device stands, the room it is in and a live watch of a room's game (`ReplayHost.live`, with the header's
 * `roomHandsHidden`). For the scenes that name cards outside the board's own hand.
 */
import { activeReplay } from "../replay/replay-mode.js";
import { appSession } from "../session.js";
import { handVisibleTo } from "../view/hand-privacy.js";
import { seatContext } from "../view/seat-context.js";

export function handVisibleHere(playerId: string): boolean {
  return handVisibleTo(
    {
      room: seatContext()?.room ?? null,
      watching: activeReplay()?.live != null,
      handsHidden: appSession().store.state.config?.roomHandsHidden === true,
    },
    playerId,
  );
}
