import { describe, expect, test } from "vitest";
import { NO_LIVE_STATUS } from "../live/live-publisher.js";
import { defaultSettings } from "../settings.js";
import { watchToastOf, copyWatchLink, pauseWatchLinkOf, watchBadgeOf, watchLinkLabelOf } from "./live-watch-ui.js";
import { liveWatchRowInfoOf, nextSettingsAfterToggle } from "./settings-rows.js";

const URL = "https://marvel.champions-digital-game.com/#watch=abc";

describe("the watcher badge", () => {
  test("shows while a watch link exists, with the count once someone watches", () => {
    expect(watchBadgeOf(NO_LIVE_STATUS)).toBeNull();
    expect(watchBadgeOf({ watchUrl: null, watchers: 2, connected: false })).toBeNull();
    // With a link and nobody yet, the eye is there to share the link from.
    expect(watchBadgeOf({ watchUrl: URL, watchers: 0, connected: true })).toEqual({ count: 0, label: "Watch link" });
    expect(watchBadgeOf({ watchUrl: URL, watchers: 3, connected: true })).toEqual({ count: 3, label: "3 watching" });
  });
});

describe("the badge's toast", () => {
  test("says copied, says nothing when the share sheet took it, shows the link when nothing would copy", () => {
    expect(watchToastOf("copied", URL)).toBe("Watch link copied");
    expect(watchToastOf("shared", URL)).toBeNull();
    expect(watchToastOf("manual", URL)).toContain(URL);
  });
});

describe("Copy watch link", () => {
  test("is offered only while a link exists", () => {
    expect(pauseWatchLinkOf(NO_LIVE_STATUS)).toBeNull();
    expect(pauseWatchLinkOf({ watchUrl: URL, watchers: 0, connected: false })).toBe(URL);
  });

  test("its words, and Link copied after a copy", () => {
    expect(watchLinkLabelOf(false, false)).toBe("Copy watch link");
    expect(watchLinkLabelOf(false, true)).toBe("Link");
    expect(watchLinkLabelOf(true, false)).toBe("Link copied");
  });

  test("copies the link, and says so when the browser refuses", async () => {
    const copied: string[] = [];
    expect(await copyWatchLink(URL, async (text) => void copied.push(text))).toBe(true);
    expect(copied).toEqual([URL]);
    expect(await copyWatchLink(URL, () => Promise.reject(new Error("denied")))).toBe(false);
  });
});

describe("the Settings row", () => {
  test("is off by default, says who can watch, and toggles the setting", () => {
    const row = liveWatchRowInfoOf(defaultSettings());
    expect(row).toMatchObject({ id: "live-watch", title: "Always allow people to watch my games", on: false });
    expect(row.detail).toContain("Anyone with the link");
    const next = nextSettingsAfterToggle(defaultSettings(), "live-watch", 1);
    expect(next.liveWatch).toBe(true);
    expect(liveWatchRowInfoOf(next).on).toBe(true);
  });
});
