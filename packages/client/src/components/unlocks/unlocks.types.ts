import type { HintGlyph } from "@mc/ui";
import type { GuideSection } from "../../view/progression-guide.js";

/**
 * Everything Settings ▸ Unlocks' elements say to the scene: one `mc-unlocks` event (bubbles and composed), listed in
 * `GUARDED_EVENTS`. The controls raise `mc-pressed` with one of these as the action; `FeatureRelay` turns that into the
 * event.
 */
export const UNLOCKS_EVENT = "mc-unlocks";

export type UnlocksEventDetail =
  | { readonly type: "back" }
  /** The door between the switches and "How it works". */
  | { readonly type: "guide" }
  /** The "Unlock everything" switch. */
  | { readonly type: "all" }
  /** The print-and-play switch. */
  | { readonly type: "pnp" }
  /** One campaign's or hero's switch. */
  | { readonly type: "row"; readonly id: string };

declare global {
  interface HTMLElementEventMap {
    "mc-unlocks": CustomEvent<UnlocksEventDetail>;
  }
}

/** A switch row (Unlock everything, print-and-play): already worded. */
export interface UnlocksSwitchInput {
  readonly title: string;
  readonly detail: string;
  readonly state: string;
  readonly on: boolean;
}

/** One row of the list, worded: a section title, a wave with what opens it, or a switch. */
export type UnlocksListRow =
  | { readonly kind: "section"; readonly id: string; readonly title: string }
  | {
      readonly kind: "wave";
      readonly id: string;
      readonly title: string;
      readonly status: string;
      readonly open: boolean;
    }
  | {
      readonly kind: "switch";
      readonly id: string;
      readonly title: string;
      readonly detail: string;
      /** The switch's word (ON, OFF, Open, Earned). */
      readonly state: string;
      readonly on: boolean;
      /** Only a hero's or campaign's own switch has a focus stop (`row:<id>`). */
      readonly stop: boolean;
      /** Nothing to switch: dimmed, a tap does nothing. */
      readonly unavailable: boolean;
    };

export interface UnlocksPageModel {
  readonly phone: boolean;
  readonly bar: {
    readonly title: string;
    readonly backLabel: string;
    readonly backGlyph: HintGlyph | null;
    readonly titleDrop: number;
    readonly titleMaxRight: number;
  };
  /** The door's word and its LB / RB glyph. */
  readonly door: { readonly label: string; readonly glyph: HintGlyph | null };
  /** True: "How it works" shows in place of the switches. */
  readonly guide: boolean;
  readonly points: { readonly title: string; readonly detail: string };
  readonly all: UnlocksSwitchInput;
  readonly printAndPlay: UnlocksSwitchInput;
  readonly rows: readonly UnlocksListRow[];
  readonly sections: readonly GuideSection[];
}
