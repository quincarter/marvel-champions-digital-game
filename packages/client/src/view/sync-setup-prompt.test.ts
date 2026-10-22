import { describe, expect, test } from "vitest";
import {
  SYNC_NOTICE_BODY,
  hasProgressKeys,
  titleIsTopScene,
  SYNC_PROMPTED_KEY,
  SYNC_SEEN_KEY,
  SYNC_SETUP_LATER,
  markSyncPromptAnswered,
  markSyncPromptSeen,
  shouldShowSyncSetupPrompt,
  syncPromptAnswered,
  syncPromptSeen,
  syncSetupAnswerOutcome,
  syncSetupButtonSpan,
  SYNC_SETUP_BUTTON_MAX,
  type SyncSetupPromptInputs,
} from "./sync-setup-prompt.js";

describe("the prompt's button stack", () => {
  test("is centred in a content box wider than the cap (desktop: a 520 panel with 20 padding)", () => {
    const left = 400;
    const width = 480;
    const span = syncSetupButtonSpan(left, width);
    expect(span.width).toBe(SYNC_SETUP_BUTTON_MAX);
    expect(span.x - left).toBe(left + width - (span.x + span.width));
  });

  test("fills a narrower content box (phone portrait)", () => {
    expect(syncSetupButtonSpan(32, 311)).toEqual({ x: 32, width: 311 });
  });
});

const base: SyncSetupPromptInputs = {
  syncOn: false,
  answered: false,
  hasSavedGames: false,
  firstLaunchSinceUpdate: false,
  hasOtherSaveData: false,
};

describe("sync setup prompt decision", () => {
  test("a player with a saved game of any status is asked", () => {
    expect(shouldShowSyncSetupPrompt({ ...base, hasSavedGames: true })).toBe(true);
  });

  test("an existing player is asked on the first launch since the update, and not on later ones", () => {
    const existing = { ...base, hasOtherSaveData: true };
    expect(shouldShowSyncSetupPrompt({ ...existing, firstLaunchSinceUpdate: true })).toBe(true);
    expect(shouldShowSyncSetupPrompt(existing)).toBe(false);
  });

  test("a brand-new player with nothing saved is not asked", () => {
    expect(shouldShowSyncSetupPrompt({ ...base, firstLaunchSinceUpdate: true })).toBe(false);
  });

  test("never when sync is on or the player already answered", () => {
    expect(shouldShowSyncSetupPrompt({ ...base, hasSavedGames: true, syncOn: true })).toBe(false);
    expect(shouldShowSyncSetupPrompt({ ...base, hasSavedGames: true, answered: true })).toBe(false);
  });

  test("Not now is the only answer that leaves a notice", () => {
    expect(syncSetupAnswerOutcome("not-now")).toEqual({ notice: true, openSyncScreen: null });
    expect(syncSetupAnswerOutcome("set-up")).toEqual({ notice: false, openSyncScreen: "setup" });
    expect(syncSetupAnswerOutcome("join")).toEqual({ notice: false, openSyncScreen: "join" });
  });
});

describe("sync setup prompt wording and markers", () => {
  test("the pointer line is exact and the notice repeats it", () => {
    expect(SYNC_SETUP_LATER).toBe("You can set this up any time in Settings → More → Save data → Sync across devices.");
    expect(SYNC_NOTICE_BODY).toBe(SYNC_SETUP_LATER);
  });

  test("the markers are not mc- keys, so an export and a sync never carry them", () => {
    expect(SYNC_PROMPTED_KEY.startsWith("mc-")).toBe(false);
    expect(SYNC_SEEN_KEY.startsWith("mc-")).toBe(false);
  });

  test("answers are remembered, and storage that throws reads as not answered", () => {
    const map = new Map<string, string>();
    const storage = {
      getItem: (key: string) => map.get(key) ?? null,
      setItem: (key: string, value: string) => void map.set(key, value),
    };
    expect(syncPromptAnswered(storage)).toBe(false);
    markSyncPromptAnswered(storage);
    expect(syncPromptAnswered(storage)).toBe(true);
    expect(syncPromptSeen(storage)).toBe(false);
    markSyncPromptSeen(storage);
    expect(syncPromptSeen(storage)).toBe(true);

    const refusing = {
      getItem: (): string | null => {
        throw new Error("denied");
      },
      setItem: (): void => {
        throw new Error("denied");
      },
    };
    expect(syncPromptAnswered(refusing)).toBe(false);
    expect(() => markSyncPromptAnswered(refusing)).not.toThrow();
    expect(syncPromptAnswered(null)).toBe(false);
  });
});

describe("what counts as existing-player progress", () => {
  test("first-launch bookkeeping never does", () => {
    expect(hasProgressKeys(["mc-rank-seen", "mc-achievements-seen", "mc-guide", "mc-settings", "mc-extras"])).toBe(
      false,
    );
    expect(hasProgressKeys([])).toBe(false);
  });

  test("unlock choices, deck feats and a campaign's choices do", () => {
    expect(hasProgressKeys(["mc-rank-seen", "mc-unlocks"])).toBe(true);
    expect(hasProgressKeys(["mc-deck-feats"])).toBe(true);
    expect(hasProgressKeys(["mc-deck-freeze-optin:run-1"])).toBe(true);
  });
});

describe("whether Title is still the top screen", () => {
  const alwaysUp = new Set(["Music", "ReportButton"]);
  test("only Title and the always-up chrome running: yes", () => {
    expect(titleIsTopScene(["Title", "Music", "ReportButton"], "Title", alwaysUp)).toBe(true);
  });
  test("anything else over it, the games list or Settings included: no", () => {
    expect(titleIsTopScene(["Title", "Music", "GamesList"], "Title", alwaysUp)).toBe(false);
    expect(titleIsTopScene(["Title", "SettingsOverlay"], "Title", alwaysUp)).toBe(false);
  });
});
