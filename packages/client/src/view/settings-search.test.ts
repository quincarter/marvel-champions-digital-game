import { describe, expect, it } from "vitest";
import { defaultSettings } from "../settings.js";
import { DEFAULT_UNLOCK_PREFS, NO_PROGRESS, Unlocks } from "../progression/unlocks.js";
import { prepareDocuments, rankDocuments } from "./deck-search.js";
import {
  markedLineOf,
  matchRangesOf,
  nestedPageEntriesOf,
  searchDocumentsOf,
  settingsRowEntriesOf,
  type SettingsSearchEntry,
} from "./settings-search.js";
import type { SettingsItemId } from "./settings-sections.js";

const nested = (): readonly SettingsSearchEntry[] =>
  nestedPageEntriesOf({
    settings: defaultSettings(),
    unlocks: new Unlocks({ progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS }),
    family: "xbox",
    swap: false,
    globalConsent: "unset",
  });

const marked = (text: string, query: string): readonly string[] =>
  matchRangesOf(text, query).map(({ start, end }) => text.slice(start, end));

describe("the search index", () => {
  it("reaches every nested page, each with a place to go", () => {
    const places = new Set(nested().map((entry) => entry.place));
    expect(places).toEqual(
      new Set([
        "Rules reference",
        "Rules reference ▸ Villain phase",
        "Unlocks",
        "Unlocks ▸ How it works",
        "Save data",
        "Controls ▸ Controller",
        "Controls ▸ Keyboard",
        "Your stats",
        "Guide ▸ How to play",
      ]),
    );
  });

  it("gives every entry its own id", () => {
    const ids = nested().map((entry) => entry.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("files a Settings row under the tab it sits on and skips one this device doesn't draw", () => {
    const rows = new Map<SettingsItemId, { title: string; detail: string }>([
      ["sound", { title: "Sound", detail: "Background music." }],
    ]);
    const entries = settingsRowEntriesOf(
      [{ id: "sound", label: "Sound", sections: [{ items: ["sound", "music-volume"] }] }],
      rows,
    );
    expect(entries.map((e) => [e.title, e.place, e.target])).toEqual([
      ["Sound", "Settings ▸ Sound", { kind: "setting", item: "sound", tab: "sound" }],
    ]);
  });

  const rank = (query: string): readonly string[] => {
    const entries = nested();
    const titles = new Map(entries.map((e) => [e.id, e.title]));
    return rankDocuments(prepareDocuments(searchDocumentsOf(entries)), query).map((r) => titles.get(r.id)!);
  };

  it("puts a title match ahead of one in a description", () => {
    expect(rank("retaliate")[0]).toBe("Retaliate X");
  });

  it("finds How it works by its heading, and through a typo", () => {
    expect(rank("champion points")).toContain("Earning champion points");
    expect(rank("retalitate")[0]).toBe("Retaliate X");
  });
});

describe("matchRangesOf", () => {
  it("marks the letters typed", () => {
    expect(marked("Dark mode", "dar")).toEqual(["Dar"]);
  });

  it("marks each word of the query", () => {
    expect(marked("Card size on hover", "hover card")).toEqual(["Card", "hover"]);
  });

  it("prefers the start of a word over the middle of one", () => {
    expect(matchRangesOf("Discard the card", "card")).toEqual([{ start: 12, end: 16 }]);
  });

  it("marks inside a word when no word starts with it", () => {
    expect(marked("Discard", "car")).toEqual(["car"]);
  });

  it("marks the whole word a typo came close to", () => {
    expect(marked("Reduced motion", "moiton")).toEqual(["motion"]);
  });

  it("ignores accents and periods without losing its place", () => {
    expect(marked("Cómo S.H.I.E.L.D. juega", "shield")).toEqual(["S.H.I.E.L.D"]);
    expect(marked("Cómo juega", "como")).toEqual(["Cómo"]);
  });

  it("marks nothing for a query that does not match", () => {
    expect(matchRangesOf("Sound", "zzz")).toEqual([]);
    expect(matchRangesOf("Sound", "   ")).toEqual([]);
  });

  it("marks letters in order across a name, the ranking's last tier", () => {
    expect(marked("Spider-Man", "spdrmn").join("")).toBe("SpdrMn");
  });
});

describe("markedLineOf", () => {
  const long =
    "Shows the boost icons per card left in the encounter deck when you tap it. Star boosts are listed apart.";

  it("leaves a short line whole", () => {
    expect(markedLineOf("Sound", "sou", 40)).toEqual({ text: "Sound", ranges: [{ start: 0, end: 3 }] });
  });

  it("cuts a long line around a match near its end, keeping the mark on the same letters", () => {
    const line = markedLineOf(long, "apart", 40);
    expect(line.text.length).toBeLessThanOrEqual(40);
    expect(line.text.startsWith("…")).toBe(true);
    const range = line.ranges[0]!;
    expect(line.text.slice(range.start, range.end)).toBe("apart");
  });

  it("keeps a match near the start in the first window", () => {
    const line = markedLineOf(long, "boost", 40);
    expect(line.text.startsWith("Shows")).toBe(true);
    expect(line.text.endsWith("…")).toBe(true);
    const range = line.ranges[0]!;
    expect(line.text.slice(range.start, range.end)).toBe("boost");
  });

  it("drops a mark that falls past the cut", () => {
    for (const { start, end } of markedLineOf(long, "star", 30).ranges) {
      expect(end).toBeGreaterThan(start);
      expect(end).toBeLessThanOrEqual(30);
    }
  });
});
