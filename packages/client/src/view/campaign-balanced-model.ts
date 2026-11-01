/**
 * The Balanced house rule's prompt (issue #609): what `scenes/campaign/balanced.ts` shows when a Galaxy's Most Wanted
 * campaign is started, and the choice it carries to the Roster. Pure and Vitest-tested.
 *
 * Normal plays the cards exactly as printed and is the default. Rebalance is a fan-made house rule (not an official
 * ruling) that eases the Museum, Nebula and Ronan scenarios, with four optional toggles that put some challenge back.
 * The choice is made once, at signing, and stored on the run (`CampaignModeRef.balanced`, plus the toggles as hidden
 * log fields): this screen is never reached from a Resume.
 */
import type { PlayModes } from "@mc/content";
import { GMW_BALANCED_TOGGLES, type GmwBalancedToggleId } from "@mc/cards";

/** The one campaign with a Balanced version. */
export const BALANCED_CAMPAIGN_ID = "gmw";

/** The source of the fixes, credited on the prompt and linked for more detail. */
export const BALANCED_CREDIT = {
  line: "Based on fixes by Gideon's Gaming",
  linkLabel: "Read the full write-up",
  url: "https://gideonsgaming.com/marvel-champions-fixing-galaxys-most-wanted/",
} as const;

/** True when starting `campaignId` asks Normal or Rebalance first. */
export const hasBalancedPrompt = (campaignId: string): boolean => campaignId === BALANCED_CAMPAIGN_ID;

/** What the prompt is holding: the mode, and the toggles chosen (kept while Normal is picked, but not carried). */
export interface BalancedChoice {
  readonly balanced: boolean;
  readonly toggles: readonly GmwBalancedToggleId[];
}

/** The default: the cards as printed. */
export const NORMAL_CHOICE: BalancedChoice = { balanced: false, toggles: [] };

export const withBalanced = (choice: BalancedChoice, balanced: boolean): BalancedChoice => ({ ...choice, balanced });

export const isToggleOn = (choice: BalancedChoice, id: GmwBalancedToggleId): boolean => choice.toggles.includes(id);

/** Flips one toggle; the order of `toggles` follows the screen's list, so equal choices compare equal. */
export function withToggle(choice: BalancedChoice, id: GmwBalancedToggleId): BalancedChoice {
  const on = new Set(choice.toggles);
  if (on.has(id)) on.delete(id);
  else on.add(id);
  return { ...choice, toggles: GMW_BALANCED_TOGGLES.map((toggle) => toggle.id).filter((each) => on.has(each)) };
}

/** What the Roster is started with and what `StartCampaignInput.balanced` is: undefined for Normal. */
export const balancedStartOf = (
  choice: BalancedChoice,
): { readonly toggles: readonly GmwBalancedToggleId[] } | undefined =>
  choice.balanced ? { toggles: choice.toggles } : undefined;

/** The small marker a run wears where Expert is shown, or null for a run that is not Balanced. */
export const balancedTagOf = (modes: PlayModes | undefined): string | null =>
  modes?.campaign?.balanced === true ? "Balanced" : null;

export interface BalancedToggleRow {
  readonly id: GmwBalancedToggleId;
  readonly label: string;
  /** One line on the extra challenge it puts back. */
  readonly detail: string;
  readonly on: boolean;
}

export interface BalancedChangeGroup {
  readonly heading: string;
  readonly lines: readonly string[];
}

export interface BalancedScreen {
  readonly title: string;
  readonly heading: string;
  readonly why: string;
  readonly unofficial: string;
  readonly cost: string;
  readonly normal: { readonly title: string; readonly detail: string; readonly selected: boolean };
  readonly rebalance: { readonly title: string; readonly detail: string; readonly selected: boolean };
  readonly togglesHeading: string;
  readonly togglesNote: string;
  readonly toggles: readonly BalancedToggleRow[];
  readonly credit: typeof BALANCED_CREDIT;
  readonly cta: string;
}

const CHANGES: readonly BalancedChangeGroup[] = [
  {
    heading: "The Museum",
    lines: [
      "Encounter cards no longer enter The Collection through Collector's redirect.",
      "Three optional extras below can put some of its challenge back.",
    ],
  },
  {
    heading: "Nebula",
    lines: [
      "3 or more damage from one attack removes an evasion counter, once per round.",
      "Solo, The Art of Evasion breaks at 12.",
    ],
  },
  {
    heading: "Ronan",
    lines: [
      "No Kree Command Ship, and no starting threat.",
      "Universal Weapon starts in the deck, and threat comes in more slowly.",
      "The Milano Mods come free at setup.",
    ],
  },
];

/** The hard scenarios as printed, for the pane beside Play as normal. */
const HARD_SPOTS: readonly BalancedChangeGroup[] = [
  { heading: "The Museum", lines: ["Cards lost to The Collection can swing the whole scenario."] },
  { heading: "Nebula", lines: ["Her evasion counters can be close to impossible to strip with a small team."] },
  { heading: "Ronan", lines: ["The threat and the hazard build faster than few heroes can answer."] },
];

/** What the side pane says for the option picked; it follows the selection. */
export interface BalancedPane {
  readonly heading: string;
  readonly intro: string;
  readonly groupsHeading: string;
  readonly groups: readonly BalancedChangeGroup[];
  readonly footnote: string;
  /** Rebalance only: the optional challenge toggles sit under the changes. */
  readonly showToggles: boolean;
}

export function balancedPaneOf(choice: BalancedChoice): BalancedPane {
  if (choice.balanced) {
    return {
      heading: "Rebalance the campaign",
      intro: "A fan-made house rule that eases the three scenarios people find hardest. These changes are always on.",
      groupsHeading: "What changes",
      groups: CHANGES,
      footnote: "It earns the same points and achievements as Normal, plus The Galaxy Is Unfair.",
      showToggles: true,
    };
  }
  return {
    heading: "Play as normal",
    intro: "The cards exactly as written. Nothing is changed, and nothing is held back.",
    groupsHeading: "The three that bite",
    groups: HARD_SPOTS,
    footnote: "It earns full points and achievements.",
    showToggles: false,
  };
}

export function balancedScreenOf(choice: BalancedChoice, expert: boolean): BalancedScreen {
  return {
    title: expert ? "How to play · Expert" : "How to play",
    heading: "How do you want to play this campaign?",
    why:
      "The Museum, Nebula and Ronan scenarios in this campaign are known to be very swingy or punishing at low player " +
      "counts. This fan-made house rule makes those three winnable, while Normal stays exactly as printed.",
    unofficial: "It is unofficial. You choose once, and it is locked for the whole run.",
    cost: "It costs nothing: you earn full points and achievements.",
    normal: {
      title: "Play as normal",
      detail: "The cards exactly as written.",
      selected: !choice.balanced,
    },
    rebalance: {
      title: "Rebalance the campaign",
      detail: "Eases the Museum, Nebula and Ronan scenarios.",
      selected: choice.balanced,
    },
    togglesHeading: "Optional extra challenge",
    togglesNote: "Each is off to begin with. Turn on any you want back.",
    toggles: GMW_BALANCED_TOGGLES.map((toggle) => ({
      id: toggle.id,
      label: toggle.label,
      detail: toggle.description,
      on: isToggleOn(choice, toggle.id),
    })),
    credit: BALANCED_CREDIT,
    cta: expert ? "Continue to the roster · Expert" : "Continue to the roster",
  };
}

/** Focus order for the screen: Back, the two modes, the credit, each toggle (Rebalance only), then Continue. */
export function balancedStopOrder(choice: BalancedChoice): readonly string[] {
  return [
    "back",
    "mode-normal",
    "mode-rebalance",
    "credit",
    ...(choice.balanced ? GMW_BALANCED_TOGGLES.map((toggle) => `toggle-${toggle.id}`) : []),
    "cta",
  ];
}
