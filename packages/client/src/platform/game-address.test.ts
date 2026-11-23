import { describe, expect, it } from "vitest";
import { fakePage } from "./address-page.js";
import { clearGameAddress, gameLinkOf, syncGameAddress, type GameAddressState } from "./game-address.js";

const ID = "3f2b8c1e-9a4d-4e57-8b21-0c6d5e7f9a10";

const playing = (over: Partial<GameAddressState> = {}): GameAddressState => ({
  status: "playing",
  gameId: ID,
  game: {},
  ...over,
});

describe("the game in the address", () => {
  it("reads a save id and ignores other params", () => {
    expect(gameLinkOf(fakePage(`/?game=${ID}`).location)).toBe(ID);
    expect(gameLinkOf(fakePage("/?room=ABC234").location)).toBeNull();
    expect(gameLinkOf(fakePage("/?game=has%20space").location)).toBeNull();
    expect(gameLinkOf(fakePage("/").location)).toBeNull();
  });

  it("sets ?game=<saveId> while a game is played, once, keeping other params and the path", () => {
    const p = fakePage("/play/?a=1");
    syncGameAddress(playing(), false, p.location, p.history);
    syncGameAddress(playing(), false, p.location, p.history);
    expect(p.log).toEqual([`/play/?a=1&game=${ID}`]);
  });

  it("keeps a dev ?screen= jump in the address (the jump wins on a reload)", () => {
    const p = fakePage("/?screen=board&deck=x");
    syncGameAddress(playing(), false, p.location, p.history);
    expect(p.url()).toBe(`/?screen=board&deck=x&game=${ID}`);
  });

  it("follows a rematch to its new save", () => {
    const p = fakePage(`/?game=${ID}`);
    syncGameAddress(playing({ gameId: "other-id" }), false, p.location, p.history);
    expect(p.log).toEqual(["/?game=other-id"]);
  });

  it("clears it when the game is over, and for a guided run", () => {
    const over = fakePage(`/?game=${ID}`);
    syncGameAddress(playing({ game: { outcome: "won" } }), false, over.location, over.history);
    expect(over.log).toEqual(["/"]);
    const guided = fakePage(`/?game=${ID}`);
    syncGameAddress(playing(), true, guided.location, guided.history);
    expect(guided.log).toEqual(["/"]);
  });

  it("does nothing while idle, so a boot that is still resuming keeps its param", () => {
    const p = fakePage(`/?game=${ID}`);
    syncGameAddress({ status: "idle", gameId: null, game: null }, false, p.location, p.history);
    syncGameAddress({ status: "starting", gameId: null, game: null }, false, p.location, p.history);
    expect(p.log).toEqual([]);
  });

  it("never replaces a room or a watch (they own the address)", () => {
    for (const url of ["/?room=ABC234", `/?watching=${"x".repeat(12)}`]) {
      const p = fakePage(url);
      syncGameAddress(playing(), false, p.location, p.history);
      expect(p.log).toEqual([]);
    }
  });

  it("clearGameAddress removes only the game param", () => {
    const p = fakePage(`/?a=1&game=${ID}`);
    clearGameAddress(p.location, p.history);
    expect(p.log).toEqual(["/?a=1"]);
    const room = fakePage("/?room=ABC234");
    clearGameAddress(room.location, room.history);
    expect(room.log).toEqual([]);
    expect(() => clearGameAddress(undefined, undefined)).not.toThrow();
  });
});

describe("a game walked away from while it loaded", () => {
  it("stays out of the address until Title lets it back", async () => {
    const { suppressGameAddress, releaseGameAddress } = await import("./game-address.js");
    const p = fakePage("/");
    suppressGameAddress(ID);
    syncGameAddress(playing(), false, p.location, p.history);
    expect(p.log).toEqual([]);
    releaseGameAddress();
    syncGameAddress(playing(), false, p.location, p.history);
    expect(p.log).toEqual([`/?game=${ID}`]);
  });
});
