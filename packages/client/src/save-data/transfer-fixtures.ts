/** A save-data file for the transfer tests: big and repetitive enough to show compression. */
import { SAVE_FILE_FORMAT, SAVE_FILE_VERSION, type SaveFile } from "./save-file.js";

export function sampleSaveFile(games = 40): SaveFile {
  return {
    format: SAVE_FILE_FORMAT,
    version: SAVE_FILE_VERSION,
    exportedAt: Date.UTC(2026, 9, 21, 12),
    appVersion: "0.14.0",
    databases: {
      "mc-saves": {
        version: 1,
        stores: {
          games: Array.from({ length: games }, (_, i) => ({ id: `game-${i}`, note: "Spider-Man ".repeat(30) })),
        },
      },
    },
    localStorage: { "mc-unlocks": "{}" },
  };
}
