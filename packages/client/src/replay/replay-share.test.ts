import { describe, expect, test } from "vitest";
import { deliverReplayLink, isAbort, shareFailureKey, shareLinkOf } from "./replay-share.js";

const abort = (): Error => Object.assign(new Error("closed"), { name: "AbortError" });

describe("deliverReplayLink", () => {
  test("hands the link to the share sheet where there is one; closing the sheet counts as handled", async () => {
    const shared: ShareData[] = [];
    const copied: string[] = [];
    const outlets = {
      share: async (data: ShareData) => void shared.push(data),
      copy: async (text: string) => void copied.push(text),
    };
    expect(await deliverReplayLink("https://x/#replay=a", "Replay", outlets)).toBe("shared");
    expect(shared).toEqual([{ url: "https://x/#replay=a", title: "Replay" }]);
    expect(copied).toEqual([]);
    expect(
      await deliverReplayLink("u", "t", { share: async () => Promise.reject(abort()), copy: async () => undefined }),
    ).toBe("shared");
  });

  test("copies it when there is no sheet or the sheet refuses, and says when nothing takes it", async () => {
    const copied: string[] = [];
    const copy = async (text: string): Promise<void> => void copied.push(text);
    expect(await deliverReplayLink("u", "t", { copy })).toBe("copied");
    expect(await deliverReplayLink("v", "t", { share: async () => Promise.reject(new Error("no")), copy })).toBe(
      "copied",
    );
    expect(copied).toEqual(["u", "v"]);
    expect(await deliverReplayLink("w", "t", { copy: async () => Promise.reject(new Error("denied")) })).toBe("manual");
  });
});

describe("shareLinkOf", () => {
  const deps = (status: number, body: unknown) => ({
    baseUrl: "https://sync.example",
    fetch: (async () => new Response(JSON.stringify(body), { status })) as unknown as typeof fetch,
  });

  test("uploads the bytes and answers the link; a refused upload answers why", async () => {
    const ok = await shareLinkOf(new Uint8Array([65]), true, deps(201, { id: "AbCdEf123_-x" }));
    expect(ok.ok && ok.url.endsWith("#replay=AbCdEf123_-x")).toBe(true);
    expect(await shareLinkOf(new Uint8Array([65]), true, deps(429, {}))).toEqual({
      ok: false,
      failure: "rate-limited",
    });
  });
});

describe("wording", () => {
  test("every failure has its message, and only an AbortError is the player closing a dialog", () => {
    expect(shareFailureKey("full")).toBe("replay.link.full");
    expect(shareFailureKey("unavailable")).toBe("replay.link.offline");
    expect(isAbort(abort())).toBe(true);
    expect(isAbort(new Error("x"))).toBe(false);
    expect(isAbort(null)).toBe(false);
  });
});
