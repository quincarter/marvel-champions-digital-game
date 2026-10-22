import { describe, expect, test } from "vitest";
import { syncIsAvailable } from "./sync-available.js";

const answering = (status: number, body: unknown, calls: { url: string; init?: RequestInit }[] = []): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(input), ...(init ? { init } : {}) });
    return new Response(typeof body === "string" ? body : JSON.stringify(body), { status });
  }) as typeof fetch;

describe("syncIsAvailable", () => {
  test("a Worker that answers the status route 200 { sync: true } is available, by a plain GET", async () => {
    const calls: { url: string; init?: RequestInit }[] = [];
    const ok = await syncIsAvailable(
      { baseUrl: "https://sync.example", fetch: answering(200, { sync: true }, calls) },
      { unavailable: false },
    );
    expect(ok).toBe(true);
    expect(calls.map((c) => c.url)).toEqual(["https://sync.example/sync/status"]);
    // No method, headers or body: a simple request, so no preflight and no credential.
    expect(calls[0]!.init?.method).toBeUndefined();
    expect(calls[0]!.init?.headers).toBeUndefined();
  });

  test("no Worker URL, a 503, an older Worker (404 JSON), junk and a dropped connection are all unavailable", async () => {
    const check = (deps: Parameters<typeof syncIsAvailable>[0]) => syncIsAvailable(deps, { unavailable: false });
    expect(await check({ baseUrl: null, fetch: answering(200, { sync: true }) })).toBe(false);
    expect(await check({ baseUrl: "https://s", fetch: answering(503, { reason: "disabled", error: "off" }) })).toBe(
      false,
    );
    expect(await check({ baseUrl: "https://s", fetch: answering(404, { reason: "not-found", error: "x" }) })).toBe(
      false,
    );
    expect(await check({ baseUrl: "https://s", fetch: answering(404, "Not Found") })).toBe(false);
    expect(await check({ baseUrl: "https://s", fetch: answering(200, {}) })).toBe(false);
    const down = (async () => {
      throw new TypeError("network");
    }) as typeof fetch;
    expect(await check({ baseUrl: "https://s", fetch: down })).toBe(false);
  });

  test("unavailable is remembered for the page load: the next ask makes no request", async () => {
    const calls: { url: string }[] = [];
    const memory = { unavailable: false };
    expect(await syncIsAvailable({ baseUrl: "https://s", fetch: answering(503, {}, calls) }, memory)).toBe(false);
    expect(await syncIsAvailable({ baseUrl: "https://s", fetch: answering(200, { sync: true }, calls) }, memory)).toBe(
      false,
    );
    expect(calls).toHaveLength(1);
  });
});
