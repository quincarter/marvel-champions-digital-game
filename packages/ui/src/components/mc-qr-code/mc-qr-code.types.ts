/** The properties of `mc-qr-code`. */
export interface McQrCodeProps {
  /** The modules, one string per row: "1" dark, "0" light. */
  readonly rows: readonly string[];
  /** What the code is, as assistive text. */
  readonly label: string;
}
