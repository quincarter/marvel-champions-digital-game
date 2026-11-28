/** One lesson row of the hub, already translated. */
export interface LessonRowModel {
  readonly id: string;
  /** 1-based position among the lessons, for the badge. */
  readonly index: number;
  readonly title: string;
  readonly done: boolean;
  /** The first lesson not yet done: the one the guide steers to. */
  readonly recommended: boolean;
  /** "✓ Done". */
  readonly doneLabel: string;
  /** "NEXT". */
  readonly nextLabel: string;
}
