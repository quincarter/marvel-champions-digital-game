import type { GlyphSpec, HintGlyph } from "@mc/ui";
import type { ControllerDiagram } from "../../view/controller-diagram.js";

/**
 * Everything Settings ▸ Controls' elements say to the scene: one `mc-controls` event (bubbles and composed), listed in
 * `GUARDED_EVENTS`. The controls raise `mc-pressed` with one of these as the action; `FeatureRelay` turns that into the
 * event.
 */
export const CONTROLS_EVENT = "mc-controls";

export type ControlsTabId = "controller" | "keyboard";

export type ControlsEventDetail =
  | { readonly type: "back" }
  | { readonly type: "tab"; readonly id: ControlsTabId }
  /** A cell of a choice row: the pad's labels, the glyph source or the keyboard hand. */
  | { readonly type: "choose"; readonly row: "labels" | "source" | "hand"; readonly value: string }
  /** A switch row: the Switch layout or the hints. */
  | { readonly type: "toggle"; readonly row: "nintendo" | "hints" }
  /** The hint size slider's share along its track (0 to 1), and its - and + buttons. */
  | { readonly type: "hint-slide"; readonly share: number }
  | { readonly type: "hint-step"; readonly direction: -1 | 1 };

declare global {
  interface HTMLElementEventMap {
    "mc-controls": CustomEvent<ControlsEventDetail>;
  }
}

/** A settings row of the screen, already worded. */
export type ControlsSettingRow =
  | {
      readonly kind: "choice";
      readonly id: "labels" | "source" | "hand";
      readonly heading: string;
      readonly detail: string;
      readonly dimmed: boolean;
      readonly options: readonly { readonly value: string; readonly label: string; readonly selected: boolean }[];
    }
  | {
      readonly kind: "toggle";
      readonly id: "nintendo" | "hints";
      readonly title: string;
      readonly detail: string;
      /** The switch's word (ON, OFF, or a lock chip such as STEAM). */
      readonly state: string;
      readonly on: boolean;
      /** Set by the platform (Steam): nothing to switch. */
      readonly locked: boolean;
    }
  | {
      readonly kind: "slider";
      readonly id: "hintSize";
      readonly heading: string;
      readonly detail: string;
      /** The knob's place, 0 to 100, and the value as text. */
      readonly value: number;
      readonly label: string;
      readonly dimmed: boolean;
      /** Live samples at the size the hints draw now: an A button and a Space cap. */
      readonly preview: readonly { readonly spec: GlyphSpec; readonly height: number }[];
    };

export interface ControlsListRowInput {
  readonly id: string;
  readonly glyphs: readonly GlyphSpec[];
  readonly action: string;
  /** Where it applies. */
  readonly note: string;
}

export interface ControlsListSection {
  readonly id: string;
  readonly title: string;
  readonly rows: readonly ControlsListRowInput[];
}

/** The controller drawing with its caption and, while a pad is connected, the line of what the browser reports. */
export interface ControlsDiagramInput {
  readonly diagram: ControllerDiagram;
  readonly caption: string;
  readonly testLine: string | null;
}

export interface ControlsPageModel {
  readonly phone: boolean;
  readonly bar: {
    readonly title: string;
    readonly backLabel: string;
    readonly backGlyph: HintGlyph | null;
  };
  readonly tabs: readonly { readonly id: ControlsTabId; readonly label: string }[];
  readonly tab: ControlsTabId;
  readonly status: { readonly connected: boolean; readonly text: string };
  /** The drawing: on the controller tab only. */
  readonly diagram: ControlsDiagramInput | null;
  readonly settings: readonly ControlsSettingRow[];
  readonly sections: readonly ControlsListSection[];
  /** The disabled Remap buttons, and why they do nothing. */
  readonly footer: { readonly labels: readonly string[]; readonly reason: string };
}
