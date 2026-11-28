/** The properties of `mc-check-row`, besides the press ones (`data-stop`, `action`, `holdAction`) every pressable control takes. */
export interface McCheckRowProps {
  readonly name: string;
  readonly meta: string;
  readonly checked: boolean;
  readonly locked: boolean;
}
