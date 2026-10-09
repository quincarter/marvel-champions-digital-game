/**
 * C08 — Briefing: composes the next issue's between-games setup (answering any question it asks), shows what
 * happened automatically and what the player still has to decide, shows the two decks, and starts the game.
 *
 * Composing (`campaignService().compose`) asks one choice at a time and re-runs from the top on every answer
 * (`campaign-service.ts`'s own doc comment) — this scene accumulates `#answers` across re-entries and keeps
 * re-calling `compose` until it comes back `"done"`, exactly the loop the service's doc comment describes. Nothing
 * half-answered is ever shown as settled: `#pending` is only ever the *current* unanswered question.
 */
import Phaser from "phaser";
import type { CampaignChoiceAnswer, CampaignDefinition, CampaignPendingChoice, PlayerSetup } from "@mc/engine";
import { CAMPAIGN_ACCEPT } from "@mc/engine";
import {
  issueNumberOf,
  issueStoryFor,
  lineForRoster,
  setupCallCopyFor,
  storyFor,
  type IssueStory,
} from "../../campaign/story.js";
import {
  bangers,
  drawActionBar,
  drawPicture,
  drawTopBar,
  heroPicture,
  ruleHeading,
  speechBubble,
  villainPicture,
} from "../../ui/campaign-chrome.js";
import { accent, ink, signal, surface, typeRole } from "../../tokens.js";
import { cssOf, textStyle } from "../../ui/theme.js";
import { McButton, STAMP_CHIP_TYPE, fitText, label } from "../../ui/widgets.js";
import { McVariableList } from "../../ui/variable-list.js";
import { VariableListScroll } from "../../view/variable-list-scroll.js";
import { McScrollRegion } from "../../ui/scroll-region.js";
import { revealDelta } from "../../view/scroll-reveal.js";
import type { VirtualListRow } from "../../ui/virtual-list.js";
import {
  BUTTON_HEIGHT,
  META_HEIGHT,
  NAME_HEIGHT,
  REC_ART_WIDTH,
  ROLE_BUILD_START,
  backFromRoleBuild,
  confirmedRoleBuildCard,
  isRoleBuildChoice,
  recRowHeight,
  roleBuildConfirmOf,
  roleBuildOf,
  roleBuildRowsOf,
  selectRoleBuildCard,
  seatRoleOf,
  setRoleBuildFilter,
  type RoleBuildCard,
  type RoleBuildCardView,
  type RoleBuildContext,
  type RoleBuildState,
  type RoleBuildView,
} from "../../view/campaign-role-build-model.js";
import { pointInRect } from "../../view/drag-gesture.js";
import { aspectStampOf, type AspectStamp } from "../../view/aspect-stamp.js";
import { drawAspectChips } from "../../ui/aspect-chips.js";
import { destroyChildren } from "../../ui/destroy-children.js";
import { setMask } from "../../ui/rex.js";
import { fadeScreenIn, goToScreen } from "../../ui/transitions.js";
import type { Rect } from "../../view/layout.js";
import { formFactorFor } from "../../view/layout.js";
import { CAMPAIGN_ART, campaignCoverFor } from "../../art/campaign-art.js";
import { callGridOf } from "../../view/campaign-call-layout.js";
import { briefingSpeakerOf } from "../../view/campaign-briefing-speaker.js";
import {
  answersOfAttempt,
  briefingViewOf,
  DECK_NOTE_EXEMPT,
  deckProblemsOf,
  type BriefingView,
  type HandledRow,
} from "../../view/campaign-briefing-model.js";
import type { BriefingPoolGroup, BriefingPoolRow, BriefingPoolView } from "../../view/campaign-pool-model.js";
import { isMarketPendingChoice } from "../../view/campaign-market-model.js";
import { hiddenEvidenceEnvelope } from "../../view/campaign-hidden-evidence-model.js";
import {
  easierStartBriefingOf,
  easierStartIsOn,
  type EasierStartBriefing,
} from "../../view/campaign-easier-start-model.js";
import { CARDS_BY_ID, POOL_CARDS, POOL_ENCOUNTER_SETS, POOL_SCENARIOS, packNameOf } from "../../content/pool.js";
import { cardCountForSet, descriptorForSet } from "../../view/modular-sets.js";
import {
  isModularSetCall,
  modularPicksRowOf,
  modularSetIdsWithout,
  modularCallSourceOf,
  modularSetCallOf,
  waitingNoteOf,
  type ModularSetCallView,
  type WaitingPanel,
} from "../../view/campaign-modular-call-model.js";
import { drawModularCall } from "./briefing-modular-call.js";
import { drawEasierStart } from "./briefing-easier-start.js";
import { drawMissionBriefing } from "./briefing-mission.js";
import { drawSideSchemeCall, drawSideSchemeSettled, type SideSchemeDrawContext } from "./briefing-side-scheme.js";
import {
  sideSchemeBriefingOf,
  type SchemeCardRef,
  type SideSchemeBriefing,
} from "../../view/campaign-side-scheme-model.js";
import { sideSchemeOptionLabels } from "../../view/campaign-option-labels.js";
import { artFor } from "../../art/art-source.js";
import { hit } from "../../tokens.js";
import { cardArt, drawArt } from "../../art/card-art.js";
import { CAMPAIGNS as CONTENT_CAMPAIGNS, type AnyCard, type CardId, type Campaign, type CoreAspect } from "@mc/content";
import { appSession, campaignService } from "../../session.js";
import type { CampaignRecord } from "../../engine/campaign-storage.js";
import { optionLabelsOf } from "../../view/campaign-option-labels.js";
import { heroFaceDisplayName } from "../../view/hero-names.js";
import {
  ROLE_CALL_START,
  ROLE_EXPLAINER,
  backFromRole,
  confirmedRole,
  isRoleChoice,
  roleCallOf,
  roleConfirmOf,
  seatHeaderOf,
  selectRole,
  type RoleCallState,
  type RoleCallView,
  type RoleTileView,
  type SeatHeaderView,
} from "../../view/campaign-role-call-model.js";
import { FocusRoute, type FocusStop } from "../focus-route.js";
import { SCENES } from "../keys.js";
import type { CampaignBriefingData } from "./routes.js";

const cardName = (id: string): string => CARDS_BY_ID.get(id)?.name ?? id;
/** A seat's hero as the table names it ("Colossus"; "Spider-Man (Peter Parker)" where a name is shared). */
const heroNameOf = (id: CardId): string => {
  const card = CARDS_BY_ID.get(id);
  return card?.type === "hero_identity" ? heroFaceDisplayName(card) : cardName(id);
};
/** See `scenes/campaign/dossier.ts`'s own copy of this helper — a pool field names a card by name, never an id. */
const CARD_BY_NAME = new Map<string, AnyCard>([...CARDS_BY_ID.values()].map((card) => [card.name, card] as const));
const cardOfName = (name: string): AnyCard | undefined => CARD_BY_NAME.get(name);
const cardTypeOf = (name: string): { readonly type: string } | undefined => {
  const card = cardOfName(name);
  return card ? { type: card.type } : undefined;
};

const ENCOUNTER_SET_NAMES = new Map(POOL_ENCOUNTER_SETS.map((set) => [set.id as string, set.name] as const));
const KNOWN_ENCOUNTER_SET_IDS: ReadonlySet<string> = new Set(ENCOUNTER_SET_NAMES.keys());

export class CampaignBriefingScene extends Phaser.Scene {
  #data!: CampaignBriefingData;
  #record: CampaignRecord | null = null;
  #story: IssueStory | null = null;
  #definition: CampaignDefinition | null = null;
  #nodeIds: readonly string[] = [];
  #issueNumber = 1;
  #pending: CampaignPendingChoice | null = null;
  #answers: CampaignChoiceAnswer[] = [];
  /** Accumulates a multi-pick choice's own selections before "Confirm" submits them. */
  #picking: string[] = [];
  /** The page of a long "Your call" list (role-building lists dozens of cards). */
  #callPage = 0;
  /** The role choice's confirm step: a tile is only selected here; Confirm is what records it. */
  #roleState: RoleCallState = ROLE_CALL_START;
  /** Role-building's filter chip and confirm step; the list's scroll persists across redraws and Inspect. */
  #roleBuild: RoleBuildState = ROLE_BUILD_START;
  #roleBuildScroll = new VariableListScroll();
  #roleBuildList: McVariableList | null = null;
  /**
   * On a phone the whole briefing (speaker, handled rows, the call, the decks) scrolls under the pinned action bar,
   * except while role-building's own list is up, which scrolls itself. The offset persists across redraws and resets
   * when the pending call changes.
   */
  #briefingRegion: McScrollRegion | null = null;
  #briefingScroll = new VariableListScroll();
  #briefingScrollFor: CampaignPendingChoice | null = null;
  /** The role-building view drawn last, which a card chosen in Inspect is looked up in. */
  #roleBuildView: RoleBuildView | null = null;
  #composing = false;
  #starting = false;
  #startError: string | null = null;
  /** The "which deck?" chooser EDIT DECKS opens when several seats could be meant and none is the problem. */
  #seatPicker = false;
  /** The seats whose deck setup would refuse, computed once per composed attempt (`#deckProblems`). */
  #deckProblemsFor: { readonly key: unknown; readonly problems: ReadonlyMap<number, string> } | null = null;
  #buttons: McButton[] = [];
  #route: FocusRoute | null = null;

  constructor() {
    super(SCENES.campaignBriefing);
  }

  init(data: CampaignBriefingData): void {
    this.#data = data;
    this.#record = null;
    this.#story = null;
    this.#definition = null;
    this.#nodeIds = [];
    this.#pending = null;
    this.#answers = data.answers ? [...data.answers] : [];
    this.#picking = [];
    this.#composing = false;
    this.#starting = false;
    this.#startError = null;
    this.#seatPicker = false;
    this.#deckProblemsFor = null;
  }

  create(): void {
    this.cameras.main.setBackgroundColor(cssOf(surface.paper.hex));
    this.scale.on("resize", this.#draw, this);
    const artOff = cardArt(this).onArrived(() => this.#draw());
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off("resize", this.#draw, this);
      artOff();
    });
    this.game.events.on("mc-choice-toggle", this.#onInspectTake, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.game.events.off("mc-choice-toggle", this.#onInspectTake, this);
      this.#roleBuildList?.destroy();
      this.#roleBuildList = null;
    });
    void this.#load();
    fadeScreenIn(this);
  }

  async #load(): Promise<void> {
    const service = campaignService();
    const loaded = await service.load(this.#data.runId);
    // An issue composed before removed cards left decks on their own is composed again, without them.
    const record = loaded ? await service.discardStaleAttempt(loaded) : null;
    if (!this.sys.isActive()) return;
    if (!record) {
      goToScreen(this, SCENES.campaignSaga);
      return;
    }
    const nodeId = record.attempt?.nodeId ?? record.position.nextNodeId;
    if (!nodeId) {
      goToScreen(this, SCENES.campaignDossier, { runId: record.id });
      return;
    }
    this.#record = record;
    this.#story = issueStoryFor(record.campaignId, nodeId);
    const definition = service.definitionFor(record);
    this.#definition = definition;
    this.#nodeIds = definition.graph.nodes.map((node) => node.id);
    this.#issueNumber = issueNumberOf(
      definition.graph.nodes.map((node) => node.id),
      nodeId,
    );
    this.#draw();
    void this.#compose();
  }

  async #compose(): Promise<void> {
    const record = this.#record;
    if (!record || record.attempt || this.#composing) {
      this.#draw();
      return;
    }
    this.#composing = true;
    this.#draw();
    const result = await campaignService().compose(record, this.#answers);
    if (!this.sys.isActive()) return;
    this.#composing = false;
    if (result.kind === "pending") {
      // A Market-shaped choice (`view/campaign-market-model.ts`) gets its own screen, never this generic panel —
      // detected by shape (every option prices in the campaign's currency field), never by `campaignId`.
      if (isMarketPendingChoice(result.choice, (id) => CARDS_BY_ID.get(id))) {
        this.scale.off("resize", this.#draw, this);
        goToScreen(this, SCENES.campaignMarket, {
          runId: record.id,
          answers: this.#answers,
          ...(this.#data.replaySeed === undefined ? {} : { replaySeed: this.#data.replaySeed }),
        });
        return;
      }
      this.#pending = result.choice;
      this.#picking = [];
      this.#callPage = 0;
      this.#roleState = ROLE_CALL_START;
      this.#resetRoleBuild();
    } else {
      this.#record = result.record;
      this.#pending = null;
      this.#answers = [];
    }
    this.#draw();
  }

  /** Submits one answer for the current pending choice and re-composes — the service's own re-entry loop. */
  #answer(picked: readonly string[]): void {
    const pending = this.#pending;
    if (!pending) return;
    this.#answers = [
      ...this.#answers,
      { instructionId: pending.instructionId, slot: pending.slot, seatNumber: pending.seatNumber, picked },
    ];
    this.#pending = null;
    this.#roleState = ROLE_CALL_START;
    this.#resetRoleBuild();
    void this.#compose();
  }

  #resetRoleBuild(): void {
    this.#roleBuild = ROLE_BUILD_START;
    this.#roleBuildScroll = new VariableListScroll();
    this.#roleBuildView = null;
  }

  /** A card chosen in the Inspect sheet ("Take this card") opens its confirm step; nothing records yet. */
  #onInspectTake(optionId: string): void {
    const view = this.#roleBuildView;
    if (!view || !this.sys.isActive()) return;
    this.#roleBuild = selectRoleBuildCard(this.#roleBuild, view, optionId);
    this.#draw();
  }

  /** The box's roles when `pending` is a pick of one of them (MC32); null for every other choice. */
  #rolesFor(pending: CampaignPendingChoice): NonNullable<Campaign["roles"]> | null {
    const campaignId = this.#record?.campaignId as string | undefined;
    const roles = CONTENT_CAMPAIGNS.find((campaign) => (campaign.id as string) === campaignId)?.roles;
    return roles && isRoleChoice(pending, roles) ? roles : null;
  }

  /**
   * The seats whose deck `createGame` would refuse for the composed issue, by the engine's own check
   * (`illegalDecksOf`), so the Briefing shows before the press what pressing Open issue would say. Empty before an
   * issue is composed. Memoized on the attempt: it validates every seat against the whole pool.
   */
  #deckProblems(record: CampaignRecord): ReadonlyMap<number, string> {
    const attempt = record.attempt;
    if (!attempt) return new Map();
    if (this.#deckProblemsFor?.key === attempt) return this.#deckProblemsFor.problems;
    let problems: ReadonlyMap<number, string> = new Map();
    try {
      const { players, campaign } = campaignService().launchConfig(record);
      // A campaign issue always names its decks; a precon-by-id seat cannot occur here.
      const decked = players.filter((player): player is PlayerSetup => "deck" in player);
      problems = deckProblemsOf(record, { players: decked, ...(campaign ? { campaign } : {}), cards: POOL_CARDS });
    } catch {
      // A composed issue this build cannot even configure is the setup screen's to report, as it always was.
    }
    this.#deckProblemsFor = { key: attempt, problems };
    return problems;
  }

  /**
   * Opens one seat's deck. The composed attempt is thrown away on the way (a deck edit makes it stale), but the calls
   * it already answered, and any answered so far, ride back with the Briefing so the issue composes again without
   * re-asking them (a role, a role-building pick), and its random draws replay from the restored RNG.
   */
  async #editDecks(seatNumber?: number): Promise<void> {
    const record = this.#record;
    if (!record) return;
    const seats = record.seats.map((seat) => seat.seatNumber);
    const problemSeat = [...this.#deckProblems(record).keys()][0];
    const target = seatNumber ?? problemSeat ?? (seats.length > 1 ? null : (seats[0] ?? 1));
    if (target === null) {
      this.#seatPicker = true;
      this.#draw();
      return;
    }
    const kept = [...this.#answers, ...(record.attempt ? answersOfAttempt(record.attempt) : [])];
    if (record.attempt) await campaignService().discardAttempt(record);
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.campaignDeckEdit, {
      runId: this.#data.runId,
      seatNumber: target,
      returnTo: {
        key: SCENES.campaignBriefing,
        data: { runId: this.#data.runId, ...(kept.length > 0 ? { answers: kept } : {}) },
      },
    });
  }

  async #openIssue(): Promise<void> {
    const record = this.#record;
    if (!record?.attempt || this.#starting) return;
    this.#starting = true;
    this.#startError = null;
    this.#draw();
    const composed = campaignService().launchConfig(record);
    const replaySeed = this.#data.replaySeed;
    const config = replaySeed === undefined ? composed : { ...composed, seed: replaySeed };
    const { store } = appSession();
    await store.start(config);
    if (!this.sys.isActive()) return;
    if (store.state.status === "failed") {
      this.#starting = false;
      this.#startError = store.state.setupError?.illegalDecks[0]
        ? "A deck is no longer legal — edit decks before opening this issue."
        : (store.state.error ?? "setup failed");
      this.#draw();
      return;
    }
    this.scale.off("resize", this.#draw, this);
    goToScreen(this, SCENES.setupDeal);
  }

  #draw(): void {
    const record = this.#record;
    for (const button of this.#buttons) button.destroy();
    this.#buttons = [];
    this.#roleBuildList?.destroy();
    this.#roleBuildList = null;
    this.#briefingRegion?.destroy();
    this.#briefingRegion = null;
    destroyChildren(this);
    if (!record) return;

    const { width, height } = this.scale.gameSize;
    const phone = formFactorFor(width, height) === "phone";
    this.add.rectangle(0, 0, width, height, surface.paper.hex).setOrigin(0, 0);

    const back = (): void => {
      this.scale.off("resize", this.#draw, this);
      goToScreen(this, SCENES.campaignRun, { runId: this.#data.runId });
    };
    // The hidden-evidence envelope (docs/campaign-mode-design.md §Q4; MC50 p. 5), when the box declares one: the
    // top bar's own right-aligned classification marker, matching the dossier's tab bar convention. Computed
    // straight off `record`/`this.#definition` — independent of `briefingViewOf` (which needs a composed attempt
    // that may not exist yet) — so the counter is visible before an issue is even composed.
    const hiddenEvidence = this.#definition ? hiddenEvidenceEnvelope(record, this.#definition, cardName) : null;
    const top = drawTopBar(this, {
      backLabel: "◂ ISSUES",
      onBack: back,
      title: `Briefing · Issue #${this.#issueNumber}${record.modes.campaign?.expertCampaign ? " · Expert" : ""}`,
      ...(hiddenEvidence
        ? {
            right: hiddenEvidence.revealedCards
              ? `${hiddenEvidence.label} · ${hiddenEvidence.revealedCards.join(", ")}`
              : `${hiddenEvidence.label} · sealed · ${hiddenEvidence.cardCount} card${hiddenEvidence.cardCount === 1 ? "" : "s"}`,
          }
        : {}),
    });
    const stops = new Map<string, FocusStop>();
    if (top.back && top.backRect) stops.set("back", { rect: top.backRect, activate: back });

    const actionBar = drawActionBar(this);
    const contentBottom = actionBar.y - 16;

    const campaignStory = storyFor(record.campaignId as string);
    const firstPlayerSeat = record.seats.find((seat) => seat.seatNumber === 1) ?? record.seats[0];
    const firstPlayerName = firstPlayerSeat ? cardName(firstPlayerSeat.identityCardId as string) : undefined;
    const baseView = record.attempt
      ? briefingViewOf(
          record,
          cardName,
          this.#issueNumber,
          this.#definition ?? undefined,
          this.#nodeIds,
          cardTypeOf,
          campaignStory?.poolCopy,
          firstPlayerName,
          this.#story?.briefingNotes,
          this.#deckProblems(record),
        )
      : null;
    const boxRoles = CONTENT_CAMPAIGNS.find(
      (campaign) => (campaign.id as string) === (record.campaignId as string),
    )?.roles;
    const picksRow = record.attempt
      ? modularPicksRowOf(record.attempt.steps, modularSetIdsWithout(KNOWN_ENCOUNTER_SET_IDS, boxRoles), (id) => ({
          name: ENCOUNTER_SET_NAMES.get(id) ?? id,
          detail: [`${cardCountForSet(id, CARDS_BY_ID)} cards`, descriptorForSet(id, CARDS_BY_ID)?.toLowerCase()]
            .filter(Boolean)
            .join(" · "),
        }))
      : null;
    const view = picksRow && baseView ? { ...baseView, handled: [picksRow, ...baseView.handled] } : baseView;
    const gutter = phone ? 16 : 24;
    const columnGap = 32;
    const leftWidth = phone ? width - gutter * 2 : Math.round((width - gutter * 2 - columnGap) * 0.58);
    const leftRect: Rect = {
      x: gutter,
      y: top.height + 20,
      width: leftWidth,
      height: contentBottom - (top.height + 20),
    };

    // A pool issue (design tiles 24/26): the left column is the speaker plus "From the pool", "Handled for you"
    // moves to the right column, and the Decks panel drops entirely (the bottom bar's own DECKS button still opens
    // it) — there's no room, and no printed sheet, for a pool box's own list beside a Decks table too. A box with
    // no pool (MC10/MC16) keeps the original layout: left column speaker + Handled for you, right column Decks.
    const hasPool = !!view?.pool;
    // On a phone a per-seat call (the hero's own header, the role tiles, role-building's long list) takes the
    // column's top: the story bubble and "Handled for you" return once the call is answered.
    const seatCall =
      !!this.#pending &&
      this.#pending.seatNumber !== null &&
      (phone || this.#roleBuildFor(this.#pending, record) !== null);
    const roleBuildActive = !!this.#pending && this.#roleBuildFor(this.#pending, record) !== null;
    const scrolled = phone && !roleBuildActive;
    if (this.#pending !== this.#briefingScrollFor) {
      this.#briefingScroll = new VariableListScroll();
      this.#briefingScrollFor = this.#pending;
    }
    // A placeholder until the content is drawn and measured, so a persisted offset survives the region's first layout.
    const scrollHeights: number[] = [1_000_000];
    const region = scrolled
      ? new McScrollRegion(this, {
          rect: { x: 0, y: top.height, width, height: actionBar.y - top.height },
          heights: scrollHeights,
          scroll: this.#briefingScroll,
          clipInteractive: true,
        })
      : null;
    this.#briefingRegion = region;
    const contentStart = this.children.list.length;
    const stopsBefore = new Set(stops.keys());
    let leftBottom = seatCall ? leftRect.y - 20 : this.#drawSpeaker(leftRect, record, phone);
    if (seatCall) {
      // nothing above the call
    } else if (hasPool) {
      leftBottom = this.#drawPool(
        { x: leftRect.x, y: leftBottom + 20, width: leftRect.width, height: 0 },
        view!.pool!,
        phone,
      );
    } else {
      leftBottom = this.#drawHandled(
        { x: leftRect.x, y: leftBottom + 20, width: leftRect.width, height: contentBottom - leftBottom - 20 },
        view,
        stops,
      );
    }
    const scheme =
      !seatCall && view?.sideScheme && (view.sideScheme.chosen || view.sideScheme.requiredSetIds.length > 0)
        ? view.sideScheme
        : null;
    // On a wide screen the section sits under Decks (the left column is the speaker and the handled rows, with no
    // room to spare); on a phone it follows the handled rows in the one scrolling column.
    const schemeBeside = !phone && !hasPool;
    if (scheme && !schemeBeside) {
      const schemeRect: Rect = {
        x: leftRect.x,
        y: leftBottom + 20,
        width: leftRect.width,
        height: Math.max(0, contentBottom - leftBottom - 20),
      };
      leftBottom = drawSideSchemeSettled(
        this.#schemeContext(schemeRect, phone, stops),
        schemeRect.y,
        scheme,
        (id) => ENCOUNTER_SET_NAMES.get(id) ?? id,
      );
    }
    const easierStart = !seatCall && record.attempt ? this.#easierStartFor(record) : null;
    const missionBrief = !seatCall ? (view?.missions ?? null) : null;
    if (missionBrief && !schemeBeside) {
      const missionRect: Rect = {
        x: leftRect.x,
        y: leftBottom + 20,
        width: leftRect.width,
        height: Math.max(0, contentBottom - leftBottom - 20),
      };
      leftBottom = drawMissionBriefing(this.#schemeContext(missionRect, phone, stops), missionRect.y, missionBrief);
    }
    // Apocalypse's easier start (issue #3, standard mode): beside the decks on a wide screen, else under the section above.
    if (easierStart && !schemeBeside) {
      leftBottom = drawEasierStart(
        this.#schemeContext({ ...leftRect, y: leftBottom + 20 }, phone, stops),
        leftBottom + 20,
        easierStart,
        () => void this.#toggleEasierStart(),
      );
    }
    if (this.#pending) {
      this.#drawYourCall(
        {
          x: leftRect.x,
          y: leftBottom + 20,
          width: leftRect.width,
          height: Math.max(0, contentBottom - leftBottom - 20),
        },
        this.#pending,
        stops,
        phone,
      );
    } else if (this.#composing) {
      label(this, leftRect.x, leftBottom + 20, "Composing this issue…", typeRole.label, surface.ink.hex, ink.secondary);
    }

    if (!phone) {
      const rightRect: Rect = {
        x: leftRect.x + leftRect.width + columnGap,
        y: top.height + 20,
        width: width - gutter - (leftRect.x + leftRect.width + columnGap),
        height: contentBottom - (top.height + 20),
      };
      if (hasPool) this.#drawHandled(rightRect, view, stops);
      else {
        const decksBottom = this.#drawDecks(rightRect, view, stops);
        let rightBottom = decksBottom;
        if (missionBrief) {
          rightBottom = drawMissionBriefing(
            this.#schemeContext(rightRect, phone, stops),
            decksBottom + 24,
            missionBrief,
          );
        } else if (scheme) {
          rightBottom = drawSideSchemeSettled(
            this.#schemeContext(rightRect, phone, stops),
            decksBottom + 24,
            scheme,
            (id) => ENCOUNTER_SET_NAMES.get(id) ?? id,
          );
        }
        if (easierStart) {
          drawEasierStart(
            this.#schemeContext(rightRect, phone, stops),
            rightBottom + 24,
            easierStart,
            () => void this.#toggleEasierStart(),
          );
        }
      }
    } else if (hasPool && !seatCall) {
      const handledTop = scrolled
        ? Math.max(leftBottom, this.#bottomOf(contentStart)) + 20
        : leftBottom + (this.#pending ? 140 : 20);
      this.#drawHandled(
        { x: gutter, y: handledTop, width: width - gutter * 2, height: Math.max(1, contentBottom - handledTop) },
        view,
        stops,
      );
    } else if (scrolled || view) {
      // The Decks panel is there while a call is pending too (its placeholder says it waits on the answer).
      const decksRect: Rect = {
        x: gutter,
        y: scrolled ? Math.max(leftBottom, this.#bottomOf(contentStart)) + 20 : leftBottom + (this.#pending ? 140 : 20),
        width: width - gutter * 2,
        height: 0,
      };
      this.#drawDecks(decksRect, view, stops);
    }

    if (region)
      this.#captureIntoRegion(region, scrollHeights, contentStart, stops, stopsBefore, top.height, actionBar.y);

    // Bottom action bar: "EDIT DECKS"/"DECKS" outlined, "OPEN ISSUE #N ▸" the one red CTA — disabled until the
    // issue is composed and nothing is still being asked.
    const editRect: Rect = phone
      ? { x: 12, y: actionBar.y + (actionBar.height - 48) / 2, width: (width - 12 * 3) / 2, height: 48 }
      : { x: width - 16 - 425 - 12 - 150, y: actionBar.y + (actionBar.height - 62) / 2, width: 150, height: 62 };
    const editDecks = (): void => void this.#editDecks();
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: phone ? "DECKS" : "EDIT DECKS",
        type: typeRole.label,
        rect: editRect,
        onClick: editDecks,
      }),
    );
    stops.set("edit-decks", { rect: editRect, activate: editDecks });

    // A deck setup would refuse blocks the button up front, with the reason beside it; the edit button then goes to
    // the offending seat. Nothing is judged here: `#deckProblems` is the engine's own verdict.
    const deckProblems = this.#deckProblems(record);
    const blockedSeat = [...deckProblems.keys()][0];
    const blocked = !!record.attempt && blockedSeat !== undefined;
    const canOpen = !!record.attempt && !this.#pending && !this.#composing && !this.#starting && !blocked;
    const openRect: Rect = phone
      ? { x: 12 + editRect.width + 12, y: editRect.y, width: editRect.width, height: 48 }
      : { x: width - 16 - 425, y: editRect.y, width: 425, height: 62 };
    const openIssue = (): void => void this.#openIssue();
    this.#buttons.push(
      new McButton(this, {
        kind: "primary",
        label: this.#starting ? "Opening…" : blocked ? "Fix a deck first" : `Open issue #${this.#issueNumber} ▸`,
        type: typeRole.barTitle,
        rect: openRect,
        onClick: openIssue,
        enabled: canOpen,
      }),
    );
    if (canOpen) stops.set("open", { rect: openRect, activate: openIssue });

    if (blocked) {
      const seat = record.seats.find((candidate) => candidate.seatNumber === blockedSeat);
      const who = seat ? cardName(seat.identityCardId as string) : `Seat ${blockedSeat}`;
      const reason = `${who}: ${deckProblems.get(blockedSeat as number) as string}. Edit that deck to open this issue.`;
      const reasonWidth = phone ? width - gutter * 2 : editRect.x - gutter - 16;
      const text = this.add
        .text(gutter, 0, `! ${reason}`, textStyle({ ...typeRole.label, size: 14 }, accent.heroRed.hex, 1))
        .setOrigin(0, 0)
        .setWordWrapWidth(reasonWidth);
      // Beside the buttons on a desktop bar; a phone's two buttons fill the bar, so the reason sits on a strip above it.
      if (phone) {
        const stripHeight = text.height + 12;
        const strip = this.add
          .rectangle(0, actionBar.y - stripHeight, width, stripHeight, surface.paper.hex)
          .setOrigin(0, 0);
        strip.setDepth(5);
        text.setDepth(6).setY(actionBar.y - stripHeight + 6);
      } else {
        text.setY(actionBar.y + (actionBar.height - text.height) / 2);
      }
    }
    if (this.#startError) {
      label(this, gutter, actionBar.y - 20, this.#startError, typeRole.label, accent.heroRed.hex, 1);
    }
    if (this.#seatPicker) this.#drawSeatPicker(record, width, height, stops);

    this.#route =
      this.#route ??
      new FocusRoute(this, {
        onCancel: back,
        blocked: () => this.scene.isActive(SCENES.inspect),
        onPage: (direction) => this.#briefingRegion?.scrollByPx(direction * 400),
      });
    this.#route.set([...stops.keys()], stops);
  }

  /** The easier-start toggle for the composed issue (`view/campaign-easier-start-model.ts`): null when the issue does not offer it. */
  #easierStartFor(record: CampaignRecord): EasierStartBriefing | null {
    try {
      return easierStartBriefingOf(record, campaignService().launchConfig(record));
    } catch {
      return null;
    }
  }

  /** Flips the toggle (stored on the run, off by default) and redraws; nothing is composed again. */
  async #toggleEasierStart(): Promise<void> {
    const record = this.#record;
    if (!record?.attempt || this.#starting) return;
    this.#record = await campaignService().setEasierStart(record, !easierStartIsOn(record));
    if (this.sys.isActive()) this.#draw();
  }

  /** The lowest edge of everything drawn at the top level since `fromIndex`, graphics aside (they only frame text). */
  #bottomOf(fromIndex: number): number {
    let bottom = 0;
    for (const object of this.children.list.slice(fromIndex)) {
      if (object.type === "Graphics") continue;
      const bounds = (object as Phaser.GameObjects.Text).getBounds();
      bottom = Math.max(bottom, bounds.bottom);
    }
    return bottom;
  }

  /**
   * Moves what the briefing drew since `fromIndex` into the phone's scroll region and sizes it, then turns each
   * control drawn inside it into a stop that follows the scroll offset and scrolls itself into view on focus.
   */
  #captureIntoRegion(
    region: McScrollRegion,
    heights: number[],
    fromIndex: number,
    stops: Map<string, FocusStop>,
    stopsBefore: ReadonlySet<string>,
    viewportTop: number,
    viewportBottom: number,
  ): void {
    const bottom = this.#bottomOf(fromIndex);
    const added = this.children.list.slice(fromIndex);
    if (added.length > 0) region.content.add(added);
    // The scroll math reads this one entry as the content's height, measured from the viewport's top.
    heights[0] = Math.max(0, bottom + 16 - viewportTop);
    for (const [key, stop] of stops) {
      if (stopsBefore.has(key) || typeof stop.rect === "function") continue;
      const rect = stop.rect;
      stops.set(key, {
        ...stop,
        rect: () => ({ ...rect, y: rect.y - this.#briefingScroll.offsetPx }),
        ensureVisible: () => {
          const offset = this.#briefingScroll.offsetPx;
          const delta = revealDelta(
            { top: viewportTop, bottom: viewportBottom },
            { top: rect.y - offset, bottom: rect.y + rect.height - offset },
          );
          if (delta !== 0) region.scrollByPx(delta);
        },
      });
    }
    region.refresh();
  }

  /** The round portrait + speech bubble: whoever the story's briefing line speaks as, or the first seat. */
  #drawSpeaker(rect: Rect, record: CampaignRecord, phone: boolean): number {
    const rosterIds = record.seats.map((seat) => seat.identityCardId);
    const story = this.#story;
    if (!story) return rect.y;
    const resolved = lineForRoster(story.briefing, rosterIds);
    if (!resolved) return rect.y;
    const nodeId = record.attempt?.nodeId ?? record.position.nextNodeId ?? "";
    const speaker = briefingSpeakerOf(
      resolved.speaker,
      { scenarioId: nodeId, villainName: story.villain },
      record.seats[0]?.identityCardId ?? null,
    );
    const portraitSize = phone ? 64 : 84;
    const portraitRect: Rect = { x: rect.x, y: rect.y, width: portraitSize, height: portraitSize };
    const radius = portraitSize / 2;
    const centerX = rect.x + radius;
    const centerY = rect.y + radius;
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 1).fillCircle(centerX, centerY, radius);
    // A hero whose portrait is not filed yet (a new box's `art/heroes/_pending/`) speaks over the box's own cover.
    const picture = speaker.villainScenarioId
      ? villainPicture(speaker.villainScenarioId)
      : speaker.heroIdentityId
        ? (heroPicture(speaker.heroIdentityId) ?? campaignCoverFor(CAMPAIGN_ART, record.campaignId as string))
        : null;
    const image = picture ? drawPicture(this, picture, portraitRect, () => this.#draw(), { focusY: 0.15 }) : null;
    if (image) {
      // The design's round portrait, clipped through `ui/rex.ts` (Phaser 4's own geometry mask does nothing under
      // WebGL). The mask shape stays off the display list, so it is destroyed with the image.
      const maskShape = this.make.graphics({}, false);
      maskShape.fillStyle(0xffffff).fillCircle(centerX, centerY, radius);
      setMask(image, maskShape, "world");
      image.once(Phaser.GameObjects.Events.DESTROY, () => maskShape.destroy());
    } else if (!speaker.heroIdentityId && speaker.initial) {
      // A voice with no picture draws its initial rather than somebody else's face.
      this.add
        .text(
          centerX,
          centerY,
          speaker.initial.toUpperCase(),
          textStyle(bangers(portraitSize * 0.5), surface.paper.hex),
        )
        .setOrigin(0.5);
    }
    const border = this.add.graphics();
    border.lineStyle(3, surface.ink.hex, 1).strokeCircle(centerX, centerY, radius);
    const { rect: bubbleRect } = speechBubble(
      this,
      rect.x + portraitSize + 16,
      rect.y,
      rect.width - portraitSize - 16,
      resolved.text,
      {
        tail: "left",
        size: 15,
        ...(speaker.name ? { speaker: speaker.name } : {}),
      },
    );
    return Math.max(rect.y + portraitSize, bubbleRect.y + bubbleRect.height);
  }

  /** A pool row's own small card-art thumbnail — see `scenes/campaign/dossier.ts`'s identical `#poolCardThumb`. */
  #poolCardThumb(name: string, rect: Rect): void {
    const fill = this.add.graphics();
    fill.fillStyle(0xe4dcc6, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    const card = cardOfName(name);
    const key = card ? cardArt(this).request(this, artFor(card, { kind: "front" })) : null;
    const art = drawArt(this, key, rect);
    if (!art) {
      this.add
        .text(rect.x + rect.width / 2, rect.y + rect.height / 2, "no\nscan", {
          ...textStyle(typeRole.label, surface.ink.hex, 0.4),
          fontSize: "8px",
          align: "center",
        })
        .setOrigin(0.5);
    }
    this.add.graphics().lineStyle(1, surface.ink.hex, 0.6).strokeRect(rect.x, rect.y, rect.width, rect.height);
  }

  /**
   * "From the pool" (design tiles 24/26): one row per resolved pool card this issue's own setup reads back, each
   * with its own colored stripe, art thumbnail and a ✓ (helps)/✗ (hurts) mark — or, for the box's finale on a
   * desktop/tablet-width column, one boxed group per destination with a small row of art tiles (design tile 26's
   * own grid); the finale on a phone keeps the same flat, full-width rows every other issue uses (design tile 24's
   * own phone layout never grew a second column to grid into).
   */
  #drawPool(rect: Rect, pool: BriefingPoolView, phone: boolean): number {
    let y = ruleHeading(
      this,
      rect.x,
      rect.y,
      rect.width,
      pool.groups ? `From the pool · ${pool.rows.length} cards` : "From the pool",
      surface.ink.hex,
      20,
    );
    const thumbSize = 44;
    const rowRect = (row: BriefingPoolRow, top: number): number => {
      const rowHeight = 54;
      const stripeColor = row.helps ? signal.heal.hex : accent.heroRed.hex;
      const box = this.add.graphics();
      box.fillStyle(surface.card.hex, 1).fillRect(rect.x, top, rect.width, rowHeight);
      box.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, top, rect.width, rowHeight);
      box.fillStyle(stripeColor, 1).fillRect(rect.x, top, 6, rowHeight);
      const textX = rect.x + 6 + 8 + thumbSize + 10;
      this.#poolCardThumb(row.name, {
        x: rect.x + 6 + 8,
        y: top + (rowHeight - thumbSize) / 2,
        width: thumbSize,
        height: thumbSize,
      });
      this.add.text(textX, top + 8, row.name.toUpperCase(), textStyle(bangers(15), surface.ink.hex));
      this.add
        .text(textX, top + 28, row.destination, textStyle(typeRole.body, surface.ink.hex, 0.7))
        .setFontSize(11)
        .setWordWrapWidth(rect.x + rect.width - 24 - textX);
      this.add
        .text(rect.x + rect.width - 24, top + rowHeight / 2, row.helps ? "✓" : "✗", {
          ...textStyle({ ...typeRole.rowTitle, size: 16 }, stripeColor),
        })
        .setOrigin(0.5);
      return top + rowHeight + 10;
    };
    if (!pool.groups) {
      for (const row of pool.rows) y = rowRect(row, y);
      return y;
    }
    if (phone) {
      for (const group of pool.groups) {
        const headerHeight = 22;
        this.add.rectangle(rect.x, y, rect.width, headerHeight, surface.ink.hex, 0.08).setOrigin(0, 0);
        this.add.text(rect.x + 8, y + 4, group.title.toUpperCase(), {
          ...textStyle(typeRole.label, surface.ink.hex, 0.7),
          fontSize: "10px",
          fontStyle: "700",
        });
        y += headerHeight + 6;
        for (const row of group.rows) y = rowRect(row, y);
        y += 6;
      }
      return y;
    }
    return this.#drawPoolGroupGrid(rect, pool.groups, y);
  }

  /**
   * The finale's own desktop/tablet grid (design tile 26): a 2-column layout of boxed groups, each a header bar
   * (title + a generic one-line subtitle, `campaign-pool-model.ts`'s own `GROUP_SUBTITLES`) over a row of small art
   * tiles, one per card, each with its name and its own ALLY/ENEMY/HELPS/AGAINST badge underneath.
   */
  #drawPoolGroupGrid(rect: Rect, groups: readonly BriefingPoolGroup[], top: number): number {
    const columnGap = 24;
    const columnWidth = (rect.width - columnGap) / 2;
    const tileSize = 64;
    // Wider than the thumbnail itself: a two-word name wraps to two lines inside its *own* column
    // (`nameWrapWidth`, narrower than the tile's own pitch), so neighboring tiles' text never bleeds into each
    // other even when Bangers' real glyph widths run wider than the wrap estimate (`tileGap`'s own safety margin).
    const tileGap = 18;
    const nameWrapWidth = tileSize;
    let leftY = top;
    let rightY = top;
    groups.forEach((group, index) => {
      const columnX = index % 2 === 0 ? rect.x : rect.x + columnWidth + columnGap;
      const groupTop = index % 2 === 0 ? leftY : rightY;
      const headerHeight = 40;
      const header = this.add.graphics();
      header.fillStyle(0xe4dcc6, 1).fillRect(columnX, groupTop, columnWidth, headerHeight);
      this.add.text(columnX + 10, groupTop + 4, group.title.toUpperCase(), {
        ...textStyle(typeRole.label, surface.ink.hex, 0.8),
        fontSize: "11px",
        fontStyle: "700",
      });
      this.add
        .text(columnX + 10, groupTop + 20, group.subtitle, {
          ...textStyle(typeRole.body, surface.ink.hex, 0.55),
          fontSize: "10px",
        })
        .setWordWrapWidth(columnWidth - 20);
      let tileY = groupTop + headerHeight + 10;
      let tileX = columnX + 10;
      // Measured once per group from its own longest name — every tile in the group then reserves the same
      // height under its thumbnail, so the badge line never has to guess how many lines the name above it took.
      const nameHeight = Math.max(
        ...group.rows.map((row) => {
          const measure = this.add
            .text(0, 0, row.name.toUpperCase(), textStyle(bangers(11), 0))
            .setWordWrapWidth(nameWrapWidth)
            .setVisible(false);
          const height = measure.height;
          measure.destroy();
          return height;
        }),
      );
      const rowHeight = tileSize + 10 + nameHeight + 16;
      for (const row of group.rows) {
        if (tileX + tileSize > columnX + columnWidth - 10) {
          tileX = columnX + 10;
          tileY += rowHeight;
        }
        const stripeColor = row.helps ? signal.heal.hex : accent.heroRed.hex;
        this.#poolCardThumb(row.name, { x: tileX, y: tileY, width: tileSize, height: tileSize });
        this.add.rectangle(tileX, tileY + tileSize, tileSize, 3, stripeColor).setOrigin(0, 0);
        this.add
          .text(tileX, tileY + tileSize + 6, row.name.toUpperCase(), textStyle(bangers(11), surface.ink.hex))
          .setWordWrapWidth(nameWrapWidth);
        this.add.text(tileX, tileY + tileSize + 8 + nameHeight, row.badgeLabel, {
          ...textStyle(typeRole.label, stripeColor, 1),
          fontSize: "9px",
          fontStyle: "700",
        });
        tileX += tileSize + tileGap;
      }
      const groupBottom = tileY + rowHeight + 6;
      this.add
        .graphics()
        .lineStyle(2, surface.ink.hex, 1)
        .strokeRect(columnX, groupTop, columnWidth, groupBottom - groupTop);
      if (index % 2 === 0) leftY = groupBottom + 16;
      else rightY = groupBottom + 16;
    });
    return Math.max(leftY, rightY);
  }

  /** The waiting note, wrapped to the panel; returns its height. */
  #drawWaiting(x: number, y: number, width: number, panel: WaitingPanel): number {
    const note = this.add
      .text(x, y, this.#waitingText(panel), textStyle(typeRole.body, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(width);
    return note.height;
  }

  /** What an unfilled panel says while the issue waits on a call, or is still composing. */
  #waitingText(panel: WaitingPanel): string {
    const record = this.#record;
    const pending = this.#pending;
    const modular = pending && record ? this.#modularCallFor(pending, record) !== null : false;
    return waitingNoteOf(panel, pending ? "asking" : "composing", modular ? "genre-set pick" : null);
  }

  #drawHandled(rect: Rect, view: BriefingView | null, stops: Map<string, FocusStop>): number {
    void stops;
    if (rect.height <= 0) return rect.y;
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Handled for you", surface.ink.hex, 20);
    if (!view) {
      return y + this.#drawWaiting(rect.x, y, rect.width, "handled") + 8;
    }
    if (view.handled.length === 0) {
      label(this, rect.x, y, "Nothing automatic this issue.", typeRole.label, surface.ink.hex, ink.secondary);
      return y + 20;
    }
    const listTop = y;
    const rowXs = { glyph: rect.x + 12, text: rect.x + 36 };
    const rows: { row: HandledRow; y: number; height: number }[] = [];
    let cursor = y + 10;
    for (const row of view.handled) {
      const height = this.#measureHandledRow(row, rect.width - 48);
      rows.push({ row, y: cursor, height });
      cursor += height;
    }
    const listHeight = cursor - listTop + 10;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, listTop, rect.width, listHeight);
    rows.forEach(({ row, y: rowY }, index) => {
      if (index > 0) g.lineStyle(1, surface.ink.hex, 0.2).lineBetween(rect.x, rowY, rect.x + rect.width, rowY);
      // The canvas: green ✓ for this issue, blue → for a value held for a later one (never Hero Red, which is the CTA's).
      const glyphColor = row.status === "done" ? signal.heal.hex : signal.cost.hex;
      this.add
        .text(
          rowXs.glyph,
          rowY + 10,
          row.status === "done" ? "✓" : "→",
          textStyle({ ...typeRole.rowTitle, size: 14 }, glyphColor),
        )
        .setOrigin(0.5, 0);
      const citationWidth = row.citation ? 90 : 0;
      const title = this.add
        .text(rowXs.text, rowY + 8, row.title, textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width - 48 - citationWidth);
      if (row.citation) {
        this.add
          .text(rect.x + rect.width - 12, rowY + 10, row.citation, {
            ...textStyle(typeRole.label, surface.ink.hex, 0.4),
            fontSize: "10px",
          })
          .setOrigin(1, 0);
      }
      // A one-sentence row (role-building) has no detail line, and an empty text would still hold a line's height.
      if (row.detail.length > 0) {
        this.add
          .text(
            rowXs.text,
            rowY + 8 + title.height + 2,
            row.detail,
            textStyle(typeRole.body, surface.ink.hex, ink.secondary),
          )
          .setOrigin(0, 0)
          .setWordWrapWidth(rect.width - 48);
      }
    });
    return listTop + listHeight;
  }

  #measureHandledRow(row: HandledRow, width: number): number {
    const title = this.add
      .text(0, 0, row.title, textStyle({ ...typeRole.rowTitle, size: 14 }, 0))
      .setWordWrapWidth(row.citation ? width - 90 : width)
      .setVisible(false);
    const detail =
      row.detail.length > 0
        ? this.add.text(0, 0, row.detail, textStyle(typeRole.body, 0)).setWordWrapWidth(width).setVisible(false)
        : null;
    const height = 8 + title.height + (detail ? 2 + detail.height : 0) + 12;
    title.destroy();
    detail?.destroy();
    return height;
  }

  #drawYourCall(rect: Rect, pending: CampaignPendingChoice, stops: Map<string, FocusStop>, phone: boolean): void {
    if (rect.height <= 0) return;
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Your call", surface.ink.hex, 20);
    const record = this.#record;
    const header = record ? seatHeaderOf(pending, record.seats, heroNameOf) : null;
    if (header) y = this.#drawSeatHeader(rect, y, header, phone);
    const build = record ? this.#roleBuildFor(pending, record) : null;
    if (build) {
      this.#drawRoleBuild(rect, y, build, stops, phone);
      return;
    }
    const scheme = record ? this.#sideSchemeCallFor(pending, record) : null;
    if (scheme) {
      drawSideSchemeCall(
        this.#schemeContext(rect, phone, stops),
        y,
        scheme,
        sideSchemeOptionLabels(scheme.offered),
        (name) => this.#answer([name]),
      );
      return;
    }
    const modular = record ? this.#modularCallFor(pending, record) : null;
    if (modular) {
      drawModularCall(this, rect, y, modular, phone, (id) => this.#answer([id]), stops);
      return;
    }
    // A decision for the whole table is labeled as that, never spoken as if "The team" were a character.
    if (!header) {
      const who = pending.seatNumber !== null ? `Seat ${pending.seatNumber}` : "Everyone decides together";
      y += label(this, rect.x, y, who, typeRole.label, accent.heroRed.hex, 1).height + 4;
    }
    // A box's own plain-words line about the question (`campaign/story.ts`'s `setupCalls`), above the printed rule.
    const words = setupCallCopyFor(pending.instructionId);
    if (words) {
      const explain = this.add
        .text(rect.x, y, words.explain, textStyle(typeRole.emphasis, surface.ink.hex))
        .setOrigin(0, 0)
        .setWordWrapWidth(rect.width);
      y += explain.height + 8;
      y += label(this, rect.x, y, "THE RULE", typeRole.label, surface.ink.hex, ink.label).height + 4;
    }
    const prompt = this.add
      .text(rect.x, y, pending.text, textStyle(typeRole.body, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width);
    y += prompt.height + 12;

    const roles = record ? this.#rolesFor(pending) : null;
    if (record && roles && header) {
      const view = roleCallOf(pending, roles, this.#answers, record.seats, heroNameOf);
      this.#drawRoleCall(rect, y, pending, header, view, stops, phone);
      return;
    }

    if (pending.random) {
      const declineRect: Rect = { x: rect.x, y, width: 160, height: 44 };
      const acceptRect: Rect = { x: rect.x + 172, y, width: 160, height: 44 };
      const decline = (): void => this.#answer([]);
      const accept = (): void => this.#answer([CAMPAIGN_ACCEPT]);
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: "Decline",
          type: typeRole.label,
          rect: declineRect,
          onClick: decline,
        }),
      );
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Take it",
          type: typeRole.label,
          rect: acceptRect,
          onClick: accept,
        }),
      );
      stops.set("call-decline", { rect: declineRect, activate: decline });
      stops.set("call-accept", { rect: acceptRect, activate: accept });
      return;
    }

    // Room for the options: the panel's height less a paging strip and the Confirm/Decline row beneath them.
    const reserved = (pending.options.length > 24 ? 56 : 0) + 56 + (pending.count > 1 && pending.optional ? 56 : 0);
    const grid = callGridOf({
      count: pending.options.length,
      x: rect.x,
      y,
      width: rect.width,
      maxHeight: Math.max(44, rect.y + rect.height - y - reserved),
      page: this.#callPage,
    });
    const optionLabels = optionLabelsOf(pending.options, (id) => CARDS_BY_ID.get(id), packNameOf);
    pending.options.slice(grid.firstIndex, grid.firstIndex + grid.rects.length).forEach((optionId, shownIndex) => {
      const index = grid.firstIndex + shownIndex;
      const optionLabel = optionLabels.get(optionId) ?? cardName(optionId);
      const optionRect = grid.rects[shownIndex]!;
      const selected = this.#picking.includes(optionId);
      const toggle = (): void => {
        if (pending.count <= 1) {
          this.#answer([optionId]);
          return;
        }
        this.#picking = selected ? this.#picking.filter((id) => id !== optionId) : [...this.#picking, optionId];
        this.#draw();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: optionLabel,
          type: typeRole.label,
          rect: optionRect,
          onClick: toggle,
          selected,
        }),
      );
      stops.set(`call-option:${index}`, { rect: optionRect, activate: toggle });
    });
    let below = grid.bottom + 12;
    if (grid.pageCount > 1) {
      const turn = (by: number): void => {
        this.#callPage = Math.min(Math.max(grid.page + by, 0), grid.pageCount - 1);
        this.#draw();
      };
      const prevRect: Rect = { x: rect.x, y: below, width: 130, height: 44 };
      const nextRect: Rect = { x: rect.x + 142, y: below, width: 130, height: 44 };
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "◂ Prev",
          type: typeRole.label,
          rect: prevRect,
          onClick: () => turn(-1),
          enabled: grid.page > 0,
        }),
        new McButton(this, {
          kind: "quiet",
          label: "Next ▸",
          type: typeRole.label,
          rect: nextRect,
          onClick: () => turn(1),
          enabled: grid.page < grid.pageCount - 1,
        }),
      );
      if (grid.page > 0) stops.set("call-prev", { rect: prevRect, activate: () => turn(-1) });
      if (grid.page < grid.pageCount - 1) stops.set("call-next", { rect: nextRect, activate: () => turn(1) });
      label(
        this,
        rect.x + 290,
        below + 14,
        `Page ${grid.page + 1} of ${grid.pageCount}`,
        typeRole.label,
        surface.ink.hex,
        ink.secondary,
      );
      below += 56;
    }
    if (pending.count > 1) {
      const confirmRect: Rect = { x: rect.x, y: below, width: 160, height: 44 };
      const confirm = (): void => this.#answer(this.#picking);
      this.#buttons.push(
        new McButton(this, {
          kind: "primary",
          label: "Confirm",
          type: typeRole.label,
          rect: confirmRect,
          onClick: confirm,
          enabled: this.#picking.length === pending.count,
        }),
      );
      if (this.#picking.length === pending.count) stops.set("call-confirm", { rect: confirmRect, activate: confirm });
    }
    if (pending.optional) {
      const declineRect: Rect = {
        x: rect.x,
        y: below + (pending.count > 1 ? 56 : 0),
        width: 160,
        height: 44,
      };
      const decline = (): void => this.#answer([]);
      this.#buttons.push(
        new McButton(this, {
          kind: "quiet",
          label: "Decline",
          type: typeRole.label,
          rect: declineRect,
          onClick: decline,
        }),
      );
      stops.set("call-decline", { rect: declineRect, activate: decline });
    }
  }

  /** The side-scheme call's view for `pending` (the box's per-scenario scheme pick), or null for any other choice. */
  #sideSchemeCallFor(pending: CampaignPendingChoice, record: CampaignRecord): SideSchemeBriefing | null {
    const definition = this.#definition;
    if (!definition || pending.seatNumber !== null) return null;
    const view = sideSchemeBriefingOf({ definition, record, pending, cardName });
    return view && view.instructionId === pending.instructionId && view.offered.length > 0 ? view : null;
  }

  #schemeContext(rect: Rect, phone: boolean, stops: Map<string, FocusStop>): SideSchemeDrawContext {
    return {
      scene: this,
      rect,
      phone,
      buttons: this.#buttons,
      stops,
      inspect: (card: SchemeCardRef) =>
        this.scene.launch(SCENES.inspect, { card: { cardId: card.cardId, face: { kind: "front" } } }),
    };
  }

  /** The modular-set call's view for `pending` (a pick of an encounter set), or null for any other choice. */
  #modularCallFor(pending: CampaignPendingChoice, record: CampaignRecord): ModularSetCallView | null {
    const definition = this.#definition;
    const roles = CONTENT_CAMPAIGNS.find(
      (campaign) => (campaign.id as string) === (record.campaignId as string),
    )?.roles;
    if (!definition || !isModularSetCall(pending, KNOWN_ENCOUNTER_SET_IDS, roles)) return null;
    const node = definition.graph.nodes.find((candidate) => candidate.id === record.position.nextNodeId);
    if (!node) return null;
    const source = modularCallSourceOf(
      pending,
      [...(definition.everyNodeSetup ?? []), ...(node.composition ?? []), ...node.setup],
      definition.logFields,
      record.shared,
    );
    const scenarioId = node.scenario.kind === "fixed" ? (node.scenario.scenarioId as string) : null;
    if (!source) return null;
    return modularSetCallOf({
      pending,
      answers: this.#answers,
      universe: source.universe,
      checkedOff: source.checkedOff,
      scenario: POOL_SCENARIOS.find((scenario) => (scenario.id as string) === scenarioId),
      seatCount: record.seats.length,
      setNameOf: (id) => ENCOUNTER_SET_NAMES.get(id) ?? id,
      cardCountOf: (id) => cardCountForSet(id, CARDS_BY_ID),
      descriptorOf: (id) => descriptorForSet(id, CARDS_BY_ID),
    });
  }

  /** The role-building context for `pending` (the seat's role, deck aspects and hero stats), or null for any other choice. */
  #roleBuildFor(
    pending: CampaignPendingChoice,
    record: CampaignRecord,
  ): { readonly ctx: RoleBuildContext; readonly cards: readonly RoleBuildCard[] } | null {
    const roles = CONTENT_CAMPAIGNS.find(
      (campaign) => (campaign.id as string) === (record.campaignId as string),
    )?.roles;
    const seat = record.seats.find((candidate) => candidate.seatNumber === pending.seatNumber);
    if (!roles || !seat) return null;
    const role = seatRoleOf(seat, roles, this.#answers);
    const cardOf = (id: string): { type: string; aspect?: string } | undefined => {
      const card = CARDS_BY_ID.get(id);
      return card ? { type: card.type, aspect: (card as { aspect?: string }).aspect ?? "" } : undefined;
    };
    if (!role || !isRoleBuildChoice(pending, role, cardOf)) return null;
    const hero = CARDS_BY_ID.get(seat.identityCardId as string);
    const labels = optionLabelsOf(pending.options, (id) => CARDS_BY_ID.get(id), packNameOf);
    const cards = pending.options.map((id): RoleBuildCard => {
      const card = CARDS_BY_ID.get(id)! as AnyCard & {
        aspect: CoreAspect;
        cost?: number;
        specialCost?: unknown;
        text?: { current: string };
      };
      return {
        id,
        label: labels.get(id) ?? card.name,
        name: card.name,
        type: card.type as "event" | "upgrade",
        aspect: card.aspect,
        cost: card.specialCost ? null : (card.cost ?? null),
        text: card.text?.current ?? "",
      };
    });
    return {
      cards,
      ctx: {
        heroName: heroNameOf(seat.identityCardId),
        roleName: role.name,
        roleAspects: role.aspects as readonly CoreAspect[],
        deckAspects: seat.deck.aspects as readonly CoreAspect[],
        atk: hero?.type === "hero_identity" ? hero.hero.atk : null,
        thw: hero?.type === "hero_identity" ? hero.hero.thw : null,
      },
    };
  }

  #inspectRoleBuildCard(cardId: string, takeable: boolean): void {
    this.scene.launch(SCENES.inspect, {
      card: { cardId: cardId as CardId, face: { kind: "front" } },
      ...(takeable ? { choice: { optionId: cardId, label: "Take this card" } } : {}),
    });
  }

  /** One card as a picture: the scan when there is one, else a parchment frame in the aspect's color with the name. */
  #drawCardFace(rect: Rect, card: RoleBuildCardView): Phaser.GameObjects.GameObject[] {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const g = this.add.graphics();
    g.fillStyle(surface.parchment.hex, 1).fillRect(rect.x, rect.y, rect.width, rect.height);
    objects.push(g);
    const data = CARDS_BY_ID.get(card.id);
    const source = artFor(data, { kind: "front" });
    const key = cardArt(this).request(this, source);
    const art = drawArt(this, key, rect, { fit: "cover" });
    if (art) objects.push(art);
    else {
      const band = this.add.graphics();
      band.fillStyle(card.aspect.fill, 1).fillRect(rect.x, rect.y, rect.width, 14);
      objects.push(band);
      const missing = !source || cardArt(this).isMissing(source.key);
      objects.push(
        this.add
          .text(
            rect.x + rect.width / 2,
            rect.y + rect.height / 2,
            missing ? `${card.name}\n(no scan)` : card.name,
            textStyle(typeRole.label, surface.ink.hex),
          )
          .setOrigin(0.5)
          .setAlign("center")
          .setWordWrapWidth(rect.width - 12),
      );
    }
    const frame = this.add.graphics();
    frame.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x + 1, rect.y + 1, rect.width - 2, rect.height - 2);
    objects.push(frame);
    return objects;
  }

  /** The Inspect affordance on a picture: a small magnifier badge, drawn rather than glyphed so no font is needed. */
  #drawMagnifier(art: Rect): Phaser.GameObjects.GameObject {
    const size = 26;
    const cx = art.x + art.width - size / 2 - 4;
    const cy = art.y + size / 2 + 4;
    const g = this.add.graphics();
    g.fillStyle(surface.ink.hex, 0.85).fillCircle(cx, cy, size / 2);
    g.lineStyle(2.5, surface.paper.hex, 1).strokeCircle(cx - 2, cy - 2, 5.5);
    g.lineBetween(cx + 2, cy + 2, cx + 7, cy + 7);
    return g;
  }

  /** "Role-building": recommended cards first, then the rest as a picture grid; DECLINE always at the foot. */
  #drawRoleBuild(
    rect: Rect,
    top: number,
    call: { readonly ctx: RoleBuildContext; readonly cards: readonly RoleBuildCard[] },
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): void {
    const { ctx } = call;
    const view = roleBuildOf(call.cards, ctx, this.#roleBuild);
    this.#roleBuildView = view;
    const selected = view.all.find((card) => card.id === this.#roleBuild.selected);
    if (selected) {
      this.#drawRoleBuildConfirm(rect, top, ctx, view, selected, stops);
      return;
    }
    const aspectsLabel = ctx.roleAspects.map((aspect) => aspectStampOf(aspect).label).join(" + ");
    const intro = this.add
      .text(
        rect.x,
        top,
        `Up to 1 ${view.noun} from the ${ctx.roleName}'s aspects (${aspectsLabel}), for this game only. Tap a card to read it; TAKE picks it.`,
        { ...textStyle(typeRole.body, surface.ink.hex, ink.secondary), fontSize: phone ? "11px" : "12px" },
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width)
      .setLineSpacing(2);
    let y = top + intro.height + 8;

    const chipGap = 6;
    const chipWidth = Math.floor((rect.width - chipGap * (view.chips.length - 1)) / view.chips.length);
    view.chips.forEach((chip, index) => {
      const chipRect: Rect = { x: rect.x + index * (chipWidth + chipGap), y, width: chipWidth, height: hit.target };
      const stamp = chip.aspect ? aspectStampOf(chip.aspect) : null;
      const apply = (): void => {
        this.#roleBuild = setRoleBuildFilter(this.#roleBuild, chip.aspect);
        this.#roleBuildScroll = new VariableListScroll();
        this.#draw();
      };
      this.#buttons.push(
        new McButton(this, {
          kind: "secondary",
          label: chip.label,
          type: STAMP_CHIP_TYPE,
          rect: chipRect,
          selected: chip.selected,
          ...(stamp ? { tint: { fill: stamp.fill, ink: stamp.ink } } : {}),
          onClick: apply,
        }),
      );
      stops.set(`rb-chip:${chip.aspect ?? "all"}`, { rect: chipRect, activate: apply });
    });
    y += hit.target + 8;

    const declineRect: Rect = {
      x: rect.x,
      y: rect.y + rect.height - hit.primary,
      width: rect.width,
      height: hit.primary,
    };
    const decline = (): void => this.#answer([]);
    this.#buttons.push(
      new McButton(this, {
        kind: "secondary",
        label: `Decline · no ${view.noun} this game`,
        type: typeRole.label,
        rect: declineRect,
        onClick: decline,
      }),
    );
    stops.set("call-decline", { rect: declineRect, activate: decline });

    const listRect: Rect = { x: rect.x, y, width: rect.width, height: Math.max(140, declineRect.y - 8 - y) };
    const { rows, heights, geometry } = roleBuildRowsOf(view, listRect.width - 8);
    if (rows.length === 0) {
      label(this, rect.x, y, `No ${view.noun} matches this filter.`, typeRole.label, surface.ink.hex, ink.secondary);
      return;
    }
    const take = (id: string): void => {
      this.#roleBuild = selectRoleBuildCard(this.#roleBuild, view, id);
      this.#draw();
    };
    const inspect = (id: string): void => this.#inspectRoleBuildCard(id, true);
    const clip = (): Rect => listRect;
    const suppressClick = (): boolean => this.#roleBuildList?.isDragSuppressingClick ?? false;
    const inset = 4;
    const nameStyle = { ...textStyle(typeRole.rowTitle, surface.ink.hex), fontSize: "11px" };

    const cellRectOf = (rowRect: Rect, col: number): Rect => ({
      x: rowRect.x + inset + col * (geometry.cellWidth + 8),
      y: rowRect.y + 2,
      width: geometry.cellWidth,
      height: geometry.cellHeight - 4,
    });
    const recArtOf = (rowRect: Rect): Rect => ({
      x: rowRect.x + inset,
      y: rowRect.y + 8,
      width: REC_ART_WIDTH,
      height: recRowHeight() - 16,
    });

    const renderRow = (index: number, rowRect: Rect): VirtualListRow => {
      const row = rows[index]!;
      const objects: Phaser.GameObjects.GameObject[] = [];
      if (row.kind === "label") {
        objects.push(
          label(this, rowRect.x + inset, rowRect.y + rowRect.height / 2, row.text, typeRole.label, surface.ink.hex, 0.7)
            .setOrigin(0, 0.5)
            .setFontSize(11),
        );
        return { objects };
      }
      if (row.kind === "recommended") {
        const art = recArtOf(rowRect);
        objects.push(...this.#drawCardFace(art, row.card), this.#drawMagnifier(art));
        const textX = art.x + art.width + 12;
        const textWidth = rowRect.width - inset - (textX - rowRect.x) - 8;
        const tag = this.add
          .text(textX + 6, art.y + 9, "RECOMMENDED", {
            ...textStyle(typeRole.label, surface.paper.hex),
            fontSize: "10px",
          })
          .setOrigin(0, 0.5);
        const chip = this.add.graphics();
        chip.fillStyle(accent.heroRed.hex, 1).fillRect(textX, art.y, tag.width + 12, 18);
        // The chip's width comes from the text, so the text is made first; the row layer stacks `objects` in order.
        objects.push(chip, tag);
        const name = this.add.text(textX, art.y + 20, row.card.label, { ...nameStyle, fontSize: "14px" });
        name.setWordWrapWidth(textWidth).setMaxLines(2);
        const reason = this.add
          .text(textX, name.y + name.height + 2, row.card.reason ?? "", {
            ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
            fontSize: "11px",
          })
          .setWordWrapWidth(textWidth)
          .setMaxLines(3)
          .setLineSpacing(1);
        objects.push(name, reason);
        const buttonY = art.y + art.height - 40;
        const buttonWidth = Math.floor((textWidth - 6) / 2);
        objects.push(
          new McButton(this, {
            kind: "quiet",
            label: "Inspect",
            type: typeRole.label,
            rect: { x: textX, y: buttonY, width: buttonWidth, height: 40 },
            onClick: () => inspect(row.card.id),
            clip,
            suppressClick,
          }).container,
          new McButton(this, {
            kind: "primary",
            label: "Take",
            type: typeRole.label,
            rect: { x: textX + buttonWidth + 6, y: buttonY, width: buttonWidth, height: 40 },
            onClick: () => take(row.card.id),
            clip,
            suppressClick,
          }).container,
        );
        return { objects };
      }
      row.cards.forEach((card, col) => {
        const cell = cellRectOf(rowRect, col);
        const art: Rect = { x: cell.x, y: cell.y, width: cell.width, height: geometry.artHeight };
        objects.push(...this.#drawCardFace(art, card), this.#drawMagnifier(art));
        const name = this.add.text(cell.x, art.y + art.height + 6, card.label, nameStyle);
        name.setWordWrapWidth(cell.width).setMaxLines(3);
        const meta = this.add.text(
          cell.x,
          art.y + art.height + 6 + NAME_HEIGHT,
          `${card.cost === null ? "Cost X" : `Cost ${card.cost}`} · ${card.aspect.label}`,
          { ...textStyle(typeRole.body, surface.ink.hex, ink.secondary), fontSize: "10px" },
        );
        meta.setWordWrapWidth(cell.width);
        objects.push(
          name,
          meta,
          new McButton(this, {
            kind: "secondary",
            label: "Take",
            type: typeRole.label,
            rect: {
              x: cell.x,
              y: art.y + art.height + 6 + NAME_HEIGHT + META_HEIGHT + 4,
              width: cell.width,
              height: BUTTON_HEIGHT,
            },
            onClick: () => take(card.id),
            clip,
            suppressClick,
          }).container,
        );
      });
      return { objects };
    };

    // A tap on a picture or its name reads the card (Inspect); the Take buttons are their own controls.
    const onRowActivate = (index: number, pointer: Phaser.Input.Pointer): void => {
      const row = rows[index];
      const list = this.#roleBuildList;
      if (!row || !list) return;
      const rowRect = list.rectFor(index);
      if (row.kind === "recommended") {
        const art = recArtOf(rowRect);
        if (pointInRect(pointer.x, pointer.y, art)) inspect(row.card.id);
      } else if (row.kind === "grid") {
        row.cards.forEach((card, col) => {
          const cell = cellRectOf(rowRect, col);
          const readable: Rect = { ...cell, height: geometry.artHeight + 6 + NAME_HEIGHT + META_HEIGHT };
          if (pointInRect(pointer.x, pointer.y, readable)) inspect(card.id);
        });
      }
    };
    this.#roleBuildList = new McVariableList(this, {
      rect: listRect,
      heights,
      renderRow,
      scroll: this.#roleBuildScroll,
      onRowActivate,
    });
    const list = this.#roleBuildList;
    rows.forEach((row, index) => {
      const cards = row.kind === "recommended" ? [row.card] : row.kind === "grid" ? row.cards : [];
      cards.forEach((card, col) => {
        stops.set(`rb-card:${card.id}`, {
          rect: () => (row.kind === "grid" ? cellRectOf(list.rectFor(index), col) : recArtOf(list.rectFor(index))),
          activate: () => inspect(card.id),
          ensureVisible: () => list.scrollIntoView(index),
        });
      });
    });
  }

  /** "Add Drop Kick to Colossus's deck?": only Confirm records the card; Back returns to the same place in the list. */
  #drawRoleBuildConfirm(
    rect: Rect,
    top: number,
    ctx: RoleBuildContext,
    view: RoleBuildView,
    card: RoleBuildCardView,
    stops: Map<string, FocusStop>,
  ): void {
    const confirm = roleBuildConfirmOf(card, ctx.heroName, view.noun);
    const phone = rect.width < 560;
    const pad = 14;
    const inner = rect.width - pad * 2;
    const title = this.add
      .text(rect.x + pad, top + pad, confirm.title.toUpperCase(), textStyle(bangers(phone ? 24 : 28), surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(inner);
    const artWidth = phone ? 120 : 150;
    const artRect: Rect = {
      x: rect.x + pad,
      y: top + pad + title.height + 10,
      width: artWidth,
      height: Math.round(artWidth / 0.716),
    };
    this.#drawCardFace(artRect, card);
    const textX = artRect.x + artWidth + 14;
    const textWidth = rect.x + rect.width - pad - textX;
    const meta = this.add
      .text(
        textX,
        artRect.y,
        `${card.label}\n${card.cost === null ? "Cost X" : `Cost ${card.cost}`} · ${card.aspect.label}`,
        { ...textStyle(typeRole.emphasis, surface.ink.hex), fontSize: "13px" },
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth);
    let cursor = artRect.y + meta.height + 8;
    if (card.reason) {
      const reason = this.add
        .text(textX, cursor, `Recommended: ${card.reason}`, {
          ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
          fontSize: "11px",
        })
        .setOrigin(0, 0)
        .setWordWrapWidth(textWidth);
      cursor += reason.height + 8;
    }
    const detail = this.add
      .text(textX, cursor, confirm.detail, {
        ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
        fontSize: "11px",
      })
      .setOrigin(0, 0)
      .setWordWrapWidth(textWidth);
    cursor = Math.max(artRect.y + artRect.height, cursor + detail.height) + pad;
    const frame = this.add.graphics();
    frame.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, top, rect.width, cursor - top);
    const buttonsY = cursor + 12;
    const buttonWidth = Math.min(180, Math.floor((rect.width - 12) / 2));
    const backRect: Rect = { x: rect.x, y: buttonsY, width: buttonWidth, height: 48 };
    const confirmRect: Rect = { x: rect.x + buttonWidth + 12, y: buttonsY, width: buttonWidth, height: 48 };
    const inspectRect: Rect = { x: rect.x, y: buttonsY + 58, width: buttonWidth, height: hit.target };
    const back = (): void => {
      this.#roleBuild = backFromRoleBuild(this.#roleBuild);
      this.#draw();
    };
    const accept = (): void => {
      const id = confirmedRoleBuildCard(this.#roleBuild, view);
      if (id !== null) this.#answer([id]);
    };
    const read = (): void => this.#inspectRoleBuildCard(card.id, false);
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: "Back", type: typeRole.label, rect: backRect, onClick: back }),
      new McButton(this, {
        kind: "primary",
        label: "Confirm",
        type: typeRole.label,
        rect: confirmRect,
        onClick: accept,
      }),
      new McButton(this, { kind: "quiet", label: "Inspect", type: typeRole.label, rect: inspectRect, onClick: read }),
    );
    stops.set("rb-back", { rect: backRect, activate: back });
    stops.set("rb-confirm", { rect: confirmRect, activate: accept });
    stops.set("rb-inspect", { rect: inspectRect, activate: read });
  }

  /** The seat's hero above its prompt: the roster's own portrait (`art/heroes`) and "SEAT 1 · COLOSSUS". */
  #drawSeatHeader(rect: Rect, y: number, header: SeatHeaderView, phone: boolean): number {
    const size = phone ? 56 : 64;
    const portraitRect: Rect = { x: rect.x, y, width: size, height: size };
    this.add.rectangle(rect.x, y, size, size, surface.ink.hex).setOrigin(0, 0);
    drawPicture(this, heroPicture(header.identityCardId as string), portraitRect, () => this.#draw(), {
      focusY: 0.15,
    });
    this.add.graphics().lineStyle(3, surface.ink.hex, 1).strokeRect(rect.x, y, size, size);
    const chipHeight = 18;
    const hasChips = header.deckAspects.length > 0;
    const title = this.add
      .text(rect.x + size + 14, y + size / 2, header.title, textStyle(bangers(phone ? 22 : 26), surface.ink.hex))
      .setOrigin(0, 0.5);
    fitText(title, rect.width - size - 14, phone ? 22 : 26);
    if (hasChips) {
      // The deck's aspect stamps sit under the name, the same chips the role tiles wear.
      title.setY(y + size / 2 - (chipHeight + 6) / 2);
      this.#drawAspectChips(rect.x + size + 14, title.y + title.height / 2 + 6, { aspects: header.deckAspects });
    }
    return y + size + 12;
  }

  /** One chip per aspect, in the aspect's printed frame color with its name on it (never color alone). */
  #drawAspectChips(x: number, y: number, tile: { readonly aspects: readonly AspectStamp[] }, right = false): number {
    return drawAspectChips(this, x, y, tile.aspects, right).width;
  }

  /** The role choice: four explainer tiles and the "what roles do" note, then (after a tap) the confirm step. */
  #drawRoleCall(
    rect: Rect,
    top: number,
    pending: CampaignPendingChoice,
    header: SeatHeaderView,
    view: RoleCallView,
    stops: Map<string, FocusStop>,
    phone: boolean,
  ): void {
    let y = top;
    const confirmTile = view.tiles.find((tile) => tile.id === this.#roleState.selected);
    if (confirmTile) {
      this.#drawRoleConfirm(rect, y, header, view, confirmTile, stops);
      return;
    }
    const columns = phone || rect.width < 560 ? 1 : 2;
    const gap = 10;
    const tileWidth = Math.floor((rect.width - gap * (columns - 1)) / columns);
    const tileHeight = phone ? 96 : 98;
    view.tiles.forEach((tile, index) => {
      const x = rect.x + (index % columns) * (tileWidth + gap);
      const tileY = y + Math.floor(index / columns) * (tileHeight + gap);
      const tileRect: Rect = { x, y: tileY, width: tileWidth, height: tileHeight };
      this.#drawRoleTile(
        tileRect,
        tile,
        () => {
          this.#roleState = selectRole(this.#roleState, view, tile.id);
          this.#draw();
        },
        stops,
      );
    });
    const rows = Math.ceil(view.tiles.length / columns);
    y += rows * (tileHeight + gap) + 2;
    this.#drawRoleNote(rect, y, phone);
  }

  #drawRoleTile(tileRect: Rect, tile: RoleTileView, onPick: () => void, stops: Map<string, FocusStop>): void {
    const { x, y, width, height } = tileRect;
    const taken = !tile.available;
    this.add.rectangle(x, y, width, height, taken ? 0xe4dcc6 : 0xfffaf0).setOrigin(0, 0);
    const g = this.add.graphics();
    g.lineStyle(taken ? 1 : 2, surface.ink.hex, taken ? 0.4 : 1).strokeRect(x, y, width, height);
    const dim = taken ? 0.5 : 1;
    const name = this.add
      .text(x + 12, y + 8, tile.name.toUpperCase(), textStyle(bangers(22), surface.ink.hex))
      .setOrigin(0, 0)
      .setAlpha(dim);
    const chipsRight = x + width - 12;
    const chipsWidth = this.#drawAspectChips(chipsRight, y + 10, tile, true);
    fitText(name, Math.max(60, width - 36 - chipsWidth), 22);
    if (taken && tile.takenBySeat !== null) {
      // Taken is spelled out (never just dimmed) and the chips stay readable beside it.
      this.add
        .text(
          x + 12,
          y + 36,
          `TAKEN · SEAT ${tile.takenBySeat}${tile.takenByName ? ` · ${tile.takenByName.toUpperCase()}` : ""}`,
          textStyle({ ...typeRole.label, size: 10 }, accent.heroRed.hex),
        )
        .setOrigin(0, 0)
        .setWordWrapWidth(width - 24);
    } else {
      this.add
        .text(x + 12, y + 36, tile.summary, textStyle(typeRole.body, surface.ink.hex, ink.secondary))
        .setOrigin(0, 0)
        .setWordWrapWidth(width - 24);
    }
    if (taken) return;
    this.add
      .text(x + 12, y + height - 8, tile.relation, textStyle(typeRole.label, surface.ink.hex, ink.secondary))
      .setOrigin(0, 1)
      .setWordWrapWidth(width - 24);
    const zone = this.add.zone(x, y, width, height).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    zone.on(Phaser.Input.Events.POINTER_UP, onPick);
    stops.set(`role:${tile.id}`, { rect: tileRect, activate: onPick });
  }

  /** "What roles do": role upgrades and role-building in plain words (MC32 p. 5). */
  #drawRoleNote(rect: Rect, y: number, phone: boolean): void {
    const heading = label(this, rect.x, y, ROLE_EXPLAINER.heading, typeRole.label, surface.ink.hex, 1);
    this.add
      .text(
        rect.x,
        y + heading.height + 6,
        [ROLE_EXPLAINER.upgrades, ROLE_EXPLAINER.building, ROLE_EXPLAINER.rule].join("\n"),
        {
          ...textStyle(typeRole.body, surface.ink.hex, ink.secondary),
          fontSize: phone ? "10px" : "11px",
        },
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width)
      .setLineSpacing(4);
  }

  /** "Colossus will be the Brawler": only Confirm records the role; Back returns to the tiles. */
  #drawRoleConfirm(
    rect: Rect,
    top: number,
    header: SeatHeaderView,
    view: RoleCallView,
    tile: RoleTileView,
    stops: Map<string, FocusStop>,
  ): void {
    const confirm = roleConfirmOf(tile, header.heroName);
    const phone = rect.width < 560;
    let y = top;
    const boxPad = 14;
    const inner = rect.width - boxPad * 2;
    const title = this.add
      .text(
        rect.x + boxPad,
        y + boxPad,
        confirm.title.toUpperCase(),
        textStyle(bangers(phone ? 24 : 28), surface.ink.hex),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(inner);
    let cursor = y + boxPad + title.height + 8;
    this.#drawAspectChips(rect.x + boxPad, cursor, tile);
    cursor += 18 + 10;
    const summary = this.add
      .text(rect.x + boxPad, cursor, tile.summary, textStyle(typeRole.emphasis, surface.ink.hex))
      .setOrigin(0, 0)
      .setWordWrapWidth(inner);
    cursor += summary.height + 4;
    const relation = this.add
      .text(rect.x + boxPad, cursor, confirm.tile.relation, textStyle(typeRole.label, surface.ink.hex, ink.secondary))
      .setOrigin(0, 0)
      .setWordWrapWidth(inner);
    cursor += relation.height + 10;
    const detail = this.add
      .text(
        rect.x + boxPad,
        cursor,
        `${ROLE_EXPLAINER.upgrades}\n${ROLE_EXPLAINER.building}\nThis is recorded in the campaign log.`,
        { ...textStyle(typeRole.body, surface.ink.hex, ink.secondary), fontSize: phone ? "10px" : "11px" },
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(inner)
      .setLineSpacing(4);
    cursor += detail.height + boxPad;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, y, rect.width, cursor - y);
    y = cursor + 12;
    const buttonWidth = Math.min(180, Math.floor((rect.width - 12) / 2));
    const backRect: Rect = { x: rect.x, y, width: buttonWidth, height: 48 };
    const confirmRect: Rect = { x: rect.x + buttonWidth + 12, y, width: buttonWidth, height: 48 };
    const back = (): void => {
      this.#roleState = backFromRole();
      this.#draw();
    };
    const accept = (): void => {
      const role = confirmedRole(this.#roleState, view);
      if (role !== null) this.#answer([role]);
    };
    this.#buttons.push(
      new McButton(this, { kind: "secondary", label: "Back", type: typeRole.label, rect: backRect, onClick: back }),
      new McButton(this, {
        kind: "primary",
        label: "Confirm",
        type: typeRole.label,
        rect: confirmRect,
        onClick: accept,
      }),
    );
    stops.set("role-back", { rect: backRect, activate: back });
    stops.set("role-confirm", { rect: confirmRect, activate: accept });
  }

  /** "Edit which deck?": one button per seat, over a scrim that takes every press so nothing behind it moves. */
  #drawSeatPicker(record: CampaignRecord, width: number, height: number, stops: Map<string, FocusStop>): void {
    const depth = 100;
    const close = (): void => {
      this.#seatPicker = false;
      this.#draw();
    };
    this.add
      .rectangle(0, 0, width, height, 0x000000, 0.55)
      .setOrigin(0, 0)
      .setDepth(depth)
      .setInteractive()
      .on(Phaser.Input.Events.POINTER_UP, close);
    const panelWidth = Math.min(420, width - 32);
    const rowHeight = 56;
    const panelHeight = 72 + (record.seats.length + 1) * (rowHeight + 10);
    const x = (width - panelWidth) / 2;
    const y = Math.max(16, (height - panelHeight) / 2);
    const panel = this.add
      .rectangle(x, y, panelWidth, panelHeight, surface.paper.hex)
      .setOrigin(0, 0)
      .setDepth(depth + 1);
    panel.setStrokeStyle(2, surface.ink.hex, 1).setInteractive();
    this.add
      .text(x + 16, y + 16, "EDIT WHICH DECK?", textStyle(bangers(22), surface.ink.hex))
      .setOrigin(0, 0)
      .setDepth(depth + 2);
    stops.clear();
    const entries = [
      ...record.seats.map((seat) => ({
        key: `pick-seat-${seat.seatNumber}`,
        text: `${cardName(seat.identityCardId as string)} · seat ${seat.seatNumber}`,
        run: (): void => void this.#editDecks(seat.seatNumber),
      })),
      { key: "pick-cancel", text: "Cancel", run: close },
    ];
    entries.forEach((entry, index) => {
      const rect: Rect = { x: x + 16, y: y + 60 + index * (rowHeight + 10), width: panelWidth - 32, height: rowHeight };
      const button = new McButton(this, {
        kind: index === entries.length - 1 ? "secondary" : "primary",
        label: entry.text,
        type: typeRole.label,
        rect,
        onClick: entry.run,
      });
      button.container.setDepth(depth + 2);
      this.#buttons.push(button);
      stops.set(entry.key, { rect, activate: entry.run });
    });
  }

  /** Draws the Decks panel and returns its bottom edge. */
  #drawDecks(rect: Rect, view: BriefingView | null, stops: Map<string, FocusStop>): number {
    let y = ruleHeading(this, rect.x, rect.y, rect.width, "Decks", surface.ink.hex, 20);
    if (!view) {
      return y + this.#drawWaiting(rect.x, y, rect.width, "decks");
    }
    const baseHeight = 44;
    // A row naming a problem wraps it under the hero, so the row grows by a line instead of cutting the reason.
    const heights = view.decks.map((row) => (row.problem ? baseHeight + 22 : baseHeight));
    const total = heights.reduce((sum, h) => sum + h, 0);
    const listTop = y;
    const g = this.add.graphics();
    g.lineStyle(2, surface.ink.hex, 1).strokeRect(rect.x, listTop, rect.width, total);
    let rowY = listTop;
    view.decks.forEach((row, index) => {
      const rowHeight = heights[index] as number;
      const top = rowY;
      rowY += rowHeight;
      if (index > 0) g.lineStyle(1, surface.ink.hex, 0.2).lineBetween(rect.x, top, rect.x + rect.width, top);
      if (row.problem)
        g.fillStyle(accent.heroRed.hex, 0.1).fillRect(rect.x + 1, top + 1, rect.width - 2, rowHeight - 2);
      const nameY = row.problem ? top + 22 : top + rowHeight / 2;
      const title = this.add
        .text(
          rect.x + 12,
          nameY,
          `${row.heroName.toUpperCase()} · ${row.aspectLabel}`,
          textStyle(bangers(16), surface.ink.hex),
        )
        .setOrigin(0, 0.5);
      fitText(title, rect.width * 0.55, 16);
      const countText = row.pinnedCount > 0 ? `${row.deckSize} + ${row.pinnedCount} pinned` : `${row.deckSize}`;
      this.add
        .text(
          rect.x + rect.width - 36,
          nameY,
          countText,
          textStyle({ ...typeRole.rowTitle, size: 14 }, surface.ink.hex),
        )
        .setOrigin(1, 0.5);
      // The way into this seat's own deck, on every row: "Edit ▸" says the row is a button.
      this.add
        .text(rect.x + rect.width - 12, nameY, "▸", textStyle({ ...typeRole.rowTitle, size: 18 }, surface.ink.hex))
        .setOrigin(1, 0.5);
      if (row.problem) {
        // Words as well as the red wash: the mark is a "!" in a shape-bearing label, never color alone.
        this.add
          .text(
            rect.x + 12,
            top + 36,
            `! ${row.problem}`,
            textStyle({ ...typeRole.label, size: 14 }, accent.heroRed.hex, 1),
          )
          .setOrigin(0, 0)
          .setWordWrapWidth(rect.width - 24);
      }
      const open = (): void => void this.#editDecks(row.seatNumber);
      const zone = this.add
        .zone(rect.x, top, rect.width, rowHeight)
        .setOrigin(0, 0)
        .setInteractive({ useHandCursor: true });
      zone.on(Phaser.Input.Events.POINTER_UP, open);
      stops.set(`deck-seat-${row.seatNumber}`, {
        rect: { x: rect.x, y: top, width: rect.width, height: rowHeight },
        activate: open,
      });
    });
    y = listTop + total + 12;
    const note = this.add
      .text(
        rect.x,
        y,
        view?.deckNote ?? DECK_NOTE_EXEMPT,
        // No letter spacing: Phaser measures a wrap line without it, so spaced text ran past the panel's edge.
        textStyle({ ...typeRole.label, letterSpacing: 0 }, surface.ink.hex, ink.label),
      )
      .setOrigin(0, 0)
      .setWordWrapWidth(rect.width);
    return y + note.height;
  }
}
