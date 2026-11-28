import type { HintGlyph } from "@mc/ui";

/**
 * Everything Settings ▸ Save data's elements say to the scene: one `mc-save-data` event (bubbles and composed), listed
 * in `GUARDED_EVENTS`. (The code field's own `mc-input` and `mc-field-focus` pass through as they are.)
 */
export const SAVE_DATA_EVENT = "mc-save-data";

/** The six ways to move or share your data, in the order they are listed. */
export type SaveDataActionId = "export" | "import" | "send" | "receive" | "sync" | "global";

export type SaveDataEventDetail =
  | { readonly type: "back" }
  /** One of the six action rows' buttons. */
  | { readonly type: "action"; readonly id: SaveDataActionId }
  /** "Back" on the confirm, Send or Receive step: to the six rows. */
  | { readonly type: "menu" }
  | { readonly type: "replace" }
  | { readonly type: "copy" }
  | { readonly type: "new-code" }
  /** Receive's button, or Enter in the code field. */
  | { readonly type: "receive" }
  /** The status line's Export button. */
  | { readonly type: "status-export" };

export function saveDataEvent(detail: SaveDataEventDetail): CustomEvent<SaveDataEventDetail> {
  return new CustomEvent<SaveDataEventDetail>(SAVE_DATA_EVENT, { detail, bubbles: true, composed: true });
}

declare global {
  interface HTMLElementEventMap {
    "mc-save-data": CustomEvent<SaveDataEventDetail>;
  }
}

/** One action row: a title, a line of detail and the button under them. */
export interface SaveDataActionRow {
  readonly id: SaveDataActionId;
  readonly title: string;
  readonly detail: string;
  readonly label: string;
  /** Device sync is new: a BETA stamp after the title. */
  readonly beta: boolean;
}

export interface SaveDataActionsInput {
  readonly rows: readonly SaveDataActionRow[];
  /** A file is in flight: every button is dimmed and does nothing. */
  readonly disabled: boolean;
}

export interface SaveDataConfirmInput {
  readonly title: string;
  readonly body: string;
  readonly cancelLabel: string;
  readonly confirmLabel: string;
  readonly cancelGlyph: HintGlyph | null;
}

/** The Send step: uploading (the title only) or showing the code. */
export type SaveDataSendInput =
  | { readonly phase: "uploading"; readonly title: string }
  | {
      readonly phase: "showing";
      readonly title: string;
      readonly help: string;
      readonly code: string;
      /** The receive link's QR modules (`mc-qr-code`'s rows). */
      readonly qr: readonly string[];
      readonly link: string;
      readonly countdown: string;
      readonly expired: boolean;
      readonly copyLabel: string;
      readonly newCodeLabel: string;
      readonly backLabel: string;
      readonly backGlyph: HintGlyph | null;
    };

export interface SaveDataReceiveInput {
  readonly title: string;
  /** Asking the service: the title only. */
  readonly fetching: boolean;
  readonly help: string;
  readonly value: string;
  readonly placeholder: string;
  readonly receiveLabel: string;
  readonly backLabel: string;
  readonly backGlyph: HintGlyph | null;
}

/** The line under the step: what just happened, or that something is in flight. */
export interface SaveDataStatusInput {
  readonly text: string;
  readonly tone: "ok" | "error";
  /** "Export" beside the line (the offline way to move a save), or none. */
  readonly exportLabel: string | null;
}

export type SaveDataStepInput =
  | { readonly kind: "menu"; readonly actions: SaveDataActionsInput }
  | { readonly kind: "confirm"; readonly confirm: SaveDataConfirmInput }
  | { readonly kind: "send"; readonly send: SaveDataSendInput }
  | { readonly kind: "receive"; readonly receive: SaveDataReceiveInput }
  | { readonly kind: "busy" };

export interface SaveDataPageModel {
  readonly phone: boolean;
  readonly bar: {
    readonly title: string;
    readonly backLabel: string;
    readonly backGlyph: HintGlyph | null;
  };
  readonly step: SaveDataStepInput;
  readonly status: SaveDataStatusInput | null;
}
