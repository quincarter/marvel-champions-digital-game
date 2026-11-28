import type { HintGlyph } from "@mc/ui";
import type { WatchModel } from "../mc-briefing-watch-toggle/mc-briefing-watch-toggle.types.js";

/** The foot bar: the two buttons, why Open waits, and the watch toggle. Every word arrives translated. */
export interface ActionBarModel {
  /** "EDIT DECKS" (a phone: "DECKS"), already capitalised. */
  readonly editLabel: string;
  /** "OPEN ISSUE #2 ▸", "CONTINUE ISSUE #2 ▸", "OPENING…" or "FIX A DECK FIRST", already capitalised. */
  readonly openLabel: string;
  /** Open can be pressed now (the issue is composed, no call is open, no deck setup would refuse). */
  readonly canOpen: boolean;
  /** Start glyph on the red button while a pad is in use; null for none. */
  readonly openGlyph: HintGlyph | null;
  /** Why Open waits (a deck problem outranks a call or composing hint); null for none. */
  readonly reason: string | null;
  /** The toggle; null when it is hidden (a deck problem, a reason, an issue already on the table, the chooser open). */
  readonly watch: WatchModel | null;
}
