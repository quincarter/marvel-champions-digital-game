import { gameLinkOf } from "./game-link.js";

const GAME = "https://marvel.champions-digital-game.com/";

describe("gameLinkOf", () => {
  it.each([
    ["#replay=abc123", "replay"],
    ["#receive=ROOM.KEY", "receive"],
    ["#link=ROOM.LONGKEY", "link"],
  ] as const)("forwards %s to the new address with its fragment", (hash, kind) => {
    expect(gameLinkOf(hash, GAME)).toEqual({ kind, url: `${GAME}${hash}` });
  });

  it("ignores no hash, other hashes and an empty link", () => {
    expect(gameLinkOf("", GAME)).toBeNull();
    expect(gameLinkOf("#step-1", GAME)).toBeNull();
    expect(gameLinkOf("#replay=", GAME)).toBeNull();
  });
});
