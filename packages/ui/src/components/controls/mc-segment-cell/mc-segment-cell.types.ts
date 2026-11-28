/** The properties of `mc-segment-cell`, besides the press ones. */
export interface McSegmentCellProps {
  readonly label: string;
  readonly detail: string;
  readonly selected: boolean;
  readonly look: "cell" | "tile";
}
