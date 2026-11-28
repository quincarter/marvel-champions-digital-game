/** One aspect row of the hub, already translated. */
export interface AspectRowModel {
  /** justice | aggression | leadership | protection: picks the chip's colour and the stop key. */
  readonly aspect: string;
  readonly name: string;
  readonly tagline: string;
  /** The aspect's lesson is finished. */
  readonly done: boolean;
  /** "✓ Done". */
  readonly doneLabel: string;
}
