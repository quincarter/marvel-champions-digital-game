/** The properties of `mc-chip`, besides the press ones (`data-stop`, `action`, `holdAction`) every pressable control takes. */
export interface McChipProps {
  readonly label: string;
  readonly selected: boolean;
  readonly link: boolean;
  readonly disabled: boolean;
}
