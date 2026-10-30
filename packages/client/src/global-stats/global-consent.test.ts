import { describe, expect, test } from "vitest";
import {
  GLOBAL_CONSENT_KEY,
  GLOBAL_SENT_KEY,
  SENT_CAP,
  consentSince,
  finishedIdsOf,
  markSent,
  readConsent,
  readSent,
  turnOffGlobalStats,
  turnOnGlobalStats,
  wasAsked,
} from "./global-consent.js";
import { memoryStorage, meta } from "./fixtures.js";

const throwing = {
  getItem: (): string | null => {
    throw new Error("denied");
  },
  setItem: (): void => {
    throw new Error("denied");
  },
};

describe("global consent", () => {
  test("is unset by default and not asked", () => {
    const s = memoryStorage();
    expect(readConsent(s)).toBe("unset");
    expect(wasAsked(s)).toBe(false);
  });

  test("keys do not start with mc- so device sync leaves them on this device", () => {
    const s = memoryStorage();
    turnOnGlobalStats(["a"], s);
    expect([...s.data.keys()].every((k) => !k.startsWith("mc-"))).toBe(true);
    expect(GLOBAL_CONSENT_KEY.startsWith("mc-")).toBe(false);
  });

  test("turning on snapshots the finished games and records when", () => {
    const s = memoryStorage();
    expect(turnOnGlobalStats(["a", "b"], s, 5000)).toBe(true);
    expect(readConsent(s)).toBe("on");
    expect(wasAsked(s)).toBe(true);
    expect([...readSent(s)]).toEqual(["a", "b"]);
    expect(consentSince(s)).toBe(5000);
  });

  test("turning off is remembered as asked", () => {
    const s = memoryStorage();
    turnOnGlobalStats([], s);
    expect(turnOffGlobalStats(s)).toBe(true);
    expect(readConsent(s)).toBe("off");
    expect(wasAsked(s)).toBe(true);
  });

  test("storage that throws reads unset and refuses to turn on", () => {
    expect(readConsent(throwing)).toBe("unset");
    expect(readSent(throwing).size).toBe(0);
    expect(turnOnGlobalStats(["a"], throwing)).toBe(false);
    expect(turnOnGlobalStats(["a"], null)).toBe(false);
    expect(turnOffGlobalStats(throwing)).toBe(false);
  });

  test("a failed snapshot leaves sharing off", () => {
    const s = memoryStorage();
    const failing = {
      getItem: s.getItem,
      setItem: (k: string, v: string) => {
        if (k === GLOBAL_SENT_KEY) throw new Error("full");
        s.setItem(k, v);
      },
    };
    expect(turnOnGlobalStats(["a"], failing)).toBe(false);
    expect(readConsent(s)).toBe("unset");
  });

  test("the sent set keeps the newest ids up to its cap", () => {
    const s = memoryStorage();
    markSent(
      Array.from({ length: SENT_CAP + 5 }, (_, i) => `g${i}`),
      s,
    );
    const sent = readSent(s);
    expect(sent.size).toBe(SENT_CAP);
    expect(sent.has("g0")).toBe(false);
    expect(sent.has(`g${SENT_CAP + 4}`)).toBe(true);
  });

  test("finishedIdsOf takes won and lost, not guided or active", () => {
    const won = meta();
    const lost = meta({ status: "lost" });
    const active = meta({ status: "active" });
    const guided = meta({ guided: { kind: "tutorial" } as never });
    expect(finishedIdsOf([won, lost, active, guided])).toEqual([won.id, lost.id]);
  });
});
