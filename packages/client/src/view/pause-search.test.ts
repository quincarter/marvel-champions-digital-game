import { describe, expect, it } from "vitest";
import { defaultGuidePrefs } from "../guide/guide-prefs.js";
import { DEFAULT_UNLOCK_PREFS, NO_PROGRESS } from "../progression/unlocks.js";
import { defaultSettings } from "../settings.js";
import {
  PAUSE_RESULT_HEADING_HEIGHT,
  PAUSE_RESULT_LINK_HEIGHT,
  groupPauseResults,
  pauseResultsContentOf,
  pauseSettingRowsOf,
  type PauseSettingsEnv,
} from "./pause-search.js";
import { guideRowInfoOf } from "./settings-rows.js";
import { SettingsSearchHost, type SettingsSearchEntry } from "./settings-search.js";
import { settingsTabsOf } from "./settings-sections.js";

const ENV: PauseSettingsEnv = { powerSaving: false, mixer: false, promoShown: false, earned: new Set() };

const rowsNow = () => pauseSettingRowsOf(defaultSettings(), defaultGuidePrefs, ENV);

const reference: SettingsSearchEntry = {
  id: "pause:jumpLog",
  title: "Game log",
  detail: "What has happened so far.",
  place: "Pause",
  target: { kind: "pause", id: "jumpLog" },
  keywords: ["undo", "rewind"],
};

/** A phone's Settings tabs, and Pause's rows as the Settings rows, as `scenes/pause.ts` indexes them. */
function host(): SettingsSearchHost {
  const searchHost = new SettingsSearchHost();
  searchHost.index({
    tabs: settingsTabsOf({
      guideRowIds: guideRowInfoOf(defaultGuidePrefs).map((row) => row.id),
      cardHover: false,
      inspectCard: true,
    }),
    rows: rowsNow().map((row) => [row.id, { title: row.title, detail: row.detail }] as const),
    settings: defaultSettings(),
    pad: null,
    unlocks: { progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS },
    globalConsent: "unset",
    controls: false,
    extra: [reference],
  });
  return searchHost;
}

describe("pauseSettingRowsOf", () => {
  it("offers Undo past your turn as a choice it can change in place", () => {
    const undo = rowsNow().find((row) => row.id === "undo-past-turn");
    expect(undo?.control.kind).toBe("choice");
    const state = { settings: defaultSettings(), guide: defaultGuidePrefs };
    const control = undo?.control;
    const other = control?.kind === "choice" ? control.options.find((o) => o.value !== control.selected) : undefined;
    expect(other).toBeDefined();
    const next = undo!.apply!(state, other!.value, 1);
    expect(next.settings.undoPastTurn).toBe(other!.value);
    expect(next.guide).toBe(state.guide);
  });

  it("flips a toggle, and leaves a choice alone for a value that is not one of its own", () => {
    const rows = rowsNow();
    const state = { settings: defaultSettings(), guide: defaultGuidePrefs };
    const confirm = rows.find((row) => row.id === "confirm-end-turn")!;
    expect(confirm.apply!(state, undefined, 1).settings.confirmBeforeEndTurn).toBe(
      !state.settings.confirmBeforeEndTurn,
    );
    const size = rows.find((row) => row.id === "card-size")!;
    expect(size.apply!(state, "not-a-size", 1).settings).toEqual(state.settings);
  });

  it("changes the guide's own prefs for the guide rows", () => {
    const level = rowsNow().find((row) => row.id === "guide-level")!;
    const next = level.apply!({ settings: defaultSettings(), guide: defaultGuidePrefs }, "off", 1);
    expect(next.guide.level).toBe("off");
  });

  it("gives every row its own id", () => {
    const ids = rowsNow().map((row) => row.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Pause's search", () => {
  it('finds "undo" in Settings first, then in Pause\'s own rows', () => {
    const groups = groupPauseResults(host().search("undo"));
    expect(groups[0]?.id).toBe("settings");
    expect(groups[0]?.results[0]?.entry.id).toBe("setting:undo-past-turn");
    expect(groups.find((group) => group.id === "reference")?.results.map((r) => r.entry.id)).toEqual(["pause:jumpLog"]);
  });

  it("finds a setting by a word its title and description do not say", () => {
    const ids = host()
      .search("rewind")
      .map((result) => result.entry.id);
    expect(ids).toContain("setting:undo-past-turn");
    expect(
      host()
        .search("zoom")
        .map((result) => result.entry.id),
    ).toContain("setting:card-size");
  });

  it("groups in a fixed order, keeping each group's ranking, and keeps Rules for the glossary row", () => {
    const groups = groupPauseResults(host().search("retaliate"));
    const order = groups.map((group) => group.id);
    expect(order[0]).toBe("rules");
    expect(groupPauseResults([]).map((group) => group.id)).toEqual(["rules"]);
    const all = groupPauseResults(host().search("card"));
    const ids = all.map((group) => group.id);
    expect(ids).toEqual([...ids].sort((a, b) => rankOf(a) - rankOf(b)));
  });
});

const rankOf = (id: string): number => ["settings", "rules", "reference", "more"].indexOf(id);

describe("pauseResultsContentOf", () => {
  it("stacks headings and rows without overlap, a choice row tall enough for its options", () => {
    const content = pauseResultsContentOf(
      [
        { kind: "heading" },
        {
          kind: "choice",
          detail: "A long description that wraps onto a second line at phone width, and maybe a third.",
        },
        { kind: "toggle", detail: "Short." },
        { kind: "heading" },
        { kind: "link" },
      ],
      343,
    );
    const [heading, choice, toggle, heading2, link] = content.rects;
    expect(heading?.height).toBe(PAUSE_RESULT_HEADING_HEIGHT);
    expect(choice!.height).toBeGreaterThanOrEqual(20 + 12.5 * 2 + 44);
    expect(link?.height).toBe(PAUSE_RESULT_LINK_HEIGHT);
    for (let i = 1; i < content.rects.length; i++) {
      const above = content.rects[i - 1]!;
      expect(content.rects[i]!.y).toBeGreaterThanOrEqual(above.y + above.height);
    }
    // A new group sits further from the row above it than one row from the next.
    expect(heading2!.y - (toggle!.y + toggle!.height)).toBeGreaterThan(toggle!.y - (choice!.y + choice!.height));
    expect(content.totalHeight).toBe(link!.y + link!.height);
  });
});
