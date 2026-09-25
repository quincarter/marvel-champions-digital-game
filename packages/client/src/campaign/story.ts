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
import { MTS_STORY } from "./stories/mts.js";

export type StorySpeaker =
  | { readonly kind: "narrator" }
  /** The issue's villain. */
  | { readonly kind: "villain" }
  /** A hero by identity card id (the `a` face), shown only when that hero signed the roster. */
  | { readonly kind: "hero"; readonly identityId: string; readonly name: string }
  /** A supporting voice with a printed role ("S.H.I.E.L.D. quartermaster"). */
  | { readonly kind: "npc"; readonly name: string };

/** A point on a comic page, in that page's own pixel coordinates (top-left origin, matching the image file). */
export interface PagePoint {
  readonly x: number;
  readonly y: number;
}

/**
 * Where a comic reader line's bubble sits over the art, for a reading area wide enough to letter over the picture
 * (tablet and desktop): `bubble` is the bubble's centre, in a quiet part of the panel or just past its edge (the
 * bubble may run into the reading area's gutter), and `speaker` where its tail ends — the edge of the speaker's head
 * nearest the bubble. A phone ignores it and stacks bubbles under the panel as before.
 */
export interface BubblePlacement {
  readonly bubble: PagePoint;
  readonly speaker: PagePoint;
}

export interface StoryLine {
  readonly speaker: StorySpeaker;
  readonly text: string;
  /** For a hero line: the narrator caption used when that hero is not on the roster. Omit to drop the line. */
  readonly fallback?: string;
  /** Comic reader only: where this line's bubble sits over the page. See `BubblePlacement`. */
  readonly placement?: BubblePlacement;
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
  /**
   * True for a page that is the box's own official, lettered art (captions and speech balloons already printed
   * into it — The Rise of Red Skull's rulebook pages, copied into `pages/` rather than redrawn unlettered). The
   * reader draws none of its own lettering over a page like this (the printed balloons are the story) and fits
   * each panel into the reading area instead of cover-cropping it, letterboxing where a panel's own aspect ratio
   * doesn't match the screen's — never cropping a panel's own art to fill the frame. Omitted/false keeps the
   * GMW behavior: the reader's own captions/bubbles over a cover-fit, recentered page.
   */
  readonly lettered?: boolean;
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
  /**
   * For a page-based box (`CampaignStory.pages` is set): the Aftermath's (C05) own guided read on a win, tapped
   * through the same way `comicBeats` is before the screen's tags/CTA (`scenes/campaign/aftermath.ts`). Absent
   * (or a box with no `pages`) keeps the plain single-picture Aftermath (MC10) untouched.
   */
  readonly aftermathBeats?: readonly ComicBeatRef[];
  /** The villain's line when it flips to a stage (C04), by stage number (2 = stage II). */
  readonly stageLines: Readonly<Record<number, string>>;
  /** A short rule reminder shown under the stage-flip splash ("Piercing while armed"). */
  readonly stageNotes?: Readonly<Record<number, string>>;
  /**
   * For a page-based box (`CampaignStory.pages` is set): the stage-flip splash (C04) shows this panel of that
   * issue's own page instead of the scenario's villain art, by stage number — the box's guided read already drew
   * this beat once, so the flip reuses the panel that fits rather than falling back to a plain portrait. A stage
   * with no entry here (or a box with no `pages`) keeps the plain villain-picture splash.
   */
  readonly stagePanels?: Readonly<Record<number, ComicBeatRef>>;
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

/**
 * How one of a box's own Finale stat boxes (beyond the universal "Issues") is computed from the finished record
 * (`view/campaign-finale-model.ts`'s `finaleViewOf`). Declared per box because each box's rulebook names and
 * shapes its own numbers differently (MC10's rewind count and rescued allies vs MC16's banked currency and its
 * escalating Headhunter ladder) — the client never branches on `campaignId` to pick these.
 */
export type FinaleStatSpec =
  /** Count of `history` entries lost — the same "Rewinds" MC10 has always shown. */
  | { readonly kind: "rewinds"; readonly label: string }
  /** Sum of a per-seat `cardList` field's length across every seat ("an ally the players kept"). */
  | { readonly kind: "cardListTotal"; readonly label: string; readonly field: string }
  /** Sum of a per-seat `number` field across every seat (a currency's total left unspent). */
  | { readonly kind: "numberTotal"; readonly label: string; readonly field: string }
  /** A `shared` `number` field's own value (an escalating ladder's count). */
  | { readonly kind: "sharedNumber"; readonly label: string; readonly field: string };

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
  /**
   * Rewind's (C09) campaign-lost variant: shown only when a scenario's defeat instructions end the whole campaign
   * outright (MC10's Expert-only Red Skull loss, MC16's Expert Campaign Only Ronan loss) — there is no "REWIND ▸"
   * left for that run, only the way back to the saga. `headline` may carry a `\n` for the two-line stamp the
   * screen renders ("Hydra\nWins.").
   */
  readonly campaignLost: {
    readonly headline: string;
    readonly line: string;
  };
  readonly finale: {
    readonly caption: string;
    readonly headline: string;
    readonly sfx: string;
    readonly villainLine: string;
    /** One line per roster seat, in seat order; extra seats reuse the last. */
    readonly heroLines: readonly string[];
    /**
     * For a page-based box (`pages` set): which page the Finale reads full-bleed instead of the plain villain/hero
     * comic-grid layout (`ComicPage.file`, e.g. `"06-finale"`). Unset (MC10) keeps that grid.
     */
    readonly page?: string;
    /** This box's own extra stat boxes, in display order. Unset keeps `DEFAULT_FINALE_STATS` (MC10's own two). */
    readonly stats?: readonly FinaleStatSpec[];
    /**
     * For a page-based box's spread (`page` set): one `StoryLine` per seat, in seat order — resolved through
     * `crewLineForSeat` exactly like every other hero line in this file (`lineForRoster`'s "not on the roster ⇒
     * narrator fallback" rule), because the spread's single bubble is labeled by name and a bare positional string
     * (`heroLines`) can't say who a character actually is. Some heroes only have one real line at all (Groot's
     * `"I am Groot."`), so this is not the same text as `heroLines` even where the seats line up. Unset falls back
     * to `heroLines` with no name label, which is the MC10 grid's own (unlabeled) behavior.
     */
    readonly crewLines?: readonly StoryLine[];
  };
}

/**
 * `finale.crewLines[seatIndex]` resolved for this roster (`lineForRoster`'s hero/fallback rule), with the last
 * line reused for a seat count longer than the box wrote for (`finaleHeroLineFor`'s own rule, restated here since
 * a `StoryLine` array needs the same clamp `campaign-finale-model.ts`'s plain-string version does).
 */
export function crewLineForSeat(
  crewLines: readonly StoryLine[],
  seatIndex: number,
  rosterIdentityIds: readonly string[],
): { readonly speaker: StorySpeaker; readonly text: string } | null {
  const line = crewLines[Math.min(seatIndex, crewLines.length - 1)];
  return line ? lineForRoster(line, rosterIdentityIds) : null;
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
// sequential-unlock wording, plus the way out of it: Settings ▸ Unlocks opens every volume (`progression/`).
export const SAGA_NOTE =
  "Win a volume on Standard to open the next, or open everything in Settings ▸ Unlocks. Finished volumes can be reread or started again. Civil War (MC56) is competitive only, so it has no campaign.";

/** Every box's story, by `Campaign.id`. Adding a box's story is one entry. */
const STORIES: Readonly<Record<string, CampaignStory>> = {
  [TRORS_STORY.campaignId]: TRORS_STORY,
  [GMW_STORY.campaignId]: GMW_STORY,
  [MTS_STORY.campaignId]: MTS_STORY,
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
