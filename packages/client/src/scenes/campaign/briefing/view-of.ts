
/**
 * The composed attempt BriefingView for the page: the model own view, with the modular-set picks row first in
 * "Handled for you" so the answer does not disappear once the call is gone.
 */
import { CAMPAIGNS as CONTENT_CAMPAIGNS } from "@mc/content";
import { briefingNotesIn } from "../../../campaign/briefing-text.js";
import { storyFor } from "../../../campaign/story.js";
import { campaignCardsById } from "../../../content/campaign-pool.js";
import type { CampaignRecord } from "../../../engine/campaign-storage.js";
import { tPlural } from "../../../i18n/translate.js";
import { briefingViewOf, type BriefingView } from "../../../view/campaign-briefing-model.js";
import { modularPicksRowOf, modularSetIdsWithout } from "../../../view/campaign-modular-call-model.js";
import { cardCountForSet, descriptorForSet } from "../../../view/modular-sets.js";
import type { BriefingState } from "./context.js";
import { ENCOUNTER_SET_NAMES, KNOWN_ENCOUNTER_SET_IDS, cardNameOf, cardTypeOf } from "./names.js";

/** Null until an issue is composed (the model needs an attempt). */
export function briefingViewFor(
  state: BriefingState,
  deckProblems: (record: CampaignRecord) => ReadonlyMap<number, string>,
): BriefingView | null {
  const { record, definition, nodeIds, issueNumber, story } = state;
  if (!record?.attempt) return null;
  const campaignStory = storyFor(record.campaignId as string);
  const first = record.seats.find((seat) => seat.seatNumber === 1) ?? record.seats[0];
  const base = briefingViewOf(
    record,
    cardNameOf,
    issueNumber,
    definition ?? undefined,
    nodeIds,
    cardTypeOf,
    campaignStory?.poolCopy,
    first ? cardNameOf(first.identityCardId as string) : undefined,
    briefingNotesIn(record.campaignId as string, record.attempt.nodeId, story?.briefingNotes),
    deckProblems(record),
  );
  if (!base) return null;
  const boxRoles = CONTENT_CAMPAIGNS.find(
    (campaign) => (campaign.id as string) === (record.campaignId as string),
  )?.roles;
  const picks = modularPicksRowOf(
    record.attempt.steps,
    modularSetIdsWithout(KNOWN_ENCOUNTER_SET_IDS, boxRoles),
    (id) => ({
      name: ENCOUNTER_SET_NAMES.get(id) ?? id,
      detail: [
        tPlural("briefing.setCards", cardCountForSet(id, campaignCardsById())),
        descriptorForSet(id, campaignCardsById())?.toLowerCase(),
      ]
        .filter(Boolean)
        .join(" · "),
    }),
  );
  return picks ? { ...base, handled: [picks, ...base.handled] } : base;
}
