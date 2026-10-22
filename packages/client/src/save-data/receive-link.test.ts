import { describe, expect, it } from "vitest";
import { takeReceiveLink, takeSyncLink } from "./receive-link.js";

function fake(hash: string) {
  const calls: { state: unknown; url: unknown }[] = [];
  return {
    calls,
    location: { hash, pathname: "/play/", search: "?x=1" },
    history: {
      state: { keep: 1 },
      replaceState: (state: unknown, _t: string, url?: unknown) => calls.push({ state, url }),
    },
  };
}

describe("takeReceiveLink", () => {
  it("returns the code and clears the hash, keeping path and query", () => {
    const { location, history, calls } = fake("#receive=ABCDEFGH.JKMN");
    expect(takeReceiveLink(location, history)).toEqual({ room: "ABCDEFGH", keyPart: "JKMN" });
    expect(calls).toEqual([{ state: { keep: 1 }, url: "/play/?x=1" }]);
  });
  it("clears an unparseable receive hash and returns null", () => {
    const { location, history, calls } = fake("#receive=nope");
    expect(takeReceiveLink(location, history)).toBeNull();
    expect(calls).toHaveLength(1);
  });
  it("leaves any other hash alone", () => {
    const { location, history, calls } = fake("#something");
    expect(takeReceiveLink(location, history)).toBeNull();
    expect(calls).toEqual([]);
  });
});

describe("takeSyncLink", () => {
  const KEY = "K".repeat(22);
  it("returns the link and clears the hash, keeping path and query", () => {
    const { location, history, calls } = fake(`#link=ABCDEFGH.${KEY}`);
    expect(takeSyncLink(location, history)).toEqual({ room: "ABCDEFGH", key: KEY });
    expect(calls).toEqual([{ state: { keep: 1 }, url: "/play/?x=1" }]);
  });
  it("clears an unparseable link hash and returns null", () => {
    const { location, history, calls } = fake("#link=nope");
    expect(takeSyncLink(location, history)).toBeNull();
    expect(calls).toHaveLength(1);
  });
  it("leaves a receive hash and any other hash alone", () => {
    for (const hash of ["#receive=ABCDEFGH.JKMN", "#something", ""]) {
      const { location, history, calls } = fake(hash);
      expect(takeSyncLink(location, history)).toBeNull();
      expect(calls).toEqual([]);
    }
  });
});
