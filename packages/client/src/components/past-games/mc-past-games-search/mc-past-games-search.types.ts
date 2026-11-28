export interface PastGamesSearchModel {
  /** The text the screen has accepted (never the field's live draft). */
  readonly value: string;
  readonly placeholder: string;
  /** What the field says while focused and empty on a Steam pad; absent for none. */
  readonly focusPlaceholder?: string;
  readonly clearLabel: string;
  /** "Export for MC Tracker (CSV)", or "Working..." while it runs. */
  readonly exportLabel: string;
  /** Nothing to export (no games shown) or something is running. */
  readonly exportDisabled: boolean;
}

export interface McPastGamesSearchProps {
  readonly model: PastGamesSearchModel;
}
