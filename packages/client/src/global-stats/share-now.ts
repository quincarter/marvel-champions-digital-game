/**
 * "Share my games" on Your stats and in the deck builder: one press turns sharing on, as the Settings row does. The
 * games finished so far are marked sent first (`turnOnGlobalStats`), so only games finished from now on are ever shared.
 * Returns whether the choice was saved; a failure leaves sharing off.
 */
import { appSession } from "../session.js";
import { finishedIdsOf, turnOnGlobalStats } from "./global-consent.js";

export async function shareFinishedGamesNow(): Promise<boolean> {
  try {
    return turnOnGlobalStats(finishedIdsOf(await appSession().store.listSaves()));
  } catch {
    return false;
  }
}
