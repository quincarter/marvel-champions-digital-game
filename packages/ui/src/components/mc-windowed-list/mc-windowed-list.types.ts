import type { TemplateResult } from "lit";

/** What one item of the list draws: the list calls this only for the items near the viewport. */
export type WindowedItem = (index: number) => TemplateResult;

/** `mc-window`: the rows built changed (a scroll, a resize, new rows). Not a press, so a scene may listen at any time. */
export interface WindowDetail {
  /** First row built, and one past the last. */
  readonly start: number;
  readonly end: number;
}

/** A box in viewport pixels. */
export interface ViewportBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}
