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
  PauseSearchSession,
  type PauseSearchClient,
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

describe("rows Pause has no control for", () => {
  it("are found anyway, and open Settings: the desktop window's rows and Discord", () => {
    // `scenes/settings-env.ts`'s `settingsDeviceRowsFor` sends these words, as Settings draws them, ahead of Pause's own.
    const device = [
      ["display-mode", { title: "Display mode", detail: "Windowed, borderless or fullscreen." }],
      ["resolution", { title: "Resolution", detail: "The window's size." }],
      ["discord-presence", { title: "Show my game on Discord", detail: "Your status says what you are playing." }],
    ] as const;
    const searchHost = new SettingsSearchHost();
    searchHost.index({
      tabs: settingsTabsOf({
        guideRowIds: guideRowInfoOf(defaultGuidePrefs).map((row) => row.id),
        cardHover: true,
        desktopWindow: true,
        discord: true,
      }),
      rows: [...device, ...rowsNow().map((row) => [row.id, { title: row.title, detail: row.detail }] as const)],
      settings: defaultSettings(),
      pad: null,
      unlocks: { progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS },
      globalConsent: "unset",
      controls: false,
    });
    const inline = new Set<string>(rowsNow().map((row) => row.id));
    for (const [query, id] of [
      ["resolution", "setting:resolution"],
      ["fullscreen", "setting:display-mode"],
      ["discord", "setting:discord-presence"],
    ] as const) {
      const [best] = groupPauseResults(searchHost.search(query))[0]?.results ?? [];
      expect(best?.entry.id).toBe(id);
      // Not one Pause draws a control for: its result opens Settings on the row.
      expect(inline.has(id.slice("setting:".length))).toBe(false);
    }
  });
});

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

/** A worker that answers only when told to, from the index it was last sent, like the real one but slow. */
class SlowWorker implements PauseSearchClient {
  readonly host = new SettingsSearchHost();
  indexed = 0;
  pending: { query: string; done: (results: ReturnType<SettingsSearchHost["search"]>) => void }[] = [];
  index(input: Parameters<SettingsSearchHost["index"]>[0]): void {
    this.indexed++;
    this.host.index(input);
  }
  search(query: string, done: (results: ReturnType<SettingsSearchHost["search"]>) => void): void {
    this.pending.push({ query, done });
  }
  cancel(): void {
    this.pending = [];
  }
  /** Answers every question still waiting, oldest first, as a worker that fell behind would. */
  answerAll(): void {
    const waiting = this.pending;
    this.pending = [];
    for (const { query, done } of waiting) done(this.host.search(query));
  }
}

describe("PauseSearchSession", () => {
  const rowsWith = (env: PauseSettingsEnv) =>
    pauseSettingRowsOf(defaultSettings(), defaultGuidePrefs, env).map(
      (row) => [row.id, { title: row.title, detail: row.detail }] as const,
    );
  const inputWith = (settings: ReturnType<typeof defaultSettings>) => ({
    tabs: settingsTabsOf({
      guideRowIds: guideRowInfoOf(defaultGuidePrefs).map((row) => row.id),
      cardHover: false,
      inspectCard: true,
    }),
    rows: pauseSettingRowsOf(settings, defaultGuidePrefs, ENV).map(
      (row) => [row.id, { title: row.title, detail: row.detail }] as const,
    ),
    settings,
    pad: null,
    unlocks: { progress: NO_PROGRESS, prefs: DEFAULT_UNLOCK_PREFS },
    globalConsent: "unset" as const,
    controls: false,
  });

  it("drops the last answer the moment the query changes, and never takes an older query's late answer", () => {
    const worker = new SlowWorker();
    let answers = 0;
    const session = new PauseSearchSession(
      worker,
      () => inputWith(defaultSettings()),
      () => answers++,
    );
    session.reindex();
    session.setQuery("undo");
    worker.answerAll();
    expect(session.results?.[0]?.entry.id).toBe("setting:undo-past-turn");

    // Typing on: nothing found for "undo" stays on screen (or pressable) while "card size" is on its way.
    session.setQuery("card");
    session.setQuery("card size");
    expect(session.results).toBeNull();
    worker.answerAll();
    expect(session.results?.[0]?.entry.id).toBe("setting:card-size");
    // The answer for "card" arrived too, but only the one for what is typed counts.
    expect(answers).toBe(2);

    session.setQuery("");
    expect(session.searching).toBe(false);
    expect(session.results).toBeNull();
  });

  it("tells a new query's answer from the same query answered again, so a list keeps its place after a change", () => {
    const worker = new SlowWorker();
    const answers: boolean[] = [];
    const session = new PauseSearchSession(
      worker,
      () => inputWith(defaultSettings()),
      (newQuery) => answers.push(newQuery),
    );
    session.reindex();
    session.setQuery("card");
    worker.answerAll();
    // A setting changed in place further down the list: the same query, answered again.
    session.reindex();
    worker.answerAll();
    // Typing on, then back to the same words: a new list each time.
    session.setQuery("card size");
    worker.answerAll();
    session.setQuery("");
    session.setQuery("card size");
    worker.answerAll();
    expect(answers).toEqual([true, false, true, true]);
  });

  it("indexes again when a row's words change, so the results read what the row says now", () => {
    const worker = new SlowWorker();
    // Ultron Drone art's row says how to earn it until it is earned, then what it does.
    let env: PauseSettingsEnv = ENV;
    const session = new PauseSearchSession(
      worker,
      () => ({ ...inputWith(defaultSettings()), rows: rowsWith(env) }),
      () => {},
    );
    session.reindex();
    session.setQuery("drone art");
    worker.answerAll();
    expect(session.results?.[0]?.entry.detail).toMatch(/^Earn the Drone On achievement/);

    env = { ...ENV, earned: new Set(["ultron-drone-art"]) };
    const indexedBefore = worker.indexed;
    session.reindex();
    expect(worker.indexed).toBe(indexedBefore + 1);
    // The old answer stays on screen until the new one comes, for the same query.
    expect(session.results).not.toBeNull();
    worker.answerAll();
    expect(session.results?.[0]?.entry.detail).toMatch(/^Facedown Drones show/);
  });
});
