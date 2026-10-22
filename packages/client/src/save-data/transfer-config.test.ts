import { describe, expect, it } from "vitest";
import { DEV_SYNC_URL, syncServiceUrl } from "./transfer-config.js";

describe("syncServiceUrl", () => {
  it("prefers VITE_SYNC_URL and trims trailing slashes and spaces", () => {
    expect(syncServiceUrl({ VITE_SYNC_URL: " https://mc-sync.x.workers.dev// ", DEV: true })).toBe(
      "https://mc-sync.x.workers.dev",
    );
  });

  it("falls back to the local Worker in dev", () => {
    expect(syncServiceUrl({ DEV: true })).toBe(DEV_SYNC_URL);
    expect(syncServiceUrl({ VITE_SYNC_URL: "", DEV: true })).toBe(DEV_SYNC_URL);
  });

  it("is null outside dev with nothing set", () => {
    expect(syncServiceUrl({ DEV: false })).toBeNull();
    expect(syncServiceUrl({})).toBeNull();
  });
});
