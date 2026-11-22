/**
 * What a tap on a deck in Decks & Collection offers on a phone or tablet (GitHub #958): the deck's options sheet.
 *
 * Those layouts show one pane at a time behind a Decks / Cards / Stats tab strip, and a deck's actions sit on the
 * Stats tab, so a tap that only selected the deck looked like it did nothing. The sheet lists the same actions the
 * desktop's stats rail and community rail already offer, worded the same, with the two panes the tab strip hides.
 * Desktop keeps a click as a plain select: every pane, and so every action, is already on screen there.
 *
 * Plain data, so the order and the wording are tested without Phaser (`scenes/deck-actions-sheet.ts` draws it).
 */
import type { DeckOption } from "./deck-list-model.js";

export type DeckActionId = "play" | "add" | "edit" | "cards" | "stats" | "check" | "duplicate" | "delete";

export interface DeckAction {
  readonly id: DeckActionId;
  readonly label: string;
  /** The one red button: Play, or Add for a community deck. */
  readonly primary: boolean;
  readonly enabled: boolean;
  /** Why it is off, in the player's words, when `enabled` is false. */
  readonly reason?: string;
}

export interface DeckActionsInput {
  readonly option: DeckOption;
  /** Set for a community deck from MarvelCDB: what still locks it (or null), and whether the player already added it. */
  readonly community?: { readonly lock: string | null; readonly added: boolean };
  /** Delete was pressed once: the button now asks for the second press. */
  readonly deleteArmed?: boolean;
}

const NOT_LEGAL = "This deck is not legal.";

export function deckActionsOf(input: DeckActionsInput): readonly DeckAction[] {
  const { option, community } = input;
  const views: readonly DeckAction[] = [
    { id: "cards", label: "View cards", primary: false, enabled: true },
    ...(community ? [] : [{ id: "stats", label: "Stats", primary: false, enabled: true } as const]),
    { id: "check", label: "Check", primary: false, enabled: true },
  ];

  if (community) {
    const canAdd = community.lock === null && option.legal;
    return [
      {
        id: "add",
        label: community.added ? "Add another copy ▸" : "Add to my decks ▸",
        primary: true,
        enabled: canAdd,
        ...(canAdd ? {} : { reason: community.lock ?? option.blockedReason ?? NOT_LEGAL }),
      },
      ...views,
    ];
  }

  // A precon is never changed in place: Edit starts a deck of the player's own from it, and it cannot be deleted.
  const own = option.deck.source.kind !== "precon";
  return [
    {
      id: "play",
      label: "Play this deck ▸",
      primary: true,
      enabled: option.seatable,
      ...(option.seatable ? {} : { reason: option.blockedReason ?? NOT_LEGAL }),
    },
    { id: "edit", label: own ? "Edit" : "Edit a copy", primary: false, enabled: true },
    ...views,
    { id: "duplicate", label: "Duplicate", primary: false, enabled: true },
    ...(own
      ? [
          {
            id: "delete",
            label: input.deleteArmed ? "Confirm delete" : "Delete",
            primary: false,
            enabled: true,
          } as const,
        ]
      : []),
  ];
}

/** How the sheet lays its buttons out at one screen size (`deckActionsPlan`). */
export interface DeckActionsPlan {
  readonly boxWidth: number;
  readonly margin: number;
  readonly columns: number;
  readonly row: number;
  readonly thumb: { readonly width: number; readonly height: number };
  /** Back is one more cell of the grid rather than a full-width row of its own. */
  readonly backInGrid: boolean;
  /**
   * For a short, wide screen (a phone held sideways): the picture, title and status in a column on the left
   * (`sideWidth` wide), the buttons and any notes beside them on the right, rather than stacked under them.
   */
  readonly sideWidth: number | null;
}

/** Where a plan wraps the sheet's text: the header beside (or under) the picture, and the notes. */
export interface DeckActionsTextWidths {
  readonly header: number;
  readonly notes: number;
}

/** The sheet's text as drawn at one plan's widths. */
export interface DeckActionsMeasured {
  /** The header's text column (title, meta, status). */
  readonly header: number;
  /** The warning and the last unavailable press's reason, or 0. */
  readonly notes: number;
}

export const DECK_ACTIONS_PAD = 16;
export const DECK_ACTIONS_GAP = 8;
const CELL_MIN_WIDTH = 104;

/** The text widths a plan gives the header and the notes. */
export function deckActionsTextWidths(plan: DeckActionsPlan): DeckActionsTextWidths {
  const inner = plan.boxWidth - DECK_ACTIONS_PAD * 2;
  if (plan.sideWidth === null) return { header: inner - plan.thumb.width - 12, notes: inner };
  return { header: plan.sideWidth, notes: inner - plan.sideWidth - DECK_ACTIONS_PAD };
}

/** The rows of buttons a plan draws: the red one, the grid, and Back unless it is in the grid. */
export function deckActionsRows(plan: DeckActionsPlan, gridCount: number): number {
  return 1 + Math.ceil((gridCount + (plan.backInGrid ? 1 : 0)) / plan.columns) + (plan.backInGrid ? 0 : 1);
}

/** The sheet's whole height for one plan, with its text measured at that plan's widths. */
export function deckActionsHeight(plan: DeckActionsPlan, gridCount: number, measured: DeckActionsMeasured): number {
  const buttons = deckActionsRows(plan, gridCount) * (plan.row + DECK_ACTIONS_GAP) - DECK_ACTIONS_GAP;
  const notes = measured.notes > 0 ? measured.notes + DECK_ACTIONS_GAP : 0;
  if (plan.sideWidth !== null) {
    // The notes go under the buttons, across the right-hand column.
    const side = plan.thumb.height + DECK_ACTIONS_GAP + measured.header;
    return DECK_ACTIONS_PAD * 2 + Math.max(side, buttons + notes);
  }
  const header = Math.max(plan.thumb.height, measured.header);
  return DECK_ACTIONS_PAD * 3 + header + buttons + notes;
}

/** Every layout the sheet can take at this screen size, roomiest first. */
export function deckActionsCandidates(width: number, height: number): readonly DeckActionsPlan[] {
  const margin = width < 600 || height < 500 ? 12 : 24;
  const thumbOf = (thumbHeight: number) => ({ width: Math.round((thumbHeight * 64) / 90), height: thumbHeight });
  const candidates: DeckActionsPlan[] = [];
  const fitsCells = (boxWidth: number, columns: number, sideWidth: number | null): boolean => {
    const inner = boxWidth - DECK_ACTIONS_PAD * 2 - (sideWidth === null ? 0 : sideWidth + DECK_ACTIONS_PAD);
    return (inner - DECK_ACTIONS_GAP * (columns - 1)) / columns >= CELL_MIN_WIDTH;
  };
  for (const [columns, row, thumbHeight, backInGrid, maxWidth] of [
    [2, 52, 90, false, 520],
    [3, 44, 62, false, 640],
    [4, 44, 62, true, 720],
  ] as const) {
    const boxWidth = Math.min(maxWidth, width - margin * 2);
    if (candidates.length > 0 && !fitsCells(boxWidth, columns, null)) continue;
    candidates.push({ boxWidth, margin, columns, row, thumb: thumbOf(thumbHeight), backInGrid, sideWidth: null });
  }
  for (const columns of [3, 2] as const) {
    const boxWidth = Math.min(820, width - margin * 2);
    const sideWidth = Math.round(Math.min(240, boxWidth * 0.32));
    if (!fitsCells(boxWidth, columns, sideWidth)) continue;
    candidates.push({ boxWidth, margin, columns, row: 44, thumb: thumbOf(62), backInGrid: true, sideWidth });
    break;
  }
  return candidates;
}

export interface DeckActionsPlanInput {
  readonly width: number;
  readonly height: number;
  /** The buttons in the grid: every action but the red one. */
  readonly gridCount: number;
  /** The sheet's text drawn at a plan's widths (`deckActionsTextWidths`). */
  readonly measure: (widths: DeckActionsTextWidths) => DeckActionsMeasured;
}

/**
 * The roomiest layout whose real text fits the screen: two columns of tall buttons on a phone held upright and a
 * tablet, then three, then four with Back in the grid and a smaller picture, then, for a phone held sideways, the
 * header in a column beside the buttons (#958 review: every action and Back stay on screen, with Delete armed too).
 * Null when none fits: the caller shortens its notes and asks again.
 */
export function deckActionsPlan(input: DeckActionsPlanInput): DeckActionsPlan | null {
  for (const plan of deckActionsCandidates(input.width, input.height)) {
    const measured = input.measure(deckActionsTextWidths(plan));
    if (deckActionsHeight(plan, input.gridCount, measured) <= input.height - plan.margin * 2) return plan;
  }
  return null;
}
