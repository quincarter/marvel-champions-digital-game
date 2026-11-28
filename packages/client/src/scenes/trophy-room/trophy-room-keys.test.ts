import { describe, expect, it } from "vitest";
import type { TrophyRow } from "../../view/trophy-room-model.js";
import { keyOfAchievementRow, trophyStopOrder } from "./trophy-room-keys.js";

const rows: readonly TrophyRow[] = [
  { kind: "section", id: "wins", title: "Battles won", count: "", expanded: true },
  {
    kind: "achievement",
    id: "a",
    name: "A",
    detail: "",
    state: "locked",
    stateLabel: "LOCKED",
    reward: "",
    progress: null,
    progressLabel: "",
  },
  { kind: "section", id: "mods", title: "Mods", count: "", expanded: true },
  { kind: "group", id: "silly", title: "Silly", count: "" },
];

const all = [
  "back",
  "stats",
  "filters-toggle",
  "expand-all",
  "sort:category",
  "sort:completion",
  "sort:points",
  "sort:name",
  "dir:asc",
  "dir:desc",
  "sec:wins",
  "row:a",
  "sec:mods",
];

describe("trophyStopOrder", () => {
  it("walks the bar, the filters, then each heading with its cards, and skips a pack's label", () => {
    expect(trophyStopOrder(rows, false, all)).toEqual([
      "back",
      "stats",
      "filters-toggle",
      "expand-all",
      "sec:wins",
      "row:a",
      "sec:mods",
    ]);
  });

  it("puts the sort chips and the directions after Expand all while the filters are open", () => {
    expect(trophyStopOrder(rows, true, all).slice(3, 11)).toEqual([
      "expand-all",
      "sort:category",
      "sort:completion",
      "sort:points",
      "sort:name",
      "dir:asc",
      "dir:desc",
      "sec:wins",
    ]);
  });

  it("lists only the keys the page drew", () => {
    expect(trophyStopOrder(rows, false, ["back", "row:a"])).toEqual(["back", "row:a"]);
  });

  it("keys an achievement by its id", () => {
    expect(keyOfAchievementRow("pack:x/y")).toBe("row:pack:x/y");
  });
});
