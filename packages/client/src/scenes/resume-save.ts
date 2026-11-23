/**
 * Resumes a local save the way Title's Continue does, for the screens that bring a player back after a reload
 * (`scenes/rejoin.ts`, a host rejoining its room on `scenes/online.ts`): never a guided run (guidance is not part of a
 * save), the local save only, and the setup deal screen when the mulligans are not done yet.
 */
import { setGuideRunLevelOverride } from "../guide/guide-store.js";
import { appSession } from "../session.js";
import { SCENES } from "./keys.js";

/** The screen the resumed game opens on, or null when the save could not be resumed (the host has retired it). */
export async function resumeLocalSave(gameId: string): Promise<string | null> {
  // A reload resume: this device's own save was the one being played, so the before-resume device sync is skipped and
  // nothing waits on the network.
  const session = appSession();
  session.guidedRun = false;
  session.guidedRunKind = undefined;
  setGuideRunLevelOverride(null);
  try {
    await session.store.resume(gameId, { sync: false });
  } catch {
    return null;
  }
  const { store } = session;
  if (store.state.status === "failed") return null;
  return store.state.game?.step.phase === "setup" ? SCENES.setupDeal : SCENES.board;
}
