import { describe, expect, it } from "vitest";
import { joinTargetFromInput, tidyJoinInput } from "./room-join-input.js";

describe("joinTargetFromInput", () => {
  it("reads a code in any case, with dashes", () => {
    expect(joinTargetFromInput("abc-234")).toBe("ABC234");
    expect(joinTargetFromInput(" abc 234 ")).toBe("ABC234");
  });
  it("reads a pasted web link and an app link", () => {
    expect(joinTargetFromInput("https://marvel.champions-digital-game.com/#join=abc234")).toBe("ABC234");
    expect(joinTargetFromInput("marvelchampions://join/abc234")).toBe("ABC234");
  });
  it("is null until it names a room", () => {
    expect(joinTargetFromInput("")).toBeNull();
    expect(joinTargetFromInput("ABC")).toBeNull();
    expect(joinTargetFromInput("ILO000")).toBeNull();
  });
});

describe("tidyJoinInput", () => {
  it("uppercases a code and leaves a link alone", () => {
    expect(tidyJoinInput("abc 234")).toBe("ABC234");
    expect(tidyJoinInput("https://x.test/#join=abc234")).toBe("https://x.test/#join=abc234");
  });
});
