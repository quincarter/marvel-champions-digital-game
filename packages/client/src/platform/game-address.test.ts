import { describe, expect, it } from "vitest";
import { clearGameAddress, gameLinkOf, syncGameAddress, type GameAddressState } from "./game-address.js";

const ID = "3f2b8c1e-9a4d-4e57-8b21-0c6d5e7f9a10";

function page(hash = "") {
  const location = { hash, pathname: "/play/", search: "?a=1" };
  const log: string[] = [];
  const history = {
    state: null,
    replaceState(_state: unknown, _unused: string, url?: string | URL | null) {
      log.push(String(url));
      location.hash = String(url).includes("#") ? `#${String(url).split("#")[1]}` : "";
    },
  };
  return { location, history, log };
}

const playing = (over: Partial<GameAddressState> = {}): GameAddressState => ({
  status: "playing",
  gameId: ID,
  game: {},
  ...over,
});

describe("the game in the address", () => {
  it("reads a save id and ignores other hashes", () => {
    expect(gameLinkOf(page(`#game=${ID}`).location)).toBe(ID);
    expect(gameLinkOf(page("#room=ABC234").location)).toBeNull();
    expect(gameLinkOf(page("#game=has space").location)).toBeNull();
    expect(gameLinkOf(page("").location)).toBeNull();
  });

  it("writes #game=<saveId> while a game is played, once, with no new history entry", () => {
    const p = page();
    syncGameAddress(playing(), false, p.location, p.history);
    syncGameAddress(playing(), false, p.location, p.history);
    expect(p.log).toEqual([`/play/?a=1#game=${ID}`]);
  });

  it("follows a rematch to its new save", () => {
    const p = page(`#game=${ID}`);
    syncGameAddress(playing({ gameId: "other-id" }), false, p.location, p.history);
    expect(p.log).toEqual(["/play/?a=1#game=other-id"]);
  });

  it("clears it when the game is over, and for a guided run", () => {
    const over = page(`#game=${ID}`);
    syncGameAddress(playing({ game: { outcome: "won" } }), false, over.location, over.history);
    expect(over.log).toEqual(["/play/?a=1"]);
    const guided = page(`#game=${ID}`);
    syncGameAddress(playing(), true, guided.location, guided.history);
    expect(guided.log).toEqual(["/play/?a=1"]);
  });

  it("does nothing while idle, so a boot that is still resuming keeps its hash", () => {
    const p = page(`#game=${ID}`);
    syncGameAddress({ status: "idle", gameId: null, game: null }, false, p.location, p.history);
    syncGameAddress({ status: "starting", gameId: null, game: null }, false, p.location, p.history);
    expect(p.log).toEqual([]);
  });

  it("never overwrites another hash (a room or a watch owns the address)", () => {
    for (const hash of ["#room=ABC234", `#watch=${"x".repeat(12)}`]) {
      const p = page(hash);
      syncGameAddress(playing(), false, p.location, p.history);
      expect(p.log).toEqual([]);
    }
  });

  it("clearGameAddress removes only a game hash", () => {
    const p = page(`#game=${ID}`);
    clearGameAddress(p.location, p.history);
    expect(p.log).toEqual(["/play/?a=1"]);
    const room = page("#room=ABC234");
    clearGameAddress(room.location, room.history);
    expect(room.log).toEqual([]);
    expect(() => clearGameAddress(undefined, undefined)).not.toThrow();
  });
});
