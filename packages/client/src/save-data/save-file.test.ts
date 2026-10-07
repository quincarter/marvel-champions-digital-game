import { describe, expect, test } from "vitest";
import {
  SAVE_FILE_FORMAT,
  SAVE_FILE_VERSION,
  describeSaveFileSummary,
  parseSaveFile,
  saveFileNameOf,
  saveFileSummaryOf,
} from "./save-file.js";

function fileWith(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    format: SAVE_FILE_FORMAT,
    version: SAVE_FILE_VERSION,
    exportedAt: Date.UTC(2026, 8, 30, 12),
    appVersion: "0.13.0",
    databases: {
      "mc-saves": {
        version: 1,
        stores: {
          games: [{ id: "g1" }, { id: "g2" }],
          baselines: [{ gameId: "g1" }],
          commands: [{ gameId: "g1", seq: 0 }],
        },
      },
      "mc-decks": { version: 1, stores: { decks: [{ id: "d1" }] } },
      "mc-campaigns": { version: 1, stores: { campaigns: [] } },
    },
    localStorage: { "mc-unlocks": "{}" },
    ...overrides,
  };
}

const parse = (raw: unknown) => parseSaveFile(JSON.stringify(raw));

describe("parseSaveFile", () => {
  test("accepts a well-formed file", () => {
    const result = parse(fileWith());
    expect(result.ok).toBe(true);
  });

  test.each([
    ["not JSON", "{nope", "isn't a Marvel Champions save file"],
    ["another app's JSON", JSON.stringify({ hello: 1 }), "isn't a Marvel Champions save file"],
    ["a newer format", JSON.stringify(fileWith({ version: SAVE_FILE_VERSION + 1 })), "newer version"],
    ["no databases", JSON.stringify(fileWith({ databases: null })), "incomplete"],
  ])("refuses %s", (_, text, message) => {
    const result = parseSaveFile(text);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain(message);
  });

  test("refuses a database saved at a newer schema version", () => {
    const result = parse(fileWith({ databases: { "mc-decks": { version: 2, stores: { decks: [] } } } }));
    expect(result).toEqual({ ok: false, error: expect.stringContaining("mc-decks was saved by a newer version") });
  });

  test("refuses a record missing its key, including one part of a compound key", () => {
    expect(parse(fileWith({ databases: { "mc-decks": { version: 1, stores: { decks: [{ name: "x" }] } } } })).ok).toBe(
      false,
    );
    const commands = { version: 1, stores: { commands: [{ gameId: "g1" }] } };
    expect(parse(fileWith({ databases: { "mc-saves": commands } })).ok).toBe(false);
  });

  test("refuses localStorage entries that aren't the game's", () => {
    expect(parse(fileWith({ localStorage: { theme: "dark" } })).ok).toBe(false);
    expect(parse(fileWith({ localStorage: { "mc-guide": 3 } })).ok).toBe(false);
  });

  test("drops databases this build doesn't know and tolerates missing stores", () => {
    const result = parse(
      fileWith({ databases: { "mc-future": { version: 9, stores: {} }, "mc-decks": { version: 1, stores: {} } } }),
    );
    if (!result.ok) throw new Error(result.error);
    expect(Object.keys(result.file.databases)).toEqual(["mc-decks"]);
  });
});

describe("summary", () => {
  test("counts what the file holds", () => {
    const result = parse(fileWith());
    if (!result.ok) throw new Error(result.error);
    const summary = saveFileSummaryOf(result.file);
    expect(summary).toMatchObject({ games: 2, decks: 1, campaigns: 0, unlocks: true });
    expect(describeSaveFileSummary(summary, "en-GB")).toMatch(
      /^2 saved games, 1 deck, unlocks and points, exported 30 Sep\w* 2026$/,
    );
  });

  test("an empty file says so", () => {
    const empty = { exportedAt: 0, appVersion: "x", games: 0, decks: 0, campaigns: 0, unlocks: false, settings: false };
    expect(describeSaveFileSummary(empty)).toBe("nothing saved");
    expect(describeSaveFileSummary({ ...empty, campaigns: 1 })).toBe("1 campaign");
  });

  test("names settings where the file holds them", () => {
    const result = parse(fileWith({ localStorage: { "mc-settings": '{"version":1,"sound":false}' } }));
    if (!result.ok) throw new Error(result.error);
    const summary = saveFileSummaryOf(result.file);
    expect(summary.settings).toBe(true);
    expect(describeSaveFileSummary({ ...summary, exportedAt: 0 })).toBe("2 saved games, 1 deck, settings");
    expect(describeSaveFileSummary({ ...summary, exportedAt: 0, games: 0, decks: 0 })).toBe("settings");
  });

  test("names the file by date", () => {
    expect(saveFileNameOf(new Date(2026, 0, 5).getTime())).toBe("marvel-champions-save-2026-01-05.json");
  });
});
