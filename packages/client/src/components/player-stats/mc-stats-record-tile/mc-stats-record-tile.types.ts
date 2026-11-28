export interface McStatsRecordTileProps {
  /** "Wins–losses", already translated. */
  caption: string;
  /** "12–5". */
  record: string;
  /** "71% win rate". */
  rate: string;
  /** 0 to 1: wins over results, the track's fill. */
  fraction: number;
  /** "Best streak 4 · Current: 2 wins". */
  detail: string;
}
