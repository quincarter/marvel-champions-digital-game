/** What `mc-input` carries: the text now in the field. */
export interface McInputDetail {
  readonly value: string;
}

/** What `mc-field-focus` carries: whether the caret is in the field now (the screen route stands aside while it is). */
export interface McFieldFocusDetail {
  readonly focused: boolean;
}
