import { describe, expect, test, vi } from "vitest";
import { watchLinkOf } from "./live-publisher.js";
import { takeWatchLink } from "./watch-link.js";

const ID = "AbCdEf123_-x";

function at(hash: string) {
  const history = { state: null, replaceState: vi.fn() };
  return { location: { hash, pathname: "/", search: "?a=1" }, history };
}

describe("takeWatchLink", () => {
  test("reads the room id and clears the hash from the address", () => {
    const { location, history } = at(`#watch=${ID}`);
    expect(takeWatchLink(location, history)).toBe(ID);
    expect(history.replaceState).toHaveBeenCalledWith(null, "", "/?a=1");
  });

  test("is null for any other hash, and leaves the address alone", () => {
    const { location, history } = at(`#replay=${ID}`);
    expect(takeWatchLink(location, history)).toBeNull();
    expect(takeWatchLink(at("").location, history)).toBeNull();
    expect(history.replaceState).not.toHaveBeenCalled();
  });

  test("calls a link that names no room invalid", () => {
    for (const hash of ["#watch=", "#watch=short", "#watch=has space!!", `#watch=${ID}x`, "#watch=%E0%A4%A"]) {
      const { location, history } = at(hash);
      expect(takeWatchLink(location, history)).toBe("invalid");
    }
  });

  test("reads what the host makes as its link", () => {
    const link = watchLinkOf(ID, "https://marvel.example/");
    const { location, history } = at(link.slice(link.indexOf("#")));
    expect(takeWatchLink(location, history)).toBe(ID);
  });
});
