import { describe, expect, it } from "vitest";
import { composePause, pauseModeOf } from "../pause-compose";
import type { PauseContext } from "../pause-context.types";
import { cardSizeRowInfoOf } from "../../../view/settings-rows";
import { defaultSettings } from "../../../settings";

const context = (over: Partial<PauseContext> = {}): PauseContext => ({
  mode: "wide",
  hasGame: true,
  status: "Round 2 · player phase · Spider-Man",
  blindLines: [],
  adjusted: false,
  seatGame: false,
  roomChat: false,
  manualAdjustOn: false,
  adjustLabel: "Manual adjust",
  quitLabel: "Save & quit",
  concedeSentence: "Concede?",
  confirmingConcede: false,
  logExpanded: false,
  quickExpanded: false,
  guidedRunActive: false,
  watchLinkLabel: null,
  showHandLabel: null,
  quickRows: [
    { id: "glossary", title: "Keyword glossary", detail: "2 terms", enabled: true },
    { id: "music", title: "Music", detail: "", compact: true, enabled: true },
  ],
  query: "",
  searching: false,
  results: null,
  settingRows: [],
  tableRows: [],
  cardSize: cardSizeRowInfoOf(defaultSettings()),
  guideRows: [],
  entries: [
    {
      id: "stunned",
      displayName: "Stunned",
      definition: "d",
      citeLabel: "",
      playerCiteLabel: "",
      unverified: false,
      cardRefs: [{ cardId: "rhino", name: "Rhino" }],
    },
    {
      id: "guard",
      displayName: "Guard",
      definition: "g",
      citeLabel: "",
      playerCiteLabel: "",
      unverified: false,
      cardRefs: [],
    },
  ],
  logLines: [
    { id: "a", ref: "R1.1", round: 1, text: "Round begins", tags: [], voice: "scenario" },
    { id: "b", ref: "R1.2", round: 1, text: "Spider-Man attacks", tags: [], voice: "player" },
  ],
  undoable: new Map([["b", 1]]),
  cancelGlyph: undefined,
  ...over,
});

describe("composePause", () => {
  it("picks the phone sheet below 700 and the two panels from there up", () => {
    expect(pauseModeOf(375)).toBe("phone");
    expect(pauseModeOf(699)).toBe("phone");
    expect(pauseModeOf(700)).toBe("wide");
    expect(pauseModeOf(860)).toBe("wide");
  });

  it("builds the wide menu with Concede pinned at the foot and Manual adjust only when it is on", () => {
    const off = composePause(context()).model.menu;
    expect(off.map((item) => item.id)).toEqual([
      "resume",
      "full-game-log",
      "rules-reference",
      "settings",
      "stats",
      "save-quit",
      "music",
      "report",
      "concede",
    ]);
    expect(off.at(-1)!.foot).toBe(true);
    const on = composePause(context({ manualAdjustOn: true, guidedRunActive: true, watchLinkLabel: "Copy link" })).model
      .menu;
    expect(on.map((item) => item.id)).toContain("manual-adjust");
    expect(on.map((item) => item.id)).toContain("guide-stop-tutorial");
    expect(on.map((item) => item.id)).toContain("watch-link");
  });

  it("lists every keyword (status cards by tone), the newest log line first, and marks the undoable ones", () => {
    const { model, order } = composePause(context());
    expect(model.rules.entries.map((entry) => [entry.id, entry.tone])).toEqual([
      ["stunned", "stunned"],
      ["guard", "plain"],
    ]);
    expect(model.rules.entries[0]!.tail).toEqual({ text: expect.stringContaining("Rhino"), cardId: "rhino" });
    expect(model.log.lines.map((line) => [line.id, line.stop])).toEqual([
      ["b", "moment:b"],
      ["a", null],
    ]);
    expect(order).toEqual(expect.arrayContaining(["resume", "concede", "search", "keyword:stunned", "moment:b"]));
    expect(order.indexOf("keyword:stunned")).toBeLessThan(order.indexOf("moment:b"));
  });

  it("shows only the compact Reference cells until the toggle opens the rest, and the phone's footer and close", () => {
    const shut = composePause(context({ mode: "phone" }));
    expect(shut.model.quick.rows.map((row) => row.stop)).toEqual(["quick:music"]);
    expect(shut.model.quick.toggle.open).toBe(false);
    expect(shut.model.menu.map((item) => item.id)).toEqual(["resume", "save-quit", "concede"]);
    expect(shut.model.header.close).not.toBeNull();
    const open = composePause(context({ mode: "phone", quickExpanded: true }));
    expect(open.model.quick.rows.map((row) => row.variant)).toEqual(["compact", "panel"]);
    expect(open.order.slice(0, 4)).toEqual(["close", "search", "quick-toggle", "quick:music"]);
  });

  it("opens the confirm with the seat's wording, and ends the order with its two buttons", () => {
    const wide = composePause(context({ confirmingConcede: true }));
    expect(wide.model.confirm).toEqual({ sentence: "Concede?", yes: expect.any(String), cancel: expect.any(String) });
    expect(wide.order).toContain("concede-confirm-yes");
    expect(wide.order).not.toContain("concede");
  });

  it("says it is searching until the worker answers, then groups the results and ends Rules with the glossary row", () => {
    const waiting = composePause(context({ searching: true, query: "gu" })).model;
    expect(waiting.results!.groups).toEqual([]);
    expect(waiting.results!.note).not.toBe("");
    const none = composePause(context({ searching: true, query: "gu", results: [] }));
    expect(none.model.results!.note).not.toBe("");
    expect(none.model.results!.groups.map((g) => g.rows.length)).toEqual([1]);
    expect(none.order).toContain("result:pause-glossary-search");
  });
});
