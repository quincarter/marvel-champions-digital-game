/** The properties of `mc-switch-row`, besides the press ones (`data-stop`, `action`, `holdAction`). */
export interface McSwitchRowProps {
  readonly titleText: string;
  readonly detail: string;
  readonly state: string;
  readonly on: boolean;
  readonly unavailable: boolean;
}
