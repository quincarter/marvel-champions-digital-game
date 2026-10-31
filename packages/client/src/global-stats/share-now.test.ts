import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { GLOBAL_CONSENT_KEY, GLOBAL_SENT_KEY, readConsent } from "./global-consent.js";
import { memoryStorage, meta } from "./fixtures.js";

// A plain function (a vi.fn that rejects is reported as a failure by the runner).
let saves: () => Promise<unknown> = async () => [];
vi.mock("../session.js", () => ({ appSession: () => ({ store: { listSaves: () => saves() } }) }));

const { shareFinishedGamesNow } = await import("./share-now.js");

describe("shareFinishedGamesNow", () => {
  beforeEach(() => {
    saves = async () => [];
  });
  afterEach(() => vi.unstubAllGlobals());

  test("the finished games are in the sent set when consent turns on", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    const a = meta();
    const b = meta({ status: "lost", outcome: { result: "loss", reason: "mainSchemeCompleted" } });
    const open = meta({ status: "active", outcome: null });
    saves = async () => [a, b, open];
    // Consent is written after the sent set, so a reader that sees "on" always sees the snapshot.
    const order: string[] = [];
    const set = storage.setItem;
    storage.setItem = (key: string, value: string) => {
      order.push(key);
      set(key, value);
    };
    expect(await shareFinishedGamesNow()).toBe(true);
    expect(readConsent(storage)).toBe("on");
    expect(JSON.parse(storage.data.get(GLOBAL_SENT_KEY)!)).toEqual([a.id, b.id]);
    expect(order.indexOf(GLOBAL_SENT_KEY)).toBeLessThan(order.indexOf(GLOBAL_CONSENT_KEY));
  });

  test("a failed read of the saves returns false and leaves consent as it was", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    saves = async () => {
      throw new Error("idb down");
    };
    expect(await shareFinishedGamesNow()).toBe(false);
    expect(readConsent(storage)).toBe("unset");
    expect(storage.data.size).toBe(0);
  });

  test("a storage write that fails stays off", async () => {
    const storage = memoryStorage();
    vi.stubGlobal("localStorage", storage);
    saves = async () => [meta()];
    storage.setItem = () => {
      throw new Error("quota");
    };
    expect(await shareFinishedGamesNow()).toBe(false);
    expect(readConsent(storage)).toBe("unset");
  });
});
