export interface PastGamesFileModel {
  /** "Open a replay file" ("Open file" on a phone). */
  readonly label: string;
  /** Something is running. */
  readonly disabled: boolean;
}

export interface McPastGamesFileButtonProps {
  readonly model: PastGamesFileModel;
}
