import type { McButtonKind } from "../../shared/button.types.js";

/** A box in the body's content space: `x` from the body's left edge, `y` from the top of its scrolling content. */
export interface BodyRect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A button on a row: a switch ("ON" / "OFF"), a door ("Open ▸"), Apply. */
export interface BodyButton {
  readonly kind: "button";
  readonly key: string;
  readonly rect: BodyRect;
  readonly label: string;
  readonly look: McButtonKind;
  readonly selected?: boolean;
  /** The inner paper frame of a switch that is on. */
  readonly framed?: boolean;
  /** Unavailable, with the reason a tooltip gives. */
  readonly disabled?: string | true;
}

/** One cell of a segmented control or a tile row: an option, chosen or not. */
export interface BodyCell {
  readonly kind: "cell";
  readonly key: string;
  readonly rect: BodyRect;
  readonly label: string;
  /** A second line under the label (a tile); without one the label is centered, in capitals. */
  readonly detail?: string;
  readonly selected: boolean;
  /** The chosen cell's fill: paper (a segment) or caution yellow (a tile, the guide level). */
  readonly fill: "paper" | "caution";
}

/** A dropdown field: the value shown, and a ▼. */
export interface BodyField {
  readonly kind: "field";
  readonly key: string;
  readonly rect: BodyRect;
  readonly label: string;
}

export type BodyControl = BodyButton | BodyCell | BodyField;

/** One row: its title and detail at the top left, and its controls where the client's layout placed them. */
export interface BodyRow {
  readonly key: string;
  readonly rect: BodyRect;
  readonly title?: string;
  readonly detail?: string;
  /** How wide the detail wraps; the row's width when absent. */
  readonly detailWidth?: number;
  /** A detail saying why the row can't be used now: dimmer. */
  readonly detailDim?: boolean;
  /** A press anywhere on the row (not on a control) presses this key, as the row's own switch does. */
  readonly rowKey?: string;
  readonly controls: readonly BodyControl[];
}

export interface BodyHeading {
  readonly rect: BodyRect;
  readonly title: string;
}

/** An open dropdown list (the Resolution field's): its options over the rows, and a tap anywhere else closes it. */
export interface BodyList {
  readonly rect: BodyRect;
  readonly rowHeight: number;
  readonly options: readonly { readonly key: string; readonly label: string; readonly selected: boolean }[];
  /** The key a tap outside the list sends. */
  readonly closeKey: string;
}

export interface SettingsBodyModel {
  /** The content's whole height, so the list scrolls exactly as far as the rows go. */
  readonly height: number;
  readonly headings: readonly BodyHeading[];
  readonly rows: readonly BodyRow[];
  readonly list?: BodyList;
}
