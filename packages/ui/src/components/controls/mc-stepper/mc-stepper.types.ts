/** Which part of a stepper was pressed. */
export type StepperPart = "prev" | "name" | "next";

/** `mc-stepper-press`: a tap on an enabled part (or the focus route's Enter on its stop). */
export interface StepperPressDetail {
  readonly part: StepperPart;
}
