/**
 * The builder's flows that leave the screen or touch storage: Back (which asks once about unsaved changes), Save, Delete
 * (asks first), a campaign reward and deck freeze, Review, and reading everyone's decks for From your games.
 */
import type { CardId, Deck } from "@mc/content";
import { campaignService, deckStorage } from "../../session.js";
import { noteDeckFeat } from "../../progression/deck-feats.js";
import { refreshUnlocks } from "../../progression/progression.js";
import { touch } from "../../view/deck-builder-model.js";
import {
  campaignDeckContextWithGrants,
  campaignDeckVerdictOf,
  setRewardIncluded,
} from "../../view/campaign-deck-edit-model.js";
import { loadGlobalVillainCards } from "../../global-stats/global-stats-client.js";
import { shareFinishedGamesNow } from "../../global-stats/share-now.js";
import { askAnswerAllowed } from "../../view/global-ask.js";
import { t } from "../../i18n/translate.js";
import { goToScreen } from "../../ui/transitions.js";
import type { DeckCheckSceneData } from "../deck-check.js";
import type { DeckBuilderCampaignData, DeckBuilderSceneData } from "../deck-builder.js";
import { SCENES } from "../keys.js";
import type { BuilderHost } from "./builder-host.js";
import { unsavedLeaveText } from "./model-identity.js";

/** Back to the screen that opened the builder, told which deck was just saved (it reopens on it). */
function leaveToReturn(host: BuilderHost, withSaved = true): void {
  const { state, scene } = host;
  const back = state.returnTo;
  if (!back) return;
  const focusDeckId = withSaved ? state.savedDeckId : null;
  goToScreen(scene, back.key, { ...back.data, ...(focusDeckId ? { focusDeckId } : {}) });
}

/** Unsaved changes: the first Back says so, the second leaves without saving. */
export function goBack(host: BuilderHost): void {
  const { state, scene } = host;
  if (state.isDirty() && !state.leaveArmed) {
    state.leaveArmed = true;
    state.status = unsavedLeaveText();
    host.compose();
    return;
  }
  if (state.campaign) goToScreen(scene, state.campaign.returnTo.key, state.campaign.returnTo.data);
  else if (state.returnTo) leaveToReturn(host);
  // After a Save, Decks opens on the deck just saved (its row selected and in view).
  else goToScreen(scene, SCENES.decks, state.savedDeckId ? { focusDeckId: state.savedDeckId } : undefined);
}

/** Opens Deck check on the deck as it stands, saved or not; its Back and Edit deck come back here with that deck. */
export function reviewDeck(host: BuilderHost): void {
  const { state, scene } = host;
  const deck = state.deck;
  if (!deck) return;
  const campaign = state.campaign;
  const model = state.campaignModel;
  const data: DeckBuilderSceneData = {
    deck,
    ...(host.isWide() ? {} : { tab: "deck" as const }),
    ...(campaign && state.savedDeck ? { campaign, savedDeck: state.savedDeck } : {}),
  };
  goToScreen(scene, SCENES.deckCheck, {
    deck,
    returnTo: { scene: SCENES.deckBuilder, data },
    // Deck check knows nothing of a campaign's grants and removals, so it is told how the campaign judges the deck.
    ...(model ? { verdict: campaignDeckVerdictOf(model) } : {}),
  } satisfies DeckCheckSceneData);
}

/** Delete, from the builder: the first press asks, the second removes the saved deck and returns to Decks. */
export async function deleteDeck(host: BuilderHost): Promise<void> {
  const { state, scene } = host;
  const saved = state.savedDeck;
  if (state.busy || !saved || state.campaign) return;
  if (!state.deleteArmed) {
    state.deleteArmed = true;
    state.leaveArmed = false;
    state.status = t("decks.stats.confirmMessage", { name: saved.name });
    host.compose();
    return;
  }
  state.busy = true;
  host.compose();
  await deckStorage().remove(saved.id);
  if (state.returnTo) leaveToReturn(host, false);
  else goToScreen(scene, SCENES.decks);
}

/**
 * Between-issue save (`scenes/campaign/deck-edit.ts`): reloads the run fresh rather than trusting whatever record
 * `deck-edit.ts` happened to load before handing off, so a save can never write over a run that changed under it.
 */
async function saveCampaignDeck(host: BuilderHost, campaign: DeckBuilderCampaignData, deck: Deck): Promise<void> {
  const { state, scene } = host;
  const record = await campaignService().load(campaign.runId);
  if (!record) {
    state.busy = false;
    state.status = t("deckBuilder.campaignGone");
    host.compose();
    return;
  }
  try {
    await campaignService().setSeatDeck(record, campaign.seatNumber, deck);
  } catch (error) {
    state.busy = false;
    state.status = error instanceof Error ? error.message : t("deckBuilder.saveFailed");
    host.compose();
    return;
  }
  state.busy = false;
  goToScreen(scene, campaign.returnTo.key, campaign.returnTo.data);
}

export async function saveDeck(host: BuilderHost): Promise<void> {
  const { state } = host;
  if (state.busy || !state.deck) return;
  if (state.campaignModel?.editingDisabled) return;
  state.busy = true;
  host.compose();
  if (state.campaign) {
    await saveCampaignDeck(host, state.campaign, state.deck);
    return;
  }
  const saved = touch(state.deck, new Date().toISOString());
  // A deck already in your decks saved again is a change to it; a new one is a deck built (achievements).
  const resaved = state.savedDeck !== null;
  await deckStorage().put(saved);
  if (noteDeckFeat(resaved ? "edited" : "built")) void refreshUnlocks().catch(() => false);
  state.deck = saved;
  state.savedDeck = saved;
  state.savedDeckId = saved.id as string;
  state.leaveArmed = false;
  state.deleteArmed = false;
  state.busy = false;
  state.status = t("deckBuilder.savedNote");
  host.compose();
}

/**
 * Flips a reward and keeps the editor in step. The run is written at once (the grant's `leftOut` and the stored line), so
 * leaving without "Save changes" still keeps the choice; the open deck, the grants and the context are rebuilt from the same
 * pure edit, so unsaved changes to other lines are not lost.
 */
export async function toggleReward(host: BuilderHost, cardId: CardId, included: boolean): Promise<void> {
  const { state } = host;
  const { campaign, deck } = state;
  if (state.busy || !campaign || !deck || state.campaignModel?.editingDisabled) return;
  state.busy = true;
  host.compose();
  const record = await campaignService().load(campaign.runId);
  if (!record) {
    state.busy = false;
    state.status = t("deckBuilder.campaignGone");
    host.compose();
    return;
  }
  try {
    await campaignService().setSeatRewardIncluded(record, campaign.seatNumber, cardId, included);
  } catch (error) {
    state.busy = false;
    state.status = error instanceof Error ? error.message : t("deckBuilder.rewardFailed");
    host.compose();
    return;
  }
  const edit = setRewardIncluded(deck, campaign.grants, cardId, included);
  state.campaign = {
    ...campaign,
    grants: edit.grants,
    context: campaignDeckContextWithGrants(campaign.context, edit.grants),
  };
  state.deck = { ...deck, cards: edit.deck.cards };
  state.busy = false;
  state.status = null;
  host.compose();
}

/**
 * MC27 p. 6's optional Expert Campaign freeze: opting in is a small read-modify-write on the run record, then the same
 * frozen-deck screen the mandatory freeze (MC16) uses.
 */
export async function freezeDeck(host: BuilderHost): Promise<void> {
  const { state, scene } = host;
  const campaign = state.campaign;
  if (!campaign) return;
  const record = await campaignService().load(campaign.runId);
  if (record) await campaignService().optIntoDeckFreeze(record, campaign.seatNumber);
  goToScreen(scene, SCENES.campaignFrozenDeck, {
    runId: campaign.runId,
    seatNumber: campaign.seatNumber,
    returnTo: campaign.returnTo,
    title: campaign.title,
  });
}

/** Reads everyone's decks against `villain` (on a press only) and redraws when they arrive. */
export async function loadAgainstGlobal(host: BuilderHost, villain: string): Promise<void> {
  const { state, scene } = host;
  const known = state.againstGlobal.get(villain);
  if (known?.kind === "reading" || known?.kind === "ready" || known?.kind === "none") return;
  state.againstGlobal.set(villain, { kind: "reading" });
  // The Worker counts a game against several villains for each; the first stands for the group here.
  const answer = await loadGlobalVillainCards(villain.split(" & ")[0]!);
  state.againstGlobal.set(villain, answer);
  if (scene.scene.isActive() && host.showsGames()) host.compose();
}

/** "Share my games": one press turns sharing on (the games finished so far are never sent). */
export function shareGames(host: BuilderHost, byFocus: boolean): void {
  const { state, scene } = host;
  if (state.shareBusy) return;
  // A tap meant for something else that lands as the button appears is not a press on it.
  if (state.shareShownAt === null || !askAnswerAllowed(state.shareShownAt, performance.now())) return;
  state.shareBusy = true;
  void shareFinishedGamesNow().then((saved) => {
    state.shareBusy = false;
    state.shareFailed = !saved;
    if (!scene.scene.isActive() || !host.showsGames()) return;
    host.compose();
    // A pad or keyboard press: the button is gone, so focus goes to the switch above it.
    if (saved && byFocus) host.focusKey("games:source:everyone");
  });
}
