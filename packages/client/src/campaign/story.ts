/**
 * The comic a campaign is told as (`Marvel Champions game screens/Campaign - *.dc.html`): each scenario is an
 * *issue* with a title, an opener, lines for the villain's stage flips, a narrator for the aftermath and a finale.
 *
 * **Flavor only.** Nothing here is a rule: every mechanical word the screens show (what a TECH upgrade does, how many
 * delay counters were logged, what a loss costs) comes from the `CampaignDefinition`, the log and the card data.
 * A story that is missing a line never blocks play — every lookup here has a plain fallback.
 *
 * **Hero lines degrade to narration.** The box's own heroes get written dialogue ("these two ship in the box, so
 * their beats are written for them"); a line whose hero is not on the roster is shown as a narrator caption with
 * its `fallback` text instead, so any roster gets the same beats.
 */
import { TRORS_STORY } from "./stories/trors.js";
import { GMW_STORY } from "./stories/gmw.js";

export type StorySpeaker =
  | { readonly kind: "narrator" }
  /** The issue's villain. */
  | { readonly kind: "villain" }
  /** A hero by identity card id (the `a` face), shown only when that hero signed the roster. */
  | { readonly kind: "hero"; readonly identityId: string; readonly name: string }
  /** A supporting voice with a printed role ("S.H.I.E.L.D. quartermaster"). */
  | { readonly kind: "npc"; readonly name: string };

export interface StoryLine {
  readonly speaker: StorySpeaker;
  readonly text: string;
  /** For a hero line: the narrator caption used when that hero is not on the roster. Omit to drop the line. */
  readonly fallback?: string;
}

/**
 * What a comic panel shows. A `note` is the design's "Panel art: …" placeholder, kept until the art exists. An
 * `artboard` is a picture from `art/campaigns/<campaignId>/artboards/<name>.*` (`art/campaign-art.ts`), and shows
 * `text` as that same placeholder until the file is added.
 */
export type PanelArt =
  | { readonly kind: "villain" }
  | { readonly kind: "hero"; readonly identityId: string }
  | { readonly kind: "note"; readonly text: string }
  | {
      readonly kind: "artboard";
      readonly name: string;
      readonly text: string;
      /**
       * Where a cropped panel keeps its focus (0 top/left to 1 bottom/right; defaults 0.4 and 0.5), so panels that
       * share one picture can each show the part their caption names.
       */
      readonly focusY?: number;
      readonly focusX?: number;
    };

export interface StoryPanel {
  readonly art: PanelArt;
  /** The yellow caption box. */
  readonly caption?: string;
  readonly lines: readonly StoryLine[];
  /** A sound effect lettered across the panel ("KRA-KOOM!"). */
  readonly sfx?: string;
}

/**
 * A panel's outline on its page, in that page's own pixel coordinates (top-left origin, matching the image file).
 * A slanted panel may give its bounding box here instead — real games' comic pages skew panels for energy, and a
 * rectangle that contains the whole panel still lights the right area, just not flush to its printed border.
 */
export interface ComicPanelRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** One beat of a page-based issue (`art/README.md`'s "comic reader"): a panel, its caption/lines/SFX. */
export interface ComicBeat {
  readonly panel: ComicPanelRect;
  readonly caption?: string;
  readonly lines: readonly StoryLine[];
  readonly sfx?: string;
}

/**
 * A full comic page (`art/campaigns/<campaignId>/pages/<file>.<ext>`), read panel by panel by the comic reader.
 * `width`/`height` are the source image's own pixel dimensions — every beat's `panel` rect is measured against
 * them, so the reader can scale to any screen size without re-deriving the art's own layout.
 */
export interface ComicPage {
  /** The file's name without its number/extension prefix stripped — `"01-badoon"` for `pages/01-badoon.jpg`. */
  readonly file: string;
  readonly width: number;
  readonly height: number;
  /** In reading order. */
  readonly beats: readonly ComicBeat[];
}

/** Points an issue at one beat of one page, in the order the issue's guided read shows them. */
export interface ComicBeatRef {
  readonly page: string;
  readonly beatIndex: number;
}

export interface IssueStory {
  /** `CampaignNode.id`. */
  readonly nodeId: string;
  readonly title: string;
  /** The villain's display name as the issue is billed ("Taskmaster"). */
  readonly villain: string;
  /** The Run's one-sentence pitch for an issue up next. */
  readonly blurb: string;
  /** Issue detail's recap caption, once the issue is finished. */
  readonly recap: string;
  /** Tapped through one at a time on the issue opener (C03). Three panels in the design. Unused when `comicBeats` is set. */
  readonly opener: readonly StoryPanel[];
  /**
   * For a page-based box (`CampaignStory.pages` is set): this issue's guided read, in order. When present, the
   * issue opener uses the comic reader over these beats instead of the three-panel `opener` above.
   */
  readonly comicBeats?: readonly ComicBeatRef[];
  /** The villain's line when it flips to a stage (C04), by stage number (2 = stage II). */
  readonly stageLines: Readonly<Record<number, string>>;
  /** A short rule reminder shown under the stage-flip splash ("Piercing while armed"). */
  readonly stageNotes?: Readonly<Record<number, string>>;
  /** The Briefing's opening line, spoken by a roster hero where possible. */
  readonly briefing: StoryLine;
  /** Who hands out this issue's rewards on a win (C05/C06). */
  readonly aftermath?: StoryLine;
  /** The aftermath art note while there is no panel art. */
  readonly aftermathArt?: PanelArt;
  /** The villain's taunt on a loss (C09). */
  readonly rewindTaunt: string;
  /** The Run card's speech bubble while the issue is up next. */
  readonly teaser: string;
}

export interface CampaignStory {
  readonly campaignId: string;
  /** "A story in five issues". */
  readonly tagline: string;
  /** The cover's pitch. */
  readonly blurb: string;
  /** The roster screen's banner. */
  readonly rosterBanner: string;
  /** Identity ids whose beats are written for them (the box's own heroes). */
  readonly castIdentityIds: readonly string[];
  readonly issues: readonly IssueStory[];
  /** Set only for a box told as comic pages (`art/README.md`); its issues' `comicBeats` index into this. */
  readonly pages?: readonly ComicPage[];
  readonly finale: {
    readonly caption: string;
    readonly headline: string;
    readonly sfx: string;
    readonly villainLine: string;
    /** One line per roster seat, in seat order; extra seats reuse the last. */
    readonly heroLines: readonly string[];
  };
}

/** A volume on The Saga shelf: every campaign box in release order, playable or not. */
export interface SagaVolume {
  readonly number: number;
  readonly campaignId: string;
  readonly boxCode: string;
  readonly name: string;
}

/**
 * The nine campaign boxes in release order (PLAN.md C3). Civil War (MC56) is not one: "the Civil War expansion
 * does not include five interconnected scenarios and a campaign mode" (MC56 p. 3).
 */
export const SAGA_VOLUMES: readonly SagaVolume[] = [
  { number: 1, campaignId: "trors", boxCode: "MC10", name: "The Rise of Red Skull" },
  { number: 2, campaignId: "gmw", boxCode: "MC16", name: "Galaxy's Most Wanted" },
  { number: 3, campaignId: "mts", boxCode: "MC21", name: "The Mad Titan's Shadow" },
  { number: 4, campaignId: "sm", boxCode: "MC27", name: "Sinister Motives" },
  { number: 5, campaignId: "mut_gen", boxCode: "MC32", name: "Mutant Genesis" },
  { number: 6, campaignId: "next_evol", boxCode: "MC40", name: "NeXt Evolution" },
  { number: 7, campaignId: "aoa", boxCode: "MC45", name: "Age of Apocalypse" },
  { number: 8, campaignId: "aos", boxCode: "MC50", name: "Agents of S.H.I.E.L.D." },
  { number: 9, campaignId: "fne", boxCode: "MC60", name: "Fear No Evil" },
];

// Matches the current design canvas (`Marvel Champions game screens/Campaign - *.dc.html`'s `saga()`), the
// sequential-unlock wording — this client has no "every volume open" mode for the other branch to apply to.
export const SAGA_NOTE =
  "Win a volume on Standard to open the next. Finished volumes can be reread or started again. Civil War (MC56) is competitive only, so it has no campaign.";

/** Every box's story, by `Campaign.id`. Adding a box's story is one entry. */
const STORIES: Readonly<Record<string, CampaignStory>> = {
  [TRORS_STORY.campaignId]: TRORS_STORY,
  [GMW_STORY.campaignId]: GMW_STORY,
};

export const storyFor = (campaignId: string): CampaignStory | undefined => STORIES[campaignId];

/** The issue story for a node, or null — every caller has a plain fallback built from the definition. */
export function issueStoryFor(campaignId: string, nodeId: string): IssueStory | null {
  return storyFor(campaignId)?.issues.find((issue) => issue.nodeId === nodeId) ?? null;
}

/**
 * A line as it should be shown to this roster: the line itself, its narrator fallback when the hero is absent, or
 * null when there is neither.
 */
export function lineForRoster(
  line: StoryLine,
  rosterIdentityIds: readonly string[],
): { readonly speaker: StorySpeaker; readonly text: string } | null {
  if (line.speaker.kind !== "hero" || rosterIdentityIds.includes(line.speaker.identityId)) return line;
  return line.fallback ? { speaker: { kind: "narrator" }, text: line.fallback } : null;
}

/** "Issue #3" numbering is a node's 1-based position in the definition's own node order. */
export const issueNumberOf = (nodeIds: readonly string[], nodeId: string): number => nodeIds.indexOf(nodeId) + 1;
