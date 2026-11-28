import type { PausePageModel } from "./pause.types.js";

/** A Pause page model for the element tests, with `over` laid on top. */
export function pauseModel(over: Partial<PausePageModel> = {}): PausePageModel {
  return {
    mode: "wide",
    searching: false,
    header: { title: "Paused", status: "Round 2 · player phase · Spider-Man", blind: [], note: "", close: null },
    menu: [
      { id: "resume", label: "Resume", kind: "primary", span: 2 },
      { id: "full-game-log", label: "Full game log", kind: "onInk", span: 2 },
      { id: "concede", label: "Concede", kind: "onInk", span: 2, foot: true },
    ],
    search: { value: "", placeholder: "Search settings and rules…", clearLabel: "Clear" },
    results: null,
    rules: {
      title: "Rules reference",
      filtered: "Filtered to what's on your table",
      empty: "Nothing on the table carries a keyword.",
      entries: [{ id: "guard", term: "Guard", definition: "Must be attacked first.", tone: "plain", tail: null }],
    },
    log: {
      title: "Jump to a moment",
      note: "",
      empty: "Nothing has happened yet.",
      hint: "Only your own moves this turn can be undone",
      lines: [{ id: "l1", ref: "R1.1", words: "Round begins", stop: null }],
    },
    logExpanded: false,
    quick: { toggle: { label: "Reference", open: false }, rows: [] },
    table: {
      guideRun: [],
      tableHeading: "Table",
      cardSize: { title: "Card size", detail: "", look: "cell", options: [] },
      rows: [],
      guideHeading: "Guide",
      level: null,
      guideRows: [],
    },
    confirm: null,
    ...over,
  };
}
