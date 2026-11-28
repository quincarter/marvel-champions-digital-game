
/**
 * The chrome of the Briefing page as models: the ink top bar, the art faded across the page, the ink action bar with the reason Open
 * waits and the watch toggle, the phone strip, and the "which deck?" chooser. Nothing is judged here: `deckProblems` is the engine own
 * verdict on whether a deck setup would refuse.
 */
import type Phaser from "phaser";
import type { HintGlyph } from "@mc/ui";
import { CAMPAIGN_RECORDS } from "../../../campaign/campaign-service.js";
import type { ActionBarModel } from "../../../components/briefing/mc-briefing-action-bar/mc-briefing-action-bar.types.js";
import type { SeatPickerModel } from "../../../components/briefing/mc-briefing-seat-picker/mc-briefing-seat-picker.types.js";
import type { PictureLeases } from "../../../dom/picture-leases.js";
import type { CampaignRecord } from "../../../engine/campaign-storage.js";
import { t } from "../../../i18n/translate.js";
import { appSession } from "../../../session.js";
import { hit } from "../../../tokens.js";
import { campaignCoverPicture, estimateBangersWidth, sheetThemeFor, villainPicture } from "../../../ui/campaign-chrome.js";
import { cssOf } from "../../../ui/theme.js";
import { balancedTagOf } from "../../../view/campaign-balanced-model.js";
import { campaignFadeFillOf } from "../../../view/campaign-fade-color.js";
import { hiddenEvidenceEnvelope } from "../../../view/campaign-hidden-evidence-model.js";
import type {
  BriefingArtModel,
  BriefingPageModel,
  BriefingTopBarModel,
} from "../../../views/briefing/mc-briefing-page/mc-briefing-page.types.js";
import type { BriefingState } from "./context.js";
import { briefingTextIn, hiddenMarkerIn, openHintIn } from "./copy.js";
import { cardNameOf } from "./names.js";
import { sourcePicture } from "./pictures.js";

/** The line the bar gives for why Open waits: a deck setup would refuse (outranks), or a call / composing hint. Null when none. */
function reasonOf(state: BriefingState, deckProblems: ReadonlyMap<number, string>): string | null {
  const record = state.record;
  if (!record) return null;
  const blockedSeat = [...deckProblems.keys()][0];
  if (!!record.attempt && blockedSeat !== undefined) {
    const seat = record.seats.find((candidate) => candidate.seatNumber === blockedSeat);
    const who = seat ? cardNameOf(seat.identityCardId as string) : t("briefing.seatFallback", { number: blockedSeat });
    const reason = t("briefing.deckProblem", {
      who,
      problem: briefingTextIn().deckProblem(deckProblems.get(blockedSeat) as string),
    });
    return `! ${reason}`;
  }
  const hint = openHintIn({
    issueNumber: state.issueNumber,
    pending: !!state.pending,
    composing: state.composing,
    starting: state.starting,
    deckBlocked: false,
  });
  return hint ? hint.bar : null;
}

/** The ink bar, the phone strip and the error line. */
export function bottomModelOf(
  state: BriefingState,
  record: CampaignRecord,
  deckProblems: ReadonlyMap<number, string>,
  openGlyph: HintGlyph | null,
  phone: boolean,
): Pick<BriefingPageModel, "actionBar" | "strip" | "error"> {
  const blocked = !!record.attempt && deckProblems.size > 0;
  const canOpen =
    !!record.attempt && !state.pending && !state.composing && !state.starting && !state.toggling && !blocked;
  const label = state.starting
    ? t("briefing.opening")
    : blocked
      ? t("briefing.fixDeck")
      : t(state.inProgress ? "briefing.continue" : "briefing.open", { number: state.issueNumber });
  const reason = reasonOf(state, deckProblems);
  // Right where the problem and hint lines go, so only one of them shows at a time: a problem outranks the toggle. Not for an issue
  // already on the table: its save keeps the choice it was dealt with, so the toggle would be ignored.
  const watch =
    reason === null && !state.seatPicker && !state.inProgress
      ? { label: t("live.setup.title"), on: state.watchable }
      : null;
  const actionBar: ActionBarModel = {
    editLabel: t(phone ? "briefing.edit.phone" : "briefing.edit").toLocaleUpperCase(),
    openLabel: label.toLocaleUpperCase(),
    canOpen,
    openGlyph,
    reason,
    watch,
  };
  return {
    actionBar,
    strip: reason !== null ? { reason, watch: null } : watch ? { reason: "", watch } : null,
    error: state.startError,
  };
}

/** "Edit which deck?": one button per seat, over everything. Null while closed. */
export function seatPickerOf(state: BriefingState, record: CampaignRecord): SeatPickerModel | null {
  if (!state.seatPicker) return null;
  return {
    title: t("briefing.picker.title"),
    seats: record.seats.map((seat) => ({
      seat: seat.seatNumber,
      label: t("briefing.picker.seat", { name: cardNameOf(seat.identityCardId as string), number: seat.seatNumber }),
    })),
    cancel: t("briefing.picker.cancel"),
  };
}

/** The box art faded across the page (unless the setting is off) and the colour the side pane fades into. */
export function artOf(record: CampaignRecord, leases: PictureLeases): BriefingArtModel {
  const settings = appSession().settings;
  const campaignId = record.campaignId as string;
  const finale = CAMPAIGN_RECORDS[campaignId]?.scenarioIds.at(-1) as string | undefined;
  const picture = campaignCoverPicture(campaignId) ?? (finale ? villainPicture(finale) : null);
  return {
    picture: settings.fadedCampaignArt ? sourcePicture(leases, picture, { x: 0.5, y: 0.2 }) : null,
    paneGround: cssOf(campaignFadeFillOf(settings.campaignFadeColor)),
  };
}

/** The ink bar: Back, the title (with the campaign modes after it) and the hidden-evidence marker. */
export function topBarOf(
  scene: Phaser.Scene,
  state: BriefingState,
  record: CampaignRecord,
  frame: { readonly width: number; readonly phone: boolean; readonly topBar: number },
  backGlyph: HintGlyph | null,
): BriefingTopBarModel {
  const hidden = state.definition ? hiddenEvidenceEnvelope(record, state.definition, cardNameOf) : null;
  const modes = [
    ...(record.modes.campaign?.expertCampaign ? [t("roster.mode.expert")] : []),
    ...(balancedTagOf(record.modes) ? [t("campaign.balancedTag")] : []),
  ];
  const title = [t("briefing.title", { number: state.issueNumber }), ...modes].join(" · ").toLocaleUpperCase();
  const right = hidden ? hiddenMarkerIn(hidden, briefingTextIn()).toLocaleUpperCase() : "";
  const backLabel = frame.phone ? "◂" : t("briefing.back");
  // The dark mode tab hangs from the top centre: the title drops under it or ends before it (`sheetThemeFor`).
  const pad = frame.phone ? 12 : 22;
  const backWidth = Math.max(frame.phone ? hit.target : 64, estimateBangersWidth(backLabel, 22) + 26);
  const x = pad + backWidth + 14;
  const rightWidth = right ? right.length * 7.5 + 16 : 0;
  const size = frame.phone ? 22 : 28;
  const room = frame.width - pad - rightWidth - x;
  const clearance = sheetThemeFor(scene, {
    width: frame.width,
    textLeft: x,
    textRight: x + Math.min(room, estimateBangersWidth(title, size)),
    textTop: frame.topBar / 2 - size / 2,
    textHeight: size,
    barHeight: frame.topBar,
  });
  return { backLabel, title, right, backGlyph, titleDrop: clearance.drop, titleMaxRight: clearance.maxRight ?? 0 };
}
