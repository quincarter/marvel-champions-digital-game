/** The properties of `mc-link-row`, besides the press ones (`data-stop`, `action`, `holdAction`) every pressable control takes. */
export interface McLinkRowProps {
  /** The row's title, already translated. */
  readonly heading: string;
  /** The line under it, or an empty string. */
  readonly detail: string;
  /** The recommended row: a heavy yellow outline. */
  readonly emphasis: boolean;
}
