/** One guide level card of the chooser, already translated. */
export interface GuideOptionModel {
  /** full | hints | off. */
  readonly value: "full" | "hints" | "off";
  readonly label: string;
  readonly body: string;
  readonly selected: boolean;
  /** The guide's pick: it wears a RECOMMENDED stamp. */
  readonly recommended: boolean;
  /** "RECOMMENDED", already translated. */
  readonly recommendedLabel: string;
}
