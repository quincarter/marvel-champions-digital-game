import type { TitleMenuRow } from "../mc-title-menu-button/mc-title-menu-button.types.js";

/** The Title menu: its rows in reading order. A half row sits beside the next half row. */
export interface TitleMenuInput {
  readonly rows: readonly TitleMenuRow[];
}
