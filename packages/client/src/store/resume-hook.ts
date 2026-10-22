/**
 * A step that runs before a saved game is resumed, whichever screen asked (Title's Continue, a campaign briefing, the
 * unfolded-game route). Device sync registers one (`sync/sync-wiring.ts`) so a game played on another device is pulled
 * in first. A hook that fails or throws never blocks the resume: playing what is on this device always works.
 */
type BeforeResume = (gameId: string) => Promise<unknown>;

let hook: BeforeResume | null = null;

export function setBeforeResume(next: BeforeResume | null): void {
  hook = next;
}

export async function runBeforeResume(gameId: string): Promise<void> {
  if (!hook) return;
  try {
    await hook(gameId);
  } catch {
    // Sync is a convenience; the local save resumes regardless.
  }
}
