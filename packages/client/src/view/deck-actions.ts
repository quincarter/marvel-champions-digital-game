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
