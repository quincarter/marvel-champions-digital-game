/**
 * The lazy-loaded screens: scene key to a dynamic import of its module. Every scene `main.ts` used to register up
 * front is here except the eager ones (`EAGER_SCENES` in `scene-order.ts`). Vite splits each import into its own
 * chunk, so a scene's module (and what only it imports) is not evaluated until the scene is first needed
 * (`scene-loader.ts`).
 *
 * A scene module must not be imported by value from anything in the entry chunk, or it would be bundled there and
 * these imports would split nothing (a type-only import is fine).
 */

import type Phaser from "phaser";
import { SCENES } from "./keys.js";

export type SceneClass = new () => Phaser.Scene;

export const SCENE_LOADERS: Readonly<Record<string, () => Promise<SceneClass>>> = {
  [SCENES.scenarioSelect]: () => import("./scenario-select.js").then((m) => m.ScenarioSelectScene),
  [SCENES.seats]: () => import("./seats.js").then((m) => m.SeatsScene),
  [SCENES.setup]: () => import("./table-setup.js").then((m) => m.TableSetupScene),
  [SCENES.setupDeal]: () => import("./setup-deal.js").then((m) => m.SetupDealScene),
  [SCENES.scenarioIntro]: () => import("./scenario-intro.js").then((m) => m.ScenarioIntroScene),
  [SCENES.board]: () => import("./board.js").then((m) => m.BoardScene),
  [SCENES.decks]: () => import("./decks.js").then((m) => m.DecksScene),
  [SCENES.deckBuilder]: () => import("./deck-builder.js").then((m) => m.DeckBuilderScene),
  [SCENES.deckCheck]: () => import("./deck-check.js").then((m) => m.DeckCheckScene),
  [SCENES.campaignSaga]: () => import("./campaign/saga.js").then((m) => m.CampaignSagaScene),
  [SCENES.campaignCover]: () => import("./campaign/cover.js").then((m) => m.CampaignCoverScene),
  [SCENES.campaignRoster]: () => import("./campaign/roster.js").then((m) => m.CampaignRosterScene),
  [SCENES.campaignOpener]: () => import("./campaign/opener.js").then((m) => m.CampaignOpenerScene),
  [SCENES.campaignBriefing]: () => import("./campaign/briefing.js").then((m) => m.CampaignBriefingScene),
  [SCENES.campaignMarket]: () => import("./campaign/market.js").then((m) => m.CampaignMarketScene),
  [SCENES.campaignAftermath]: () => import("./campaign/aftermath.js").then((m) => m.CampaignAftermathScene),
  [SCENES.campaignRewind]: () => import("./campaign/rewind.js").then((m) => m.CampaignRewindScene),
  [SCENES.campaignRun]: () => import("./campaign/run.js").then((m) => m.CampaignRunScene),
  [SCENES.campaignIssue]: () => import("./campaign/issue.js").then((m) => m.CampaignIssueScene),
  [SCENES.campaignDossier]: () => import("./campaign/dossier.js").then((m) => m.CampaignDossierScene),
  [SCENES.campaignFinale]: () => import("./campaign/finale.js").then((m) => m.CampaignFinaleScene),
  [SCENES.campaignDeckEdit]: () => import("./campaign/deck-edit.js").then((m) => m.CampaignDeckEditScene),
  [SCENES.campaignFrozenDeck]: () => import("./campaign/frozen-deck.js").then((m) => m.CampaignFrozenDeckScene),
  [SCENES.extras]: () => import("./extras.js").then((m) => m.ExtrasScene),
  [SCENES.credits]: () => import("./credits.js").then((m) => m.CreditsScene),
  [SCENES.trophyRoom]: () => import("./trophy-room.js").then((m) => m.TrophyRoomScene),
  [SCENES.extrasReader]: () => import("./extras-reader.js").then((m) => m.ExtrasReaderScene),
  [SCENES.guideChooser]: () => import("./guide-chooser.js").then((m) => m.GuideChooserScene),
  [SCENES.howToWin]: () => import("./how-to-win.js").then((m) => m.HowToWinScene),
  [SCENES.howToPlay]: () => import("./how-to-play.js").then((m) => m.HowToPlayScene),
  [SCENES.newInBox]: () => import("./new-in-box.js").then((m) => m.NewInBoxScene),
  [SCENES.civilWarBuilder]: () => import("./civil-war-builder.js").then((m) => m.CivilWarBuilderScene),
  [SCENES.aspectLesson]: () => import("./aspect-lesson.js").then((m) => m.AspectLessonScene),
  [SCENES.choice]: () => import("./choice.js").then((m) => m.ChoiceOverlay),
  [SCENES.setCards]: () => import("./set-cards.js").then((m) => m.SetCardsOverlay),
  [SCENES.inspect]: () => import("./inspect.js").then((m) => m.InspectOverlay),
  [SCENES.villainPhase]: () => import("./villain-phase.js").then((m) => m.VillainPhaseOverlay),
  [SCENES.gameOver]: () => import("./game-over.js").then((m) => m.GameOverScene),
  [SCENES.pause]: () => import("./pause.js").then((m) => m.PauseOverlay),
  [SCENES.rules]: () => import("./rules.js").then((m) => m.RulesOverlay),
  [SCENES.settings]: () => import("./settings.js").then((m) => m.SettingsOverlay),
  [SCENES.unlocks]: () => import("./unlocks.js").then((m) => m.UnlocksOverlay),
  [SCENES.unlockConfirm]: () => import("./unlock-confirm.js").then((m) => m.UnlockConfirmOverlay),
  [SCENES.nameConflict]: () => import("./name-conflict.js").then((m) => m.NameConflictOverlay),
  [SCENES.heroDecks]: () => import("./hero-decks-sheet.js").then((m) => m.HeroDecksSheet),
  [SCENES.saveData]: () => import("./save-data.js").then((m) => m.SaveDataOverlay),
  [SCENES.syncData]: () => import("./sync-data.js").then((m) => m.SyncDataOverlay),
  [SCENES.syncConflict]: () => import("./sync-conflict.js").then((m) => m.SyncConflictOverlay),
  [SCENES.syncPrompt]: () => import("./sync-prompt.js").then((m) => m.SyncPromptScene),
  [SCENES.endTurnConfirm]: () => import("./end-turn-confirm.js").then((m) => m.EndTurnConfirmOverlay),
  [SCENES.tutorialResumeConfirm]: () =>
    import("./tutorial-resume-confirm.js").then((m) => m.TutorialResumeConfirmOverlay),
  [SCENES.holdOn]: () => import("./hold-on.js").then((m) => m.HoldOnOverlay),
  [SCENES.roundDebrief]: () => import("./round-debrief.js").then((m) => m.RoundDebriefScene),
  [SCENES.campaignBeat]: () => import("./campaign/beat.js").then((m) => m.CampaignBeatOverlay),
  [SCENES.teamUpSplash]: () => import("./team-up-splash.js").then((m) => m.TeamUpSplashOverlay),
  [SCENES.teamUpInfo]: () => import("./team-up-info.js").then((m) => m.TeamUpInfoOverlay),
  [SCENES.evidence]: () => import("./evidence.js").then((m) => m.EvidenceOverlay),
  [SCENES.pileView]: () => import("./pile-view.js").then((m) => m.PileViewOverlay),
  [SCENES.extrasViewer]: () => import("./extras-viewer.js").then((m) => m.ExtrasViewerScene),
  // Dev-only demo scenes: a production build has no entry for them, so their modules are never emitted.
  ...(import.meta.env.DEV
    ? {
        [SCENES.termTextDemo]: () => import("./term-text-demo.js").then((m) => m.TermTextDemoScene),
        [SCENES.guideCalloutDemo]: () => import("./guide-callout-demo.js").then((m) => m.GuideCalloutDemoScene),
        [SCENES.holdOnDemo]: () => import("./hold-on-demo.js").then((m) => m.HoldOnDemoScene),
        [SCENES.guidePanelDemo]: () => import("./guide-panel-demo.js").then((m) => m.GuidePanelDemoScene),
        [SCENES.guideSpotlightDemo]: () => import("./guide-spotlight-demo.js").then((m) => m.GuideSpotlightDemoScene),
      }
    : {}),
};
