/** One product chip: a pack (or the custom packs), and whether it is the one filtering the roster. */
export interface ScenarioChip {
  /** `product:<pack code>`: what the scene reads back from `scenario-chip:<id>`. */
  readonly id: string;
  /** The pack name, already translated. */
  readonly label: string;
  readonly selected: boolean;
}
