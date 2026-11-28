/** One button inside an option card. `action` is what the owner hears when it is pressed. */
export interface McOptionChip {
  readonly action: string;
  readonly label: string;
  readonly selected: boolean;
  readonly enabled: boolean;
}

export interface McOptionGroup {
  /** The small label above the chips (a Horseman's name), or null for a row whose name says it all. */
  readonly label: string | null;
  readonly chips: readonly McOptionChip[];
}

export type McOptionControl =
  /** Segmented chips: one group or several. */
  | { readonly kind: "groups"; readonly groups: readonly McOptionGroup[] }
  /** The whole card is the button. */
  | { readonly kind: "toggle"; readonly action: string }
  /** A minus, the value and a plus. `wide`: the value is a name, centered between the two end buttons. */
  | {
      readonly kind: "stepper";
      readonly down: McOptionChip;
      readonly up: McOptionChip;
      readonly valueLabel: string;
      readonly wide?: boolean;
    };

/** What an option card shows (the client's setup option rows fit it as they are). */
export interface McOptionRow {
  readonly name: string;
  /** One short line of state under the name; empty when the name and the chips say it all. */
  readonly meta: string;
  /** The card is showing a choice other than the default (red frame). */
  readonly active: boolean;
  readonly control: McOptionControl;
}
