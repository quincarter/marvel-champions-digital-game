/** Which part of a stepper was pressed. */
export type ValueStepperPart = "prev" | "name" | "next";

/** `mc-value-stepper-press`: a tap on an enabled part (or the focus route's Enter on its stop). */
export interface ValueStepperPressDetail {
  readonly part: ValueStepperPart;
}
