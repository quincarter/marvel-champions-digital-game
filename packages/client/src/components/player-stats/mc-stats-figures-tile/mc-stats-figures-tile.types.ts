export interface StatsFigureLine {
  readonly label: string;
  readonly value: string;
}

export interface McStatsFiguresTileProps {
  label: string;
  lines: readonly StatsFigureLine[];
}
