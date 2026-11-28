/** The properties of `mc-section-heading`, besides the press ones (`data-stop`, `action`, `holdAction`) every pressable control takes. */
export interface McSectionHeadingProps {
  readonly label: string;
  readonly right: string;
  readonly onink: boolean;
  readonly stacked: boolean;
}
