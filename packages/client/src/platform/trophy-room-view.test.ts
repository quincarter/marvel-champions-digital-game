import { describe, expect, it } from "vitest";
import { DEFAULT_TROPHY_VIEW } from "../view/trophy-room-model.js";
import { TROPHY_ROOM_VIEW_KEY, rememberTrophyRoomView, trophyRoomView } from "./trophy-room-view.js";

const memory = (): Pick<Storage, "getItem" | "setItem"> & { data: Map<string, string> } => {
  const data = new Map<string, string>();
  return { data, getItem: (key) => data.get(key) ?? null, setItem: (key, value) => void data.set(key, value) };
};

describe("trophyRoomView", () => {
  it("is every family folded, in the book's order, when nothing was kept", () => {
    expect(trophyRoomView(memory())).toBe(DEFAULT_TROPHY_VIEW);
    expect(trophyRoomView(null)).toBe(DEFAULT_TROPHY_VIEW);
  });

  it("keeps the sort and the families the player opened", () => {
    const store = memory();
    rememberTrophyRoomView({ sort: "points", descending: true, expanded: new Set(["wins", "feats"]) }, store);
    const view = trophyRoomView(store);
    expect(view.sort).toBe("points");
    expect(view.descending).toBe(true);
    expect([...view.expanded].sort()).toEqual(["feats", "wins"]);
  });

  it("drops what it does not know, and reads nonsense as the default", () => {
    const store = memory();
    store.setItem(TROPHY_ROOM_VIEW_KEY, JSON.stringify({ sort: "colour", expanded: ["wins", "gone", 3] }));
    const view = trophyRoomView(store);
    expect(view.sort).toBe("category");
    expect([...view.expanded]).toEqual(["wins"]);
    store.setItem(TROPHY_ROOM_VIEW_KEY, "{not json");
    expect(trophyRoomView(store)).toBe(DEFAULT_TROPHY_VIEW);
  });
});
