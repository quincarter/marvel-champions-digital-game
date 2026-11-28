/**
 * What each focus stop on the Title does, by its key: every control on the page (`mc-title` reports a press as the key
 * of the control's stop). Navigation goes through the scene's `leave`, so the redraws a resize makes never run under the
 * fade; the top row's chrome buttons hand over to the chrome scenes' own toggles, which keep their pop-ups' bookkeeping.
 */
import type Phaser from "phaser";
import { artLanguageNow } from "../art/art-source.js";
import type { SaveMeta } from "../engine/game-storage.js";
import { hasDesktopWindow, quitToDesktop } from "../platform/desktop-window.js";
import { inputDevice } from "../platform/input-device.js";
import { isNativeShell, openExternal } from "../platform/platform.js";
import { openReleaseReport } from "../ui/release-notice-bar.js";
import { enterBuilder, setBuilderOrigin } from "../view/civil-war-entry.js";
import { DISCORD_INVITE_URL } from "../view/issue-report.js";
import { releaseNotesPageUrl } from "../view/release-report-link.js";
import { CLIENT_VERSION } from "../version.js";
import type { CivilWarBuilderData } from "./civil-war-builder.js";
import { CHROME_LANGUAGE_STOP, CHROME_MUSIC_STOP, CHROME_REPORT_STOP, CHROME_THEME_STOP } from "./focus-route.js";
import { SCENES } from "./keys.js";
import type { LanguageButtonScene } from "./language-button.js";
import type { MusicButtonScene } from "./music-button.js";
import type { OnlineData } from "./online.js";
import type { PlayerStatsData } from "./player-stats.js";
import { openReportIssue } from "./report-button.js";
import type { ScenarioSelectData } from "./scenario-select.js";
import type { ThemeButtonScene } from "./theme-button.js";
import type { TitleBanner } from "./title-banner.js";
import type { TitleFeeds } from "./title-feeds.js";
import { newGameDraft } from "./title-draft.js";
import { guidePrefs, setGuideRunLevelOverride } from "../guide/guide-store.js";
import { isFirstLaunch } from "../guide/guide-prefs.js";
import { appSession } from "../session.js";

/** What the actions need of the scene. */
export interface TitleActionHost {
  readonly scene: Phaser.Scene;
  readonly feeds: TitleFeeds;
  readonly banner: TitleBanner | null;
  /** Goes to another screen. */
  readonly leave: (scene: string, data?: object) => void;
  readonly resume: (save: SaveMeta) => void;
  readonly watch: (save: SaveMeta) => void;
  readonly openGamesList: () => void;
  /** The scene redraws and wires the page again (a question asked, a banner closed). */
  readonly rebuild: () => void;
  readonly starting: () => boolean;
}

/** "New game": a plain one is never a guided run, and the first ever asks "New to the fight?" first. */
function newGame(host: TitleActionHost): void {
  if (host.starting()) return;
  // Clears a still-set flag from an earlier tutorial the player left running rather than stopping outright
  // (`session.ts`'s own `guidedRun` doc comment).
  appSession().guidedRun = false;
  appSession().guidedRunKind = undefined;
  setGuideRunLevelOverride(null);
  // The first New game ever (no guide choice made yet) asks "New to the fight?" first (guided mode, owner 2026-09-29:
  // the game opens on Title, and the chooser comes after you start a new game). Its "Hints only" / "No guide" continue
  // straight into scenario select; "Learn as you play" goes to How to win and the tutorial.
  if (isFirstLaunch(guidePrefs())) {
    host.leave(SCENES.guideChooser);
    return;
  }
  host.leave(SCENES.scenarioSelect, { draft: newGameDraft() } satisfies ScenarioSelectData);
}

export function titleActionsOf(
  host: TitleActionHost,
  gameIds: readonly string[],
  civilWarScenario: string | null,
): Map<string, () => void> {
  const { feeds, leave } = host;
  const actions = new Map<string, () => void>();
  const goTo = (scene: string, data?: object) => (): void => leave(scene, data);
  const openOnline = (intent?: OnlineData["intent"]): void =>
    leave(SCENES.online, intent ? ({ intent } satisfies OnlineData) : undefined);
  const save = feeds.continuable;
  if (save) actions.set("continue", () => host.resume(save));
  actions.set("games-row", host.openGamesList);
  actions.set("new-game", () => newGame(host));
  actions.set("decks", goTo(SCENES.decks));
  actions.set("campaign", goTo(SCENES.campaignSaga));
  // "Play online" (#880): an entry point only. Nothing online starts, and nothing is loaded, until its own screen is used.
  actions.set("play-online", () => openOnline());
  actions.set("play-online-host", () => openOnline("host"));
  actions.set("play-online-join", () => openOnline("join"));
  // "Civil War!": the box's own entry, once it is open. The last build, or the first leader as printed.
  if (civilWarScenario !== null) {
    actions.set("civil-war", () => {
      const entry = enterBuilder("build", newGameDraft(true), civilWarScenario);
      setBuilderOrigin("title");
      leave(SCENES.civilWarBuilder, { draft: entry.draft, step: entry.step } satisfies CivilWarBuilderData);
    });
  }
  actions.set("extras", goTo(SCENES.extras));
  actions.set("past-games", goTo(SCENES.pastGames));
  actions.set("trophies", goTo(SCENES.trophyRoom));
  actions.set("rank-badge", goTo(SCENES.trophyRoom));
  actions.set("stats", goTo(SCENES.playerStats, { from: SCENES.title } satisfies PlayerStatsData));
  // "How to play" (guided mode G6c, `docs/guided-mode.md` §4): the learning hub. Not a guided run by itself: starting a
  // lesson from inside the hub is what sets `appSession().guidedRun` (`guide/start-tutorial.ts`).
  actions.set("how-to-play", goTo(SCENES.howToPlay));
  // The Mod Store, a main-menu item of its own (issue #734) and an icon in the top row of a wide screen.
  actions.set("mod-store", goTo(SCENES.modStore));
  actions.set("chrome:mod-store", goTo(SCENES.modStore));
  // W4's Settings is an overlay: launched over this scene, it stops itself on Back (`scenes/settings.ts`).
  actions.set("settings", () => host.scene.scene.launch(SCENES.settings));
  // The desktop app has no browser tab to close, so it offers its own way out (the owner, 2026-10-16).
  if (hasDesktopWindow()) actions.set("quit", () => void quitToDesktop());
  const openDiscord = (): void => openExternal(DISCORD_INVITE_URL);
  actions.set("discord", openDiscord);
  actions.set("chrome:discord", openDiscord);
  actions.set("release-notes", () =>
    openExternal(
      releaseNotesPageUrl(CLIENT_VERSION, globalThis.location?.href ?? "", isNativeShell(), artLanguageNow()),
    ),
  );
  actions.set("release-notice", () => openReleaseReport(feeds.noticeVersion));
  const chrome = <T>(key: string): T | null => host.scene.scene.manager.getScene(key) as T | null;
  actions.set(CHROME_THEME_STOP, () => chrome<ThemeButtonScene>(SCENES.themeButton)?.toggle());
  // From the keyboard or a pad the list opens with focus on it; a mouse or a touch opens it as a tap always did.
  actions.set(CHROME_LANGUAGE_STOP, () =>
    chrome<LanguageButtonScene>(SCENES.languageButton)?.toggle(!inputDevice().mouseMoving),
  );
  actions.set(CHROME_MUSIC_STOP, () => chrome<MusicButtonScene>(SCENES.musicButton)?.togglePlayer());
  actions.set(CHROME_REPORT_STOP, () => openReportIssue(host.scene));
  // The In-progress games panel.
  for (const id of gameIds) {
    const row = feeds.games.find((game) => game.id === id);
    if (!row) continue;
    actions.set(`game:${id}`, () => host.resume(row));
    actions.set(`game-watch:${id}`, () => host.watch(row));
    actions.set(`game-remove:${id}`, () => {
      feeds.removing = id;
      host.rebuild();
    });
  }
  actions.set("remove-keep", () => {
    feeds.removing = null;
    feeds.removeError = null;
    host.rebuild();
  });
  actions.set("remove-confirm", () => {
    if (feeds.removing !== null) void feeds.removeGame(feeds.removing);
  });
  for (const [key, activate] of host.banner?.actions ?? []) actions.set(key, activate);
  return actions;
}
