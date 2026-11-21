import { describe, expect, it, vi } from "vitest";
import { joinTargetOf, takeJoinLink } from "./join-link.js";

const at = (hash: string) => {
  const replaceState = vi.fn();
  return {
    location: { hash, pathname: "/", search: "" },
    history: { state: null, replaceState } as never,
    replaceState,
  };
};

describe("takeJoinLink", () => {
  it("reads a code in any case and clears the address", () => {
    const { location, history, replaceState } = at("#join=abc-234");
    expect(takeJoinLink(location, history)).toBe("ABC234");
    expect(replaceState).toHaveBeenCalled();
  });
  it("reads a room id", () => {
    const { location, history } = at(`#join=${"a".repeat(12)}`);
    expect(takeJoinLink(location, history)).toBe("a".repeat(12));
  });
  it("calls anything else invalid, and ignores other hashes", () => {
    expect(takeJoinLink(at("#join=zzz").location, at("").history)).toBe("invalid");
    expect(takeJoinLink(at("#watch=x").location, at("").history)).toBeNull();
    expect(joinTargetOf("AB1234")).toBeNull();
  });
});
