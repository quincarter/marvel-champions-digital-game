/** What the dialog is given besides its slots. */
export interface McDialogProps {
  readonly heading: string;
  /** The box's widest, px. */
  readonly width: number;
  /** The box fills the height. */
  readonly tall: boolean;
}
