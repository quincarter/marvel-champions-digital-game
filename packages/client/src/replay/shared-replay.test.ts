import { describe, expect, it, vi } from "vitest";
import { ReplayOpenError } from "./replay-core.js";
import type { ReplayHost } from "./replay-host.js";
import { loadSharedReplay, replayLinkFailureKey, type SharedReplayDeps } from "./shared-replay.js";

const host = { dispose: vi.fn() } as unknown as ReplayHost;
const bytes = new Uint8Array([1, 2, 3]);

function deps(overrides: Partial<SharedReplayDeps> = {}): SharedReplayDeps {
  return {
    fetch: async () => ({ ok: true, value: bytes }),
    open: async () => host,
    ...overrides,
  };
}

describe("loadSharedReplay (issue #858)", () => {
  it("fetches the replay and opens it", async () => {
    const open = vi.fn(async () => host);
    const fetch = vi.fn(async () => ({ ok: true as const, value: bytes }));
    await expect(loadSharedReplay("abc123", deps({ fetch, open }))).resolves.toEqual({ ok: true, host });
    expect(fetch).toHaveBeenCalledWith("abc123");
    expect(open).toHaveBeenCalledWith(bytes);
  });

  it("says the link isn't valid without fetching anything", async () => {
    const fetch = vi.fn();
    await expect(loadSharedReplay("invalid", deps({ fetch }))).resolves.toEqual({
      ok: false,
      message: "replay.link.invalid",
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it("says an expired or unknown replay is gone", async () => {
    const result = await loadSharedReplay("abc123", deps({ fetch: async () => ({ ok: false, failure: "not-found" }) }));
    expect(result).toEqual({ ok: false, message: "replay.link.gone" });
  });

  it("says the service couldn't be reached, also when the fetch throws", async () => {
    for (const fetch of [
      async () => ({ ok: false as const, failure: "unavailable" as const }),
      async () => ({ ok: false as const, failure: "rate-limited" as const }),
      async () => Promise.reject(new Error("offline")),
    ]) {
      await expect(loadSharedReplay("abc123", deps({ fetch }))).resolves.toEqual({
        ok: false,
        message: "replay.link.offline",
      });
    }
  });

  it("says why a fetched replay wouldn't open", async () => {
    const open = async (): Promise<ReplayHost> => Promise.reject(new ReplayOpenError("newerFormat"));
    await expect(loadSharedReplay("abc123", deps({ open }))).resolves.toEqual({
      ok: false,
      message: "replay.error.newerFormat",
    });
  });

  it("words each fetch failure", () => {
    expect(replayLinkFailureKey("not-found")).toBe("replay.link.gone");
    expect(replayLinkFailureKey("unavailable")).toBe("replay.link.offline");
    expect(replayLinkFailureKey("full")).toBe("replay.link.offline");
  });
});
