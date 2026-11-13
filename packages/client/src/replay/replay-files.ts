/**
 * Replays in and out of the game (issue #693): opening one from a saved game or a file, handing a replay or a game's log
 * out through the shell's own route (`save-data/file-transfer.ts`: the desktop Save dialog, Android's, the phone share
 * sheet, or a download), and picking a replay file to watch.
 */
import { deliverTextFile, pickFile } from "../save-data/file-transfer.js";
import type { ReplayOpenSource } from "./replay-core.js";
import { REPLAY_EXTENSION } from "./replay-file.js";
import { ReplayHost, WorkerReplayBackend, type ReplayBackend } from "./replay-host.js";

/** Opens a replay in its own worker. On failure the worker is closed and the error (a `ReplayOpenError`) passed on. */
export async function openReplay(
  source: ReplayOpenSource,
  backend: () => ReplayBackend = () => new WorkerReplayBackend(),
): Promise<ReplayHost> {
  const host = new ReplayHost(backend());
  try {
    await host.open(source);
    return host;
  } catch (cause) {
    host.dispose();
    throw cause;
  }
}

/** Hands a replay file out. Rejects with an AbortError when the player closes the dialog. */
export function deliverReplayFile(bytes: Uint8Array, name: string): Promise<void> {
  return deliverTextFile(name, new TextDecoder().decode(bytes), "text/plain", {
    title: "Export replay",
    filterName: "Replay",
    extension: REPLAY_EXTENSION.slice(1),
  });
}

/** Hands a game's log out as a text file. Rejects with an AbortError when the player closes the dialog. */
export function deliverGameLog(text: string, name: string): Promise<void> {
  return deliverTextFile(name, text, "text/plain", { title: "Export game log", filterName: "Text", extension: "txt" });
}

/**
 * Asks for a replay file and reads it: its bytes, "unreadable" when it couldn't be read, or null when the picker closed
 * with nothing chosen. Whether it is a replay is the replay's open to say (`ReplayOpenError`).
 */
export function pickReplayFile(): Promise<Uint8Array | "unreadable" | null> {
  return pickFile(`${REPLAY_EXTENSION},.json,.txt,application/json,text/plain`);
}
