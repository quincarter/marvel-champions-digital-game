/** What `mc-search` carries: the text now in the field. */
export interface McSearchDetail {
  readonly value: string;
  /** True when it fired at once (Enter, the clear button) rather than after the typing pause. */
  readonly immediate: boolean;
}

/** What `mc-search-focus` carries: whether the caret is in the field now (the screen route stands aside while it is). */
export interface McSearchFocusDetail {
  readonly focused: boolean;
}
