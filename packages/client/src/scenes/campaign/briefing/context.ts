
/**
 * What the Briefing scene and the models that feed its page share: the scene state, and the stops the pad treats as the screen one
 * forward button. The page itself is one element (`views/briefing/mc-briefing-page`); the scene is the thin owner of the panel, the
 * focus route, hover, compose, answer, open and navigation, and builds the page model from this state (`page-model.ts`).
 */
import type { CampaignChoiceAnswer, CampaignDefinition, CampaignPendingChoice } from "@mc/engine";
import type { IssueStory } from "../../../campaign/story.js";
import type { CampaignRecord } from "../../../engine/campaign-storage.js";
import type { CampaignBriefingData } from "../routes.js";

/** The stops Start (and A with nothing focused) takes, best first: a confirm, or the issue Open button. */
export const FORWARD_STOPS: readonly string[] = ["rb-confirm", "role-confirm", "call-confirm", "open"];

export interface BriefingState {
  data: CampaignBriefingData;
  record: CampaignRecord | null;
  story: IssueStory | null;
  definition: CampaignDefinition | null;
  nodeIds: readonly string[];
  issueNumber: number;
  /**
   * The issue the run was on when this screen opened: null for a `choice` graph (Fear No Evil) still to pick one. The
   * pick settles the issue mid-Briefing, after the opener would have played, so its comic plays then.
   */
  nodeAtLoad: string | null;
  /** True when this issue game is already on the table: the CTA continues it instead of opening a new one. */
  inProgress: boolean;
  /** The current unanswered question; nothing half-answered is ever shown as settled. */
  pending: CampaignPendingChoice | null;
  /** The answers accumulated across re-entries of `compose`. */
  answers: CampaignChoiceAnswer[];
  composing: boolean;
  starting: boolean;
  /** The easier-start / mode toggle is being saved: Open waits, so the issue never opens on the pre-toggle record. */
  toggling: boolean;
  /** "Let people watch this game" (#876): starts from the Always allow setting; sent on the config at Open issue. */
  watchable: boolean;
  startError: string | null;
  /** The "which deck?" chooser EDIT DECKS opens when several seats could be meant and none is the problem. */
  seatPicker: boolean;
  /** The seats whose deck setup would refuse, computed once per composed attempt. */
  deckProblemsFor: { readonly key: unknown; readonly problems: ReadonlyMap<number, string> } | null;
}

/** A fresh state for a visit to the screen. */
export function newBriefingState(data: CampaignBriefingData, watchable: boolean): BriefingState {
  return {
    data,
    record: null,
    story: null,
    definition: null,
    nodeIds: [],
    issueNumber: 1,
    nodeAtLoad: null,
    inProgress: false,
    pending: null,
    answers: data.answers ? [...data.answers] : [],
    composing: false,
    starting: false,
    toggling: false,
    watchable,
    startError: null,
    seatPicker: false,
    deckProblemsFor: null,
  };
}
