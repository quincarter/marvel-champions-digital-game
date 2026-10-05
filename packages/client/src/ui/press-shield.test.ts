import { describe, expect, it } from "vitest";
import { insertAtOnce, type InputLists } from "./press-shield.js";

const plugin = (): InputLists<string> => ({ _list: [], _pendingInsertion: [] });

describe("insertAtOnce", () => {
  it("makes a new object part of the live list straight away, after the ones already there", () => {
    const input = plugin();
    input._list = ["scrim"];
    insertAtOnce(input, "zone");
    expect(input._list).toEqual(["scrim", "zone"]);
    expect(input._pendingInsertion).toEqual([]);
  });

  it("replaces the list rather than mutating it, so a hit test in progress keeps the list it started with", () => {
    const input = plugin();
    input._list = ["a"];
    const inFlight = input._list;
    insertAtOnce(input, "b");
    expect(inFlight).toEqual(["a"]);
    expect(input._list).not.toBe(inFlight);
  });

  it("never lists an object twice, and clears it from the queue if something queued it first", () => {
    const input = plugin();
    input._pendingInsertion = ["zone"];
    insertAtOnce(input, "zone");
    insertAtOnce(input, "zone");
    expect(input._list).toEqual(["zone"]);
    expect(input._pendingInsertion).toEqual([]);
  });
});
