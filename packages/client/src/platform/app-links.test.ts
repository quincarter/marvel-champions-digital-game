import { describe, expect, it, vi } from "vitest";
import {
  appReplayLinkOf,
  gameFragmentOf,
  offersDesktopApp,
  startAppLinks,
  type AppLinkSource,
  type LaunchLinkMemory,
} from "./app-links.js";

describe("gameFragmentOf (#862)", () => {
  it("reads the desktop app's links", () => {
    expect(gameFragmentOf("marvelchampions://replay/xqfaQSjheyfI")).toBe("#replay=xqfaQSjheyfI");
    expect(gameFragmentOf("marvelchampions://replay/xqfaQSjheyfI/")).toBe("#replay=xqfaQSjheyfI");
    expect(gameFragmentOf("marvelchampions://receive/ABCD1234")).toBe("#receive=ABCD1234");
    expect(gameFragmentOf("marvelchampions://open#replay=xqfaQSjheyfI")).toBe("#replay=xqfaQSjheyfI");
  });

  it("reads the game's own address, as Android's App Links hand it over", () => {
    expect(gameFragmentOf("https://marvel.champions-digital-game.com/#replay=xqfaQSjheyfI")).toBe(
      "#replay=xqfaQSjheyfI",
    );
    expect(gameFragmentOf("https://marvel.champions-digital-game.com/?lang=es#link=abc")).toBe("#link=abc");
  });

  it("ignores links that open nothing in the game", () => {
    expect(gameFragmentOf("marvelchampions://replay/")).toBeNull();
    expect(gameFragmentOf("marvelchampions://settings/x")).toBeNull();
    expect(gameFragmentOf("https://marvel.champions-digital-game.com/")).toBeNull();
    expect(gameFragmentOf("https://example.com/#replay=xqfaQSjheyfI")).toBeNull();
    expect(gameFragmentOf("not a link")).toBeNull();
  });

  it("makes the desktop app's replay link", () => {
    expect(appReplayLinkOf("xqfaQSjheyfI")).toBe("marvelchampions://replay/xqfaQSjheyfI");
    expect(gameFragmentOf(appReplayLinkOf("xqfaQSjheyfI"))).toBe("#replay=xqfaQSjheyfI");
  });
});

describe("offersDesktopApp (#862)", () => {
  it("offers it on the web version on a desktop browser only", () => {
    const desktop = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/140.0";
    expect(offersDesktopApp("web", desktop)).toBe(true);
    expect(offersDesktopApp("tauri", desktop)).toBe(false);
    expect(offersDesktopApp("capacitor", desktop)).toBe(false);
    expect(offersDesktopApp("web", "Mozilla/5.0 (Linux; Android 15; Pixel 10) Mobile Safari")).toBe(false);
    expect(offersDesktopApp("web", "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0)")).toBe(false);
  });
});

function fakes(launch: string[]) {
  let onLink: (link: string) => void = () => undefined;
  const source: AppLinkSource = {
    launchLinks: async () => launch,
    listen: (listener) => (onLink = listener),
  };
  const location = { hash: "", pathname: "/", search: "", reload: vi.fn() };
  const history = {
    state: null,
    replaceState: vi.fn((_state: unknown, _unused: string, url: string) => {
      location.hash = url.slice(url.indexOf("#"));
    }),
  };
  let stored: string | null = null;
  const memory: LaunchLinkMemory = { get: () => stored, set: (link) => (stored = link) };
  return { source, location, history, memory, send: (link: string) => onLink(link) };
}

describe("startAppLinks (#862)", () => {
  it("puts the launch link on the address before the game starts, once per run", async () => {
    const f = fakes(["marvelchampions://replay/xqfaQSjheyfI"]);
    await startAppLinks(Promise.resolve(f.source), f.location, f.history, 600, f.memory);
    expect(f.history.replaceState).toHaveBeenCalledWith(null, "", "/#replay=xqfaQSjheyfI");
    expect(f.location.reload).not.toHaveBeenCalled();

    // The shell still answers the same launch link after a reload: it is not opened again.
    const again = fakes(["marvelchampions://replay/xqfaQSjheyfI"]);
    await startAppLinks(Promise.resolve(again.source), again.location, again.history, 600, f.memory);
    expect(again.history.replaceState).not.toHaveBeenCalled();
  });

  it("reloads with a link that arrives while the game runs", async () => {
    const f = fakes([]);
    await startAppLinks(Promise.resolve(f.source), f.location, f.history, 600, f.memory);
    f.send("https://marvel.champions-digital-game.com/#replay=abcdefghijkl");
    expect(f.location.hash).toBe("#replay=abcdefghijkl");
    expect(f.location.reload).toHaveBeenCalledTimes(1);
    f.send("https://example.com/");
    expect(f.location.reload).toHaveBeenCalledTimes(1);
  });

  it("does nothing on the web, and never holds the game back for a slow shell", async () => {
    await expect(startAppLinks(null)).resolves.toBeUndefined();
    const f = fakes([]);
    const slow: AppLinkSource = { ...f.source, launchLinks: () => new Promise(() => undefined) };
    const started = Date.now();
    await startAppLinks(Promise.resolve(slow), f.location, f.history, 20, f.memory);
    expect(Date.now() - started).toBeLessThan(500);
  });
});
