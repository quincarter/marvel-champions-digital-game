import { describe, expect, test } from "vitest";
import type { GameConflict } from "../sync/sync-types.js";
import {
  conflictPromptOf,
  groupedInputOf,
  recoveryCodeText,
  syncFailureStatusOf,
  syncLinkUrlOf,
  syncStatusDisplay,
  syncStatusNeedsAttention,
  syncStatusText,
  syncStepWorking,
  UNAVAILABLE_TEXT,
} from "./sync-model.js";

const CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23";
const KEY = "K".repeat(22);

describe("the recovery code as shown", () => {
  test("groups a code in fives, and leaves a non-code alone", () => {
    expect(recoveryCodeText(CODE)).toBe("ABCDE-FGHJK-MNPQR-STUVW-XYZ23");
    expect(recoveryCodeText("short")).toBe("short");
  });

  test("groups what is typed, in upper case, ignoring separators", () => {
    expect(groupedInputOf("abcdefg")).toBe("ABCDE-FG");
    expect(groupedInputOf("abcde-fghjk mnpqr")).toBe("ABCDE-FGHJK-MNPQR");
    expect(groupedInputOf("")).toBe("");
  });
});

describe("the link", () => {
  test("is the page address with the link fragment, which never reaches a server", () => {
    expect(syncLinkUrlOf({ room: "ABCDEFGH", key: KEY }, { origin: "https://x.test", pathname: "/play/" })).toBe(
      `https://x.test/play/#link=ABCDEFGH.${KEY}`,
    );
  });
});

describe("steps", () => {
  test("work in flight locks the screen", () => {
    expect(syncStepWorking({ kind: "setup", phase: "creating" })).toBe(true);
    expect(syncStepWorking({ kind: "join", phase: "working", input: "" })).toBe(true);
    expect(syncStepWorking({ kind: "link", phase: "uploading" })).toBe(true);
    expect(syncStepWorking({ kind: "home" })).toBe(false);
    expect(syncStepWorking({ kind: "join", phase: "typing", input: "" })).toBe(false);
  });
});

describe("status", () => {
  test("reads the scheduler's status", () => {
    expect(syncStatusText({ state: "off", lastSyncedAt: null }, 0)).toBe("Off");
    expect(syncStatusText({ state: "synced", lastSyncedAt: 0 }, 120_000)).toBe("Synced 2 min ago");
    expect(syncStatusText({ state: "offline", lastSyncedAt: 0 }, 0)).toBe("Offline, changes waiting");
  });

  test("an error or offline state asks to be looked at", () => {
    expect(syncStatusNeedsAttention({ state: "offline", lastSyncedAt: null })).toBe(true);
    expect(syncStatusNeedsAttention({ state: "error", lastSyncedAt: null })).toBe(true);
    expect(syncStatusNeedsAttention({ state: "synced", lastSyncedAt: 1 })).toBe(false);
  });
});

describe("failures", () => {
  test("every failure has a sentence, and a wrong code uses the owner's wording", () => {
    expect(syncFailureStatusOf({ kind: "wrong-code" }).text).toContain("didn't match any synced saves");
    expect(syncFailureStatusOf({ kind: "unavailable" })).toEqual({ tone: "error", text: UNAVAILABLE_TEXT });
    expect(UNAVAILABLE_TEXT).toBe("Online sync is unavailable right now. Your saves stay on this device.");
    const kinds = [
      { kind: "unsupported" },
      { kind: "invalid-code" },
      { kind: "rate-limited" },
      { kind: "blocked" },
      { kind: "space-full" },
      { kind: "too-large" },
      { kind: "storage" },
      { kind: "not-on" },
      { kind: "not-found" },
      { kind: "error", message: "boom" },
      { kind: "link", failure: { kind: "not-found" } },
      { kind: "link", failure: { kind: "damaged", detail: "x" } },
    ] as const;
    for (const failure of kinds) {
      const status = syncFailureStatusOf(failure);
      expect(status.tone).toBe("error");
      expect(status.text.length).toBeGreaterThan(3);
    }
  });
});

describe("the conflict prompt", () => {
  const conflict = (over: Partial<GameConflict> = {}): GameConflict => ({
    gameId: "g1",
    label: "Rhino · Spider-Man",
    local: { round: 4, updatedAt: 1_000_000 },
    remote: { round: 6, updatedAt: 1_000_000 + 3 * 60_000 },
    campaign: false,
    ...over,
  });

  test("names the game and each side's round and time, and says which is newer", () => {
    const prompt = conflictPromptOf(conflict(), 1_000_000 + 5 * 60_000);
    expect(prompt.body).toContain("Rhino · Spider-Man");
    expect(prompt.local).toEqual({ heading: "This device", line: "Round 4, played 5 min ago", newer: false });
    expect(prompt.remote).toEqual({ heading: "The other device", line: "Round 6, played 2 min ago", newer: true });
  });

  test("offers three choices, focused on Keep both", () => {
    const prompt = conflictPromptOf(conflict(), 2_000_000);
    expect(prompt.buttons.map((b) => b.choice)).toEqual(["keep-local", "keep-remote", "keep-both"]);
    expect(prompt.buttons.map((b) => b.label)).toEqual(["Keep this device", "Keep the other device", "Keep both"]);
    expect(prompt.defaultChoice).toBe("keep-both");
    expect(prompt.campaignNote).toBeNull();
  });

  test("a campaign game cannot keep both, says why, and focuses Keep this device", () => {
    const prompt = conflictPromptOf(conflict({ campaign: true }), 2_000_000);
    expect(prompt.buttons.map((b) => b.choice)).toEqual(["keep-local", "keep-remote"]);
    expect(prompt.defaultChoice).toBe("keep-local");
    expect(prompt.campaignNote).toContain("campaign");
  });

  test("an unknown play time is said so, not shown as long ago", () => {
    const prompt = conflictPromptOf(conflict({ local: { round: 1, updatedAt: 0 } }), 2_000_000);
    expect(prompt.local.line).toBe("Round 1, play time unknown");
    expect(prompt.local.newer).toBe(false);
  });
});

describe("shared wording", () => {
  test("a linked device that has not run yet is starting, not off (Save data and the sync screen agree)", () => {
    expect(syncStatusDisplay(true, { state: "off", lastSyncedAt: null }, 0)).toBe("Starting…");
    expect(syncStatusDisplay(false, { state: "off", lastSyncedAt: null }, 0)).toBe("Off");
    expect(syncStatusDisplay(true, { state: "synced", lastSyncedAt: 0 }, 0)).toBe("Synced just now");
  });

  test("an unexpected error never shows its exception text", () => {
    const status = syncFailureStatusOf({ kind: "error", message: "IDBTransaction aborted at 0x7f" });
    expect(status.text).not.toContain("IDB");
    expect(status.text).toBe("Sync hit a problem. Try again in a moment.");
  });
});
