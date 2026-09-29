/**
 * Between-issue deck editing (MC10 p. 3; docs/campaign-mode-design.md §8): a seat's identity is locked for the
 * whole campaign, but the player may change aspects and the rest of the deck's contents. There is no dedicated
 * design tile for this step — it reuses the in-app deck builder (`../deck-builder.ts`) rather than a second card
 * grid, filter rail and pool list, handing it a campaign mode via `DeckBuilderCampaignData`.
 *
 * This scene's own job is thin, on purpose: load the run, discard a composed-but-unplayed attempt (a deck can't
 * change under a composed issue — the Briefing recomposes on return), assemble the `CampaignDeckContext`
 * (`campaignDeckContextOf`) and a starting `Deck` from the seat's stored `DeckContents`, then hand off to
 * `SCENES.deckBuilder`. It never judges the deck itself — `campaignDeckEditModel`/`validateDeck`, read inside the
 * builder, own every verdict.
 *
 * **Once the deck is frozen (MC16 p. 5), this hands off to `SCENES.campaignFrozenDeck` instead** — a read-only
 * summary (design tile 20) in place of the builder. The branch reads `frozenNonCampaignCardsOf`'s own result, not
 * `current.campaignId`: any future box whose `DECK_FREEZE_POLICY` marks it `"mandatory"` gets this same swap for
 * free, the way `isMarketPendingChoice` (`campaign-market-model.ts`) detects its own screen by shape.
 */
import Phaser from "phaser";
import { deckId, type Deck } from "@mc/content";
import { CAMPAIGNS } from "@mc/cards";
import { surface } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { typeRole } from "../../tokens.js";
import { drawTopBar } from "../../ui/campaign-chrome.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import { CAMPAIGN_RECORDS } from "../../campaign/campaign-service.js";
import { campaignService } from "../../session.js";
import {
  campaignDeckContextOf,
  deckFreezePolicyOf,
  frozenNonCampaignCardsOf,
} from "../../view/campaign-deck-edit-model.js";
import { POOL_CARDS } from "../../content/pool.js";
import { cardDisplayName } from "../../view/hero-names.js";
import { SCENES } from "../keys.js";
import type { DeckBuilderCampaignData } from "../deck-builder.js";
import type { CampaignDeckEditData } from "./routes.js";

export class CampaignDeckEditScene extends Phaser.Scene {
  #data: CampaignDeckEditData | null = null;

  constructor() {
    super(SCENES.campaignDeckEdit);
  }

  create(data: CampaignDeckEditData): void {
    this.#data = data;
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.#drawStatus("Loading…");
    fadeScreenIn(this);
    void this.#load(data);
  }

  #goBack(): void {
    const data = this.#data;
    if (data) goToScreen(this, data.returnTo.key, data.returnTo.data);
  }

  #drawStatus(message: string): void {
    destroyChildren(this);
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    drawTopBar(this, { backLabel: "◂ Back", onBack: () => this.#goBack(), title: "Edit deck" });
    this.add
      .text(0, 0, message, textStyle(typeRole.body, surface.ink.hex))
      .setPosition(24, 96)
      .setWordWrapWidth(this.scale.gameSize.width - 48);
  }

  async #load(data: CampaignDeckEditData): Promise<void> {
    const record = await campaignService().load(data.runId);
    if (!record) {
      this.#drawStatus("This campaign run could not be found.");
      return;
    }
    // A composed attempt freezes the log's own snapshot; editing a deck under it would go stale the moment the
    // Briefing recomposes, so the attempt is thrown away first (campaign-service.ts's `discardAttempt`) and the
    // Briefing composes the issue again on the way back.
    const discarded = record.attempt ? await campaignService().discardAttempt(record) : record;
    // A save from before the freeze opt-in moved off `localStorage` (`deck-freeze-choice.ts`) folds its seat's
    // legacy key into the record the first time it loads here — see `campaign-service.ts`'s doc comment.
    const current = await campaignService().migrateLegacyDeckFreezeOptIn(discarded);

    const seat = current.seats.find((candidate) => candidate.seatNumber === data.seatNumber);
    if (!seat) {
      this.#drawStatus(`This campaign has no seat ${data.seatNumber}.`);
      return;
    }
    const content = CAMPAIGN_RECORDS[current.campaignId as string];
    if (!content) {
      this.#drawStatus(`This build cannot edit a deck for "${current.campaignId as string}".`);
      return;
    }

    const definition = CAMPAIGNS[current.campaignId as string];
    const policy = deckFreezePolicyOf(current.campaignId as string);
    const optedIn = policy === "optional" && campaignService().isDeckFreezeOptedIn(current, data.seatNumber);
    const frozenNonCampaignCards = definition
      ? frozenNonCampaignCardsOf(definition, current, data.seatNumber, optedIn)
      : null;
    // Whether opting in *would* freeze right now (expert campaign, scenario 1 attempted) — shown as a standing
    // offer in the ordinary builder (MC27 p. 6's freeze is optional, so nothing chooses it for the player). Only
    // computed when the seat hasn't already opted in; `frozenNonCampaignCards` above already covers that case.
    const optionalFreezeEligible =
      policy === "optional" && !optedIn && definition
        ? frozenNonCampaignCardsOf(definition, current, data.seatNumber, true) !== null
        : false;
    const context = campaignDeckContextOf(
      content,
      current,
      data.seatNumber,
      frozenNonCampaignCards ? { frozenNonCampaignCards } : {},
    );
    const identity = POOL_CARDS.find((card) => (card.id as string) === (seat.identityCardId as string));
    const identityName = identity ? cardDisplayName(identity) : (seat.identityCardId as string);
    const title = `${current.name} — Seat ${data.seatNumber}: ${identityName}`;

    if (frozenNonCampaignCards) {
      this.scene.start(SCENES.campaignFrozenDeck, {
        runId: data.runId,
        seatNumber: data.seatNumber,
        returnTo: data.returnTo,
        title: identityName,
      });
      return;
    }

    const deck: Deck = {
      id: deckId(`campaign-${current.id}-seat-${data.seatNumber}`),
      name: `${current.name} — ${identityName}`,
      identityCardId: seat.deck.identityCardId,
      aspects: seat.deck.aspects,
      cards: seat.deck.cards,
      poolVersion: current.poolVersion,
      source: { kind: "userBuilt", createdAt: new Date(current.createdAt).toISOString() },
      updatedAt: new Date(current.updatedAt).toISOString(),
    };
    const campaign: DeckBuilderCampaignData = {
      runId: data.runId,
      seatNumber: data.seatNumber,
      returnTo: data.returnTo,
      context,
      title,
      grants: seat.grants,
      ...(optionalFreezeEligible ? { optionalFreeze: { eligible: true as const } } : {}),
    };
    this.scene.start(SCENES.deckBuilder, { deck, campaign });
  }
}
