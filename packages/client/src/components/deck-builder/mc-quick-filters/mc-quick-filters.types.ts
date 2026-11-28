/** One quick chip: a cost ("0" to "5+") or a resource icon. A second tap on the same chip clears it. */
export interface QuickChipModel {
  /** `cost:2`, `icon:physical`: the chip is the `quick:<id>` stop. */
  readonly id: string;
  readonly text: string;
  readonly on: boolean;
}

/** The trait stepper (a name between arrows, wrapping through "All traits"). */
export interface TraitStepperModel {
  readonly name: string;
  readonly on: boolean;
}

/** The quick filters under the type chips (issue #531). */
export interface QuickFiltersModel {
  readonly label: string;
  readonly costs: readonly QuickChipModel[];
  readonly icons: readonly QuickChipModel[];
  readonly trait: TraitStepperModel;
}
