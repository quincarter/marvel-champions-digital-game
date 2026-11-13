import { describe, expect, test } from "vitest";
import { fetchReplay, replayLinkOf, takeReplayLink, uploadReplay, type ReplayLinkDeps } from "./replay-link.js";

const ID = "AbCdEf123_-x";

function deps(respond: (url: string, init: RequestInit) => Response): ReplayLinkDeps & { calls: string[] } {
  const calls: string[] = [];
  return {
    baseUrl: "https://sync.example",
    calls,
    fetch: (async (url: string, init: RequestInit) => {
      calls.push(`${init.method} ${url}`);
      return respond(url, init);
    }) as typeof fetch,
  };
}

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("replay links", () => {
  test("uploads the file's text and answers its id", async () => {
    let sent = "";
    const d = deps((_url, init) => {
      sent = String(init.body);
      return json(201, { id: ID });
    });
    const result = await uploadReplay(new TextEncoder().encode("MCREPLAY1\nAAAA\n"), d);
    expect(result).toEqual({ ok: true, value: ID });
    expect(d.calls).toEqual(["POST https://sync.example/replay"]);
    expect(sent).toBe("MCREPLAY1\nAAAA\n");
  });

  test("says why an upload failed", async () => {
    const bytes = new Uint8Array();
    expect(
      await uploadReplay(
        bytes,
        deps(() => json(429, { reason: "rate-limited" })),
      ),
    ).toEqual({
      ok: false,
      failure: "rate-limited",
    });
    expect(
      await uploadReplay(
        bytes,
        deps(() => json(413, { reason: "too-large" })),
      ),
    ).toEqual({
      ok: false,
      failure: "too-large",
    });
    expect(
      await uploadReplay(
        bytes,
        deps(() => json(503, { reason: "disabled" })),
      ),
    ).toEqual({
      ok: false,
      failure: "unavailable",
    });
    expect(await uploadReplay(bytes, { baseUrl: null, fetch: globalThis.fetch })).toEqual({
      ok: false,
      failure: "unavailable",
    });
  });

  test("fetches a replay by id, and never asks for a malformed one", async () => {
    const d = deps(() => new Response("MCREPLAY1\nAAAA\n", { status: 200 }));
    const result = await fetchReplay(ID, d);
    expect(result.ok && new TextDecoder().decode(result.value)).toBe("MCREPLAY1\nAAAA\n");
    expect(d.calls).toEqual([`GET https://sync.example/replay/${ID}`]);
    expect(await fetchReplay("../etc", d)).toEqual({ ok: false, failure: "not-found" });
    expect(
      await fetchReplay(
        ID,
        deps(() => json(404, { reason: "not-found" })),
      ),
    ).toEqual({
      ok: false,
      failure: "not-found",
    });
  });

  test("links to this page on the web, and to the web version from the apps", () => {
    const here = { origin: "https://preview--site.netlify.app", pathname: "/" };
    expect(replayLinkOf(ID, false, here)).toBe(`https://preview--site.netlify.app/#replay=${ID}`);
    expect(replayLinkOf(ID, true, here)).toBe(`https://marvel-champions-digital-game.netlify.app/#replay=${ID}`);
  });

  test("reads a #replay= link once and clears it from the address", () => {
    const replaced: string[] = [];
    const history = {
      state: null,
      replaceState: (_d: unknown, _u: string, url?: string | URL | null) => void replaced.push(String(url)),
    };
    expect(takeReplayLink({ hash: `#replay=${ID}`, pathname: "/", search: "?x=1" }, history)).toBe(ID);
    expect(replaced).toEqual(["/?x=1"]);
    expect(takeReplayLink({ hash: "#replay=nope", pathname: "/", search: "" }, history)).toBe("invalid");
    expect(takeReplayLink({ hash: "#replay=%E0", pathname: "/", search: "" }, history)).toBe("invalid");
    expect(takeReplayLink({ hash: "#receive=AB", pathname: "/", search: "" }, history)).toBeNull();
    expect(replaced).toHaveLength(3);
  });
});
